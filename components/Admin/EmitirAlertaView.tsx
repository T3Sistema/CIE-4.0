import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getDepartmentsByEvent, getStaffByEvent, addAlertLog, getAlertLogsByEvent } from '../../services/api';
import { Department, Staff, AlertLog } from '../../types';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import Modal from '../Modal';
import { useAuth } from '../../context/AuthContext';

declare const jspdf: any;

interface Props {
  eventId: string;
}

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const EmitirAlertaView: React.FC<Props> = ({ eventId }) => {
  const { user } = useAuth();
  
  // State for data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // State for choosing alert type
  const [alertType, setAlertType] = useState<'staff' | 'group' | null>(null);

  // State for STAFF form flow
  const [step, setStep] = useState(1);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [alertMessage, setAlertMessage] = useState('');
  
  // State for STAFF confirmation and submission
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // State for GROUP form flow
  const [groupAlertMessage, setGroupAlertMessage] = useState('');
  const [isGroupConfirmModalOpen, setIsGroupConfirmModalOpen] = useState(false);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupSubmitStatus, setGroupSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // State for logs view
  const [view, setView] = useState<'form' | 'logs'>('form');
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, staff] = await Promise.all([
        getDepartmentsByEvent(eventId),
        getStaffByEvent(eventId)
      ]);
      setDepartments(depts);
      setStaffList(staff);
    } catch (error) {
      console.error("Failed to fetch data for alert view", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoized lists for rendering
  const staffInSelectedDepartment = useMemo(() => {
    if (!selectedDepartment) return [];
    return staffList.filter(s => s.departmentId === selectedDepartment.id);
  }, [selectedDepartment, staffList]);

  const selectedStaffDetails = useMemo(() => {
    return staffList.filter(s => selectedStaffIds.has(s.id));
  }, [selectedStaffIds, staffList]);

  // Handlers for form flow
  const handleDepartmentSelect = (department: Department) => {
    setSelectedDepartment(department);
    setSelectedStaffIds(new Set()); // Reset staff selection
    setStep(2);
  };

  const handleStaffToggle = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };
  
  const handleBackToChoice = () => {
      resetStaffForm();
      resetGroupForm();
      setAlertType(null);
  };

  const handleProceedToMessage = () => {
    if (selectedStaffIds.size > 0) {
      setStep(3);
    }
  };

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (alertMessage.trim()) {
      setIsConfirmModalOpen(true);
    }
  };

  const handleOpenGroupConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (groupAlertMessage.trim()) {
      setIsGroupConfirmModalOpen(true);
    }
  };
  
  const resetStaffForm = () => {
      setStep(1);
      setSelectedDepartment(null);
      setSelectedStaffIds(new Set());
      setAlertMessage('');
      setIsConfirmModalOpen(false);
      setSubmitStatus('idle');
  };

  const resetGroupForm = () => {
    setGroupAlertMessage('');
    setIsGroupConfirmModalOpen(false);
    setGroupSubmitStatus('idle');
    setIsSubmittingGroup(false);
  };

  // Handler for STAFF final submission
  const handleConfirmAndSend = async () => {
    setIsSubmitting(true);
    setSubmitStatus('idle');

    const webhookUrl = 'https://webhook.triad3.io/webhook/emitiralerta-staffs';
    const targets = selectedStaffDetails.filter(s => s.phone); // Ensure staff has a phone number

    if(targets.length === 0) {
        setSubmitStatus('error');
        setIsSubmitting(false);
        return;
    }

    const requests = targets.map(staff => {
      const payload = {
        staffName: staff.name,
        staffPhone: staff.phone,
        alertMessage: alertMessage,
      };
      return fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    try {
      const responses = await Promise.all(requests);
      // Check if any request failed
      if (responses.some(res => !res.ok)) {
        throw new Error('Uma ou mais notificações falharam ao enviar.');
      }

      if (user && selectedDepartment) {
          await addAlertLog({
              eventId: eventId,
              senderUserId: user.id,
              departmentId: selectedDepartment.id,
              message: alertMessage,
              recipients: targets.map(s => ({
                  staffId: s.id,
                  staffName: s.name,
                  staffPhone: s.phone
              }))
          });
      }

      setSubmitStatus('success');
      setTimeout(() => {
        resetStaffForm();
        handleBackToChoice();
      }, 3000);
    } catch (error) {
      console.error("Failed to send alerts:", error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler for GROUP final submission
  const handleGroupAlertSend = async () => {
    setIsSubmittingGroup(true);
    setGroupSubmitStatus('idle');

    const webhookUrl = 'https://webhook.triad3.io/webhook/aca7d18d-8c37-49ae-92a4-03285bc6729a';
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: groupAlertMessage }),
      });

      if (!response.ok) {
        throw new Error('Webhook para grupo falhou.');
      }

      if (user) {
        await addAlertLog({
          eventId: eventId,
          senderUserId: user.id,
          message: groupAlertMessage,
          recipients: [{ staffId: 'GROUP', staffName: 'Alerta para Grupo', staffPhone: '' }],
        });
      }

      setGroupSubmitStatus('success');
      setTimeout(() => {
        resetGroupForm();
        handleBackToChoice();
      }, 3000);

    } catch (error) {
      console.error("Failed to send group alert:", error);
      setGroupSubmitStatus('error');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleViewLogs = async () => {
      setView('logs');
      setLogsLoading(true);
      try {
          const logsData = await getAlertLogsByEvent(eventId);
          setLogs(logsData);
      } catch (error) {
          console.error("Failed to load alert logs", error);
      } finally {
          setLogsLoading(false);
      }
  };

  const handleDownloadPdf = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Alertas Enviados", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Data/Hora", "Enviado por", "Departamento", "Mensagem", "Destinatários"];
    const tableRows: string[][] = [];

    logs.forEach(log => {
      const rowData = [
        new Date(log.createdAt).toLocaleString('pt-BR'),
        log.sender?.name || 'N/A',
        log.department?.name || 'Grupo',
        log.message,
        log.recipients.map(r => r.staffName).join(',\n')
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [18, 181, 229] },
    });
    
    const staffAlertCounts: { [key: string]: number } = {};
    logs.forEach(log => {
        log.recipients.forEach(recipient => {
            staffAlertCounts[recipient.staffName] = (staffAlertCounts[recipient.staffName] || 0) + 1;
        });
    });

    const summaryRows = Object.entries(staffAlertCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .map(([name, count]) => [name, count]);

    if (summaryRows.length > 0) {
        doc.setFontSize(14);
        doc.text("Total de Alertas Recebidos por Membro", 14, doc.autoTable.previous.finalY + 15);
        
        doc.autoTable({
            head: [["Membro da Equipe", "Total de Alertas"]],
            body: summaryRows,
            startY: doc.autoTable.previous.finalY + 22,
            theme: 'striped',
            headStyles: { fillColor: [44, 53, 71] },
        });
    }

    doc.save("relatorio_alertas_enviados.pdf");
  };

  // UI components
  const renderDepartmentStep = () => (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-center">Passo 1: Selecione um Departamento</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {departments.map(dept => (
          <button
            key={dept.id}
            onClick={() => handleDepartmentSelect(dept)}
            className="p-6 bg-secondary rounded-lg text-center font-semibold transition-transform transform hover:scale-105 hover:bg-secondary-hover"
          >
            {dept.name}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStaffStep = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Button onClick={handleBack} variant="secondary">Voltar</Button>
        <h3 className="text-xl font-semibold text-center">Passo 2: Selecione a Equipe</h3>
        <Button onClick={handleProceedToMessage} disabled={selectedStaffIds.size === 0}>
          Avançar
        </Button>
      </div>
      <p className="text-center text-text-secondary mb-4">Departamento: <span className="font-bold text-primary">{selectedDepartment?.name}</span></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {staffInSelectedDepartment.map(staff => {
          const isSelected = selectedStaffIds.has(staff.id);
          return (
            <button
              key={staff.id}
              onClick={() => handleStaffToggle(staff.id)}
              className={`relative p-3 rounded-lg text-left transition-all duration-200 ${isSelected ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary hover:bg-secondary-hover'}`}
            >
              <div className="flex items-center gap-3">
                <img src={staff.photoUrl} alt={staff.name} className="w-12 h-12 rounded-full object-cover"/>
                <div>
                  <p className="font-semibold">{staff.name}</p>
                  <p className="text-xs text-text-secondary">{staff.role || 'Sem cargo'}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  );

  const renderMessageStep = () => (
    <form onSubmit={handleOpenConfirmModal}>
      <div className="flex justify-between items-center mb-4">
        <Button type="button" onClick={handleBack} variant="secondary">Voltar</Button>
        <h3 className="text-xl font-semibold text-center">Passo 3: Escreva a Mensagem</h3>
      </div>
      <div className="mb-4 p-3 bg-secondary rounded-lg">
          <p className="text-sm text-text-secondary">Enviando para <span className="font-bold text-primary">{selectedStaffIds.size}</span> membro(s) do departamento <span className="font-bold text-primary">{selectedDepartment?.name}</span>.</p>
      </div>
      <textarea
        value={alertMessage}
        onChange={(e) => setAlertMessage(e.target.value)}
        rows={5}
        className="w-full p-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Digite sua mensagem de alerta aqui..."
        required
      />
      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={!alertMessage.trim()}>
          Revisar e Enviar
        </Button>
      </div>
    </form>
  );

  const renderGroupAlertForm = () => (
    <form onSubmit={handleOpenGroupConfirmModal}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-center">Mensagem para o Grupo</h3>
      </div>
      <textarea
        value={groupAlertMessage}
        onChange={(e) => setGroupAlertMessage(e.target.value)}
        rows={5}
        className="w-full p-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Digite a mensagem de alerta para todo o grupo aqui..."
        required
      />
      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={!groupAlertMessage.trim()}>
          Enviar para o Grupo
        </Button>
      </div>
    </form>
  );

  const renderLogsView = () => (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold">Logs de Envios de Alertas</h2>
            <div className="flex items-center gap-4">
                <Button 
                    variant="secondary" 
                    onClick={handleDownloadPdf} 
                    disabled={logs.length === 0}
                    className="text-sm py-2 px-3 flex items-center"
                >
                    <DownloadIcon />
                    Download PDF
                </Button>
                <Button variant="secondary" onClick={() => { setView('form'); handleBackToChoice(); }}>Voltar para Envio</Button>
            </div>
        </div>
        {logsLoading ? <LoadingSpinner /> : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="p-4 bg-secondary rounded-lg">
                        <div className="flex justify-between items-start text-sm mb-2 border-b border-border pb-2">
                            <div>
                                <p><span className="font-semibold text-text-secondary">Enviado por:</span> {log.sender?.name || 'Usuário desconhecido'}</p>
                                <p><span className="font-semibold text-text-secondary">Departamento:</span> {log.department?.name || 'Grupo'}</p>
                            </div>
                            <p className="font-semibold text-text-secondary">{new Date(log.createdAt).toLocaleString('pt-BR')}</p>
                        </div>
                        <p className="font-semibold mb-1">Mensagem:</p>
                        <p className="p-2 bg-background rounded-md text-sm whitespace-pre-wrap mb-3">{log.message}</p>
                        <p className="font-semibold mb-1 text-sm">Destinatários ({log.recipients.length}):</p>
                        <div className="text-xs text-text-secondary space-y-1">
                            {log.recipients.map(r => <p key={r.staffId}>- {r.staffName}</p>)}
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-text-secondary py-8">Nenhum alerta foi enviado para este evento ainda.</p>
                )}
            </div>
        )}
    </div>
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-4xl mx-auto">
        {view === 'form' ? (
            <>
                {alertType === null ? (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                             <h2 className="text-3xl font-bold text-center sm:text-left">Emitir Alerta 🚨</h2>
                             <Button variant="secondary" onClick={handleViewLogs}>
                                Logs de envios
                            </Button>
                        </div>
                        <div>
                             <h3 className="text-xl font-semibold mb-4 text-center">Para quem você deseja enviar o alerta?</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    onClick={() => setAlertType('staff')}
                                    className="p-8 bg-secondary rounded-lg text-center font-semibold text-lg transition-transform transform hover:scale-105 hover:bg-secondary-hover"
                                >
                                    Para um STAFF
                                </button>
                                <button
                                    onClick={() => setAlertType('group')}
                                    className="p-8 bg-secondary rounded-lg text-center font-semibold text-lg transition-transform transform hover:scale-105 hover:bg-secondary-hover"
                                >
                                    Para um GRUPO
                                </button>
                             </div>
                        </div>
                    </>
                ) : alertType === 'staff' ? (
                    <>
                        <div className="mb-4">
                            <Button variant="secondary" onClick={handleBackToChoice}>&larr; Voltar para seleção</Button>
                        </div>
                        {step === 1 && renderDepartmentStep()}
                        {step === 2 && renderStaffStep()}
                        {step === 3 && renderMessageStep()}
                    </>
                ) : ( // alertType === 'group'
                    <>
                        <div className="mb-4">
                           <Button variant="secondary" onClick={handleBackToChoice}>&larr; Voltar para seleção</Button>
                        </div>
                        {renderGroupAlertForm()}
                    </>
                )}
            </>
        ) : (
            renderLogsView()
        )}
        
        {/* Staff Alert Modal */}
        <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirmar Envio do Alerta">
            {submitStatus === 'success' ? (
                 <div className="text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-lg font-semibold">Alerta(s) enviado(s) com sucesso!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-primary">Departamento</h4>
                        <p>{selectedDepartment?.name}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-primary">Equipe Selecionada ({selectedStaffDetails.length})</h4>
                        <ul className="text-sm list-disc list-inside max-h-32 overflow-y-auto">
                            {selectedStaffDetails.map(s => <li key={s.id}>{s.name} {!s.phone && <span className="text-yellow-500 text-xs">(Sem Telefone)</span>}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-primary">Mensagem</h4>
                        <p className="p-2 bg-secondary rounded-md whitespace-pre-wrap">{alertMessage}</p>
                    </div>
                    {submitStatus === 'error' && <p className="text-red-500 text-center">Falha ao enviar os alertas. Verifique se os membros da equipe têm números de telefone válidos e tente novamente.</p>}
                    <div className="flex justify-end gap-4 pt-4">
                        <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)} disabled={isSubmitting}>
                            Editar
                        </Button>
                        <Button onClick={handleConfirmAndSend} disabled={isSubmitting}>
                            {isSubmitting ? <LoadingSpinner /> : 'Confirmar e Enviar'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>

        {/* Group Alert Modal */}
        <Modal isOpen={isGroupConfirmModalOpen} onClose={() => setIsGroupConfirmModalOpen(false)} title="Confirmar Envio para Grupo">
            {groupSubmitStatus === 'success' ? (
                 <div className="text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-lg font-semibold">Alerta para o grupo enviado com sucesso!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-primary">Destinatário</h4>
                        <p>Todo o Grupo</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-primary">Mensagem</h4>
                        <p className="p-2 bg-secondary rounded-md whitespace-pre-wrap">{groupAlertMessage}</p>
                    </div>
                    {groupSubmitStatus === 'error' && <p className="text-red-500 text-center">Falha ao enviar o alerta para o grupo.</p>}
                    <div className="flex justify-end gap-4 pt-4">
                        <Button variant="secondary" onClick={() => setIsGroupConfirmModalOpen(false)} disabled={isSubmittingGroup}>
                            Editar
                        </Button>
                        <Button onClick={handleGroupAlertSend} disabled={isSubmittingGroup}>
                            {isSubmittingGroup ? <LoadingSpinner /> : 'Confirmar e Enviar'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    </div>
  );
};

export default EmitirAlertaView;
