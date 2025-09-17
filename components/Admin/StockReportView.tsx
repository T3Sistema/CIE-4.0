import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStockMovementsByEvent, getParticipantCompaniesByEvent } from '../../services/api';
import { FullStockMovement, ParticipantCompany } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Button from '../Button';

declare const jspdf: any;

interface Props {
  eventId: string;
}

type MovementFilter = 'Todos' | 'Venda' | 'Teste Drive';

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const MovementBadge: React.FC<{ type: 'Venda' | 'Teste Drive' }> = ({ type }) => {
    const baseClasses = 'px-2 py-1 text-xs font-bold rounded-full';
    const typeClasses = {
        'Venda': 'bg-green-800 text-green-300',
        'Teste Drive': 'bg-blue-800 text-blue-300',
    };
    return <span className={`${baseClasses} ${typeClasses[type]}`}>{type}</span>;
};

const StockReportView: React.FC<Props> = ({ eventId }) => {
    const [movements, setMovements] = useState<FullStockMovement[]>([]);
    const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<MovementFilter>('Todos');
    const [dateFilter, setDateFilter] = useState<string>('');
    const [companyFilter, setCompanyFilter] = useState<string>('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [data, companiesData] = await Promise.all([
                getStockMovementsByEvent(eventId),
                getParticipantCompaniesByEvent(eventId)
            ]);
            setMovements(data);
            setCompanies(companiesData);
        } catch (error) {
            console.error("Failed to fetch stock movements report:", error);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const typeMatch = filter === 'Todos' || m.type === filter;
            const companyMatch = companyFilter === 'all' || m.company?.id === companyFilter;
            const dateMatch = !dateFilter || m.timestamp.startsWith(dateFilter);
            return typeMatch && companyMatch && dateMatch;
        });
    }, [movements, filter, companyFilter, dateFilter]);

    const getFilterButtonClass = (buttonFilter: MovementFilter) => {
        return `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            filter === buttonFilter 
            ? 'bg-primary text-black' 
            : 'bg-secondary hover:bg-secondary-hover'
        }`;
    };

    const handleDownloadPdf = () => {
        const doc = new jspdf.jsPDF();
        const selectedCompanyName = companyFilter !== 'all' 
            ? companies.find(c => c.id === companyFilter)?.name || 'Desconhecida'
            : 'Todas as Empresas';
        const dateText = dateFilter ? ` em ${new Date(dateFilter + 'T00:00:00').toLocaleDateString('pt-BR')}` : '';

        doc.setFontSize(18);
        doc.text(`Movimentação de Estoque (${filter})`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Empresa: ${selectedCompanyName}${dateText}`, 14, 30);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 38);

        const tableColumn = ["Tipo", "Veículo", "Empresa", "Equipe", "Data/Hora"];
        const tableRows: string[][] = [];

        filteredMovements.forEach(m => {
            const rowData = [
                m.type,
                `${m.vehicle?.marca || 'N/D'} - ${m.vehicle?.model || 'N/D'} (${m.vehicle?.placa || 'N/D'})`,
                m.company?.name || 'N/D',
                m.staff?.name || 'N/D',
                new Date(m.timestamp).toLocaleString('pt-BR'),
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 42,
            theme: 'grid',
            headStyles: { fillColor: [18, 181, 229] },
        });

        const safeFilterName = filter.toLowerCase().replace(/\s/g, '_');
        doc.save(`movimentacao_estoque_${safeFilterName}.pdf`);
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="bg-card p-6 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold">Movimentação de Estoque</h2>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                     <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3 py-2 border border-border rounded-md bg-background text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <select
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">Todas as Empresas</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2 p-1 bg-background rounded-lg">
                        <button onClick={() => setFilter('Todos')} className={getFilterButtonClass('Todos')}>Todos</button>
                        <button onClick={() => setFilter('Venda')} className={getFilterButtonClass('Venda')}>Vendas</button>
                        <button onClick={() => setFilter('Teste Drive')} className={getFilterButtonClass('Teste Drive')}>Test Drives</button>
                    </div>
                    <Button
                        onClick={handleDownloadPdf}
                        variant="secondary"
                        disabled={filteredMovements.length === 0}
                        className="text-sm py-2 px-3 flex items-center"
                    >
                        <DownloadIcon /> Download PDF
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Veículo</th>
                            <th className="p-3">Empresa</th>
                            <th className="p-3">Equipe</th>
                            <th className="p-3">Data/Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMovements.map(m => (
                            <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                                <td className="p-3"><MovementBadge type={m.type} /></td>
                                <td className="p-3 font-semibold">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={m.vehicle?.photoUrl || 'https://via.placeholder.com/100'}
                                            alt={`${m.vehicle?.marca || ''} ${m.vehicle?.model || ''}`}
                                            className="w-16 h-12 object-cover rounded-md bg-secondary flex-shrink-0"
                                        />
                                        <div>
                                          <span>{`${m.vehicle?.marca || 'N/D'} - ${m.vehicle?.model || 'N/D'}`}</span>
                                          <p className="text-xs font-normal text-text-secondary">{m.vehicle?.placa || 'Sem placa'}</p>
                                        </div>

                                    </div>
                                </td>
                                <td className="p-3">{m.company?.name || 'N/D'}</td>
                                <td className="p-3">{m.staff?.name || 'N/D'}</td>
                                <td className="p-3 text-sm text-text-secondary">{new Date(m.timestamp).toLocaleString('pt-BR')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredMovements.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-text-secondary">Nenhuma movimentação encontrada com o filtro selecionado.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockReportView;