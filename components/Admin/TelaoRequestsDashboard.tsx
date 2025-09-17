import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getTelaoRequestsByEvent } from '../../services/api';
import { TelaoRequest, TelaoRequestStatus } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Button from '../Button';

declare const jspdf: any;

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const StatusBadge: React.FC<{ status: TelaoRequestStatus }> = ({ status }) => {
  const baseClasses = 'px-2 py-1 text-xs font-bold rounded-full';
  const statusClasses = {
    [TelaoRequestStatus.PENDENTE]: 'bg-yellow-800 text-yellow-200',
    [TelaoRequestStatus.CONCLUIDO]: 'bg-green-800 text-green-300',
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

const TelaoRequestsDashboard: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [requests, setRequests] = useState<TelaoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TelaoRequestStatus | 'all'>('all');

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await getTelaoRequestsByEvent(eventId);
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch telão requests:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const intervalId = setInterval(fetchData, 20000); // Refresh every 20 seconds
    return () => clearInterval(intervalId);
  }, [fetchData]);
  
  const filteredRequests = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter(r => r.status === filter);
  }, [requests, filter]);

  const getFilterButtonClass = (buttonFilter: TelaoRequestStatus | 'all') => {
      return `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
          filter === buttonFilter 
          ? 'bg-primary text-black' 
          : 'bg-secondary hover:bg-secondary-hover'
      }`;
  };

  const handleDownloadPdf = () => {
    const doc = new jspdf.jsPDF();
    const filterText = filter === 'all' ? 'Todas' : filter;

    doc.setFontSize(18);
    doc.text(`Relatório de Solicitações de Telão (${filterText})`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Empresa", "Vendedor", "Veículo", "Status", "Data", "Atendido por", "Feedback"];
    const tableRows: string[][] = [];

    filteredRequests.forEach(req => {
        const vehicleInfo = req.vehicle ? `${req.vehicle.marca} ${req.vehicle.model}` : 'N/A';
        const reqData = [
            req.company?.name || 'N/A',
            req.collaborator?.name || 'N/A',
            vehicleInfo,
            req.status,
            new Date(req.createdAt).toLocaleString('pt-BR'),
            req.staff?.name || (req.status === TelaoRequestStatus.CONCLUIDO ? 'N/A' : ''),
            req.resolverFeedback || (req.status === TelaoRequestStatus.CONCLUIDO ? '' : ''),
        ];
        tableRows.push(reqData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] },
    });
    
    const safeFilterName = filter.toLowerCase();
    doc.save(`relatorio_telao_${safeFilterName}.pdf`);
  };

  if (loading && requests.length === 0) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Painel de Solicitações de Telão</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-background rounded-lg">
                <button onClick={() => setFilter('all')} className={getFilterButtonClass('all')}>Todos</button>
                <button onClick={() => setFilter(TelaoRequestStatus.PENDENTE)} className={getFilterButtonClass(TelaoRequestStatus.PENDENTE)}>Pendentes</button>
                <button onClick={() => setFilter(TelaoRequestStatus.CONCLUIDO)} className={getFilterButtonClass(TelaoRequestStatus.CONCLUIDO)}>Concluídas</button>
            </div>
            <Button
                onClick={handleDownloadPdf}
                variant="secondary"
                disabled={filteredRequests.length === 0}
                className="text-sm py-2 px-3 flex items-center"
            >
                <DownloadIcon />
                Download
            </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRequests.length > 0 ? filteredRequests.map(req => (
          <div key={req.id} className="p-4 bg-secondary rounded-lg border-l-4 border-primary">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
              <div className="flex items-center gap-4">
                 <img src={req.company?.logoUrl || 'https://via.placeholder.com/150'} alt="logo" className="w-12 h-12 rounded-full object-contain bg-white p-1" />
                 <div>
                    <p className="font-bold text-lg">{req.company?.name}</p>
                    <p className="text-sm text-text-secondary">por {req.collaborator?.name}</p>
                 </div>
              </div>
              <div className="text-right">
                  <StatusBadge status={req.status} />
                  <p className="text-xs text-text-secondary mt-1">{new Date(req.createdAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
                <p><span className="font-semibold">Veículo Vendido:</span> {req.vehicle?.marca} {req.vehicle?.model}</p>
            </div>
            {req.status === TelaoRequestStatus.CONCLUIDO && (
              <div className="mt-4 pt-4 border-t border-border/50 bg-background/50 p-3 rounded-md">
                  <p className="font-semibold text-green-400">Atendido por: <span className="font-normal text-text">{req.staff?.name || 'N/A'}</span></p>
                  <p className="font-semibold text-green-400 mt-2">Feedback: <span className="font-normal text-text">"{req.resolverFeedback}"</span></p>
                  <p className="text-xs text-text-secondary mt-2 text-right">em {req.resolvedAt ? new Date(req.resolvedAt).toLocaleString('pt-BR') : 'N/A'}</p>
              </div>
            )}
          </div>
        )) : (
          <p className="text-center py-12 text-text-secondary">Nenhuma solicitação encontrada com o filtro selecionado.</p>
        )}
      </div>
    </div>
  );
};

export default TelaoRequestsDashboard;
