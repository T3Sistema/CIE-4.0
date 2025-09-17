import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAssignedTasksByEvent } from '../../services/api';
import { AssignedTask } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Button from '../Button';

// Tell TypeScript that jspdf is loaded globally from the CDN
declare const jspdf: any;

interface Props {
  eventId: string;
}

type StatusFilter = 'Todos' | 'Pendente' | 'Concluída';

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const StatusBadge: React.FC<{ status: 'Pendente' | 'Concluída' }> = ({ status }) => {
  const baseClasses = 'px-2 py-1 text-xs font-bold rounded-full';
  const statusClasses = {
    Pendente: 'bg-yellow-800 text-yellow-200',
    Concluída: 'bg-green-800 text-green-300',
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

const TasksView: React.FC<Props> = ({ eventId }) => {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('Pendente');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tasksData = await getAssignedTasksByEvent(eventId);
      setTasks(tasksData);
    } catch (error) {
      console.error("Failed to fetch assigned tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTasks = useMemo(() => {
    if (filter === 'Todos') {
      return tasks;
    }
    return tasks.filter(task => task.status === filter);
  }, [tasks, filter]);
  
  const getFilterButtonClass = (buttonFilter: StatusFilter) => {
    return `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
        filter === buttonFilter 
        ? 'bg-primary text-black' 
        : 'bg-secondary hover:bg-secondary-hover'
    }`;
  };

  const handleDownloadPdf = () => {
    const doc = new jspdf.jsPDF();

    doc.setFontSize(18);
    doc.text(`Relatório de Tarefas (${filter})`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Tarefa (Ação)", "Empresa", "Atribuído a", "Data", "Status"];
    const tableRows: string[][] = [];

    filteredTasks.forEach(task => {
        const taskData = [
            task.actionLabel,
            task.companyName,
            task.staffName,
            new Date(task.timestamp).toLocaleString('pt-BR'),
            task.status,
        ];
        tableRows.push(taskData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] },
    });
    
    const safeFilterName = filter.toLowerCase().replace('ú', 'u').replace('í', 'i');
    doc.save(`relatorio_tarefas_${safeFilterName}.pdf`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Tarefas Atribuídas</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-background rounded-lg">
                <button onClick={() => setFilter('Todos')} className={getFilterButtonClass('Todos')}>Todos</button>
                <button onClick={() => setFilter('Pendente')} className={getFilterButtonClass('Pendente')}>Pendentes</button>
                <button onClick={() => setFilter('Concluída')} className={getFilterButtonClass('Concluída')}>Concluídas</button>
            </div>
            <Button
                onClick={handleDownloadPdf}
                variant="secondary"
                disabled={filteredTasks.length === 0}
                className="text-sm py-2 px-3 flex items-center"
            >
                <DownloadIcon />
                Download PDF
            </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3">Tarefa (Ação)</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Atribuído a</th>
              <th className="p-3">Data</th>
              <th className="p-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => (
              <tr key={task.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="p-3 font-semibold text-primary">{task.actionLabel}</td>
                <td className="p-3">{task.companyName}</td>
                <td className="p-3">{task.staffName}</td>
                <td className="p-3 text-sm text-text-secondary">{new Date(task.timestamp).toLocaleString('pt-BR')}</td>
                <td className="p-3 text-center"><StatusBadge status={task.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTasks.length === 0 && (
            <div className="text-center py-12">
                <p className="text-text-secondary">Nenhuma tarefa encontrada com o filtro selecionado.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default TasksView;
