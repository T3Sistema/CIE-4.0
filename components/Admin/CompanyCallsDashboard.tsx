import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getCompanyCallsByEvent } from '../../services/api';
import { CompanyCall, CallStatus } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Button from '../Button';

declare const jspdf: any;

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const StatusBadge: React.FC<{ status: CallStatus }> = ({ status }) => {
  const baseClasses = 'px-2 py-1 text-xs font-bold rounded-full';
  const statusClasses = {
    [CallStatus.PENDENTE]: 'bg-yellow-800 text-yellow-200',
    [CallStatus.CONCLUIDO]: 'bg-green-800 text-green-300',
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

const CompanyCallsDashboard: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [calls, setCalls] = useState<CompanyCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CallStatus | 'all'>('all');

  const fetchData = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await getCompanyCallsByEvent(eventId);
      setCalls(data);
    } catch (error) {
      console.error("Failed to fetch company calls:", error);
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
  
  const filteredCalls = useMemo(() => {
    if (filter === 'all') return calls;
    return calls.filter(c => c.status === filter);
  }, [calls, filter]);

  const getFilterButtonClass = (buttonFilter: CallStatus | 'all') => {
      return `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
          filter === buttonFilter 
          ? 'bg-primary text-black' 
          : 'bg-secondary hover:bg-secondary-hover'
      }`;
  };

  const handleDownloadPdf = () => {
    const doc = new jspdf.jsPDF();
    const filterText = filter === 'all' ? 'Todos' : filter;

    doc.setFontSize(18);
    doc.text(`Relatório de Chamados (${filterText})`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Empresa", "Solicitante", "Departamento", "Observação", "Status", "Data", "Resolvido por", "Feedback"];
    const tableRows: string[][] = [];

    filteredCalls.forEach(call => {
        const callData = [
            call.company?.name || 'N/A',
            call.collaboratorName,
            call.department?.name || 'N/A',
            call.observation || '',
            call.status,
            new Date(call.createdAt).toLocaleString('pt-BR'),
            call.staff?.name || (call.status === CallStatus.CONCLUIDO ? 'N/A' : ''),
            call.resolverFeedback || (call.status === CallStatus.CONCLUIDO ? '' : ''),
        ];
        tableRows.push(callData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] },
    });
    
    const safeFilterName = filter.toLowerCase();
    doc.save(`relatorio_chamados_${safeFilterName}.pdf`);
  };

  if (loading && calls.length === 0) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Painel de Chamados das Empresas</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-background rounded-lg">
                <button onClick={() => setFilter('all')} className={getFilterButtonClass('all')}>Todos</button>
                <button onClick={() => setFilter(CallStatus.PENDENTE)} className={getFilterButtonClass(CallStatus.PENDENTE)}>Pendentes</button>
                <button onClick={() => setFilter(CallStatus.CONCLUIDO)} className={getFilterButtonClass(CallStatus.CONCLUIDO)}>Concluídos</button>
            </div>
            <Button
                onClick={handleDownloadPdf}
                variant="secondary"
                disabled={filteredCalls.length === 0}
                className="text-sm py-2 px-3 flex items-center"
            >
                <DownloadIcon />
                Download
            </Button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredCalls.length > 0 ? filteredCalls.map(call => (
          <div key={call.id} className="p-4 bg-secondary rounded-lg border-l-4 border-primary">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
              <div className="flex items-center gap-4">
                 <img src={call.company?.logoUrl || 'https://via.placeholder.com/150'} alt="logo" className="w-12 h-12 rounded-full object-contain bg-white p-1" />
                 <div>
                    <p className="font-bold text-lg">{call.company?.name}</p>
                    <p className="text-sm text-text-secondary">por {call.collaboratorName}</p>
                 </div>
              </div>
              <div className="text-right">
                  <StatusBadge status={call.status} />
                  <p className="text-xs text-text-secondary mt-1">{new Date(call.createdAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
                <p><span className="font-semibold">Departamento:</span> {call.department?.name}</p>
                <p className="mt-2"><span className="font-semibold">Observação:</span> {call.observation}</p>
            </div>
            {call.status === CallStatus.CONCLUIDO && (
              <div className="mt-4 pt-4 border-t border-border/50 bg-background/50 p-3 rounded-md">
                  <p className="font-semibold text-green-400">Resolvido por: <span className="font-normal text-text">{call.staff?.name || 'N/A'}</span></p>
                  <p className="font-semibold text-green-400 mt-2">Feedback: <span className="font-normal text-text">"{call.resolverFeedback}"</span></p>
                  <p className="text-xs text-text-secondary mt-2 text-right">em {call.resolvedAt ? new Date(call.resolvedAt).toLocaleString('pt-BR') : 'N/A'}</p>
              </div>
            )}
          </div>
        )) : (
          <p className="text-center py-12 text-text-secondary">Nenhum chamado encontrado com o filtro selecionado.</p>
        )}
      </div>
    </div>
  );
};

export default CompanyCallsDashboard;
