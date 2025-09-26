import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getDepartmentsByEvent, getStaffByEvent } from '../../services/api';
import { Department, Staff } from '../../types';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import Modal from '../Modal';

interface Props {
  eventId: string;
}

const EmitirAlertaView: React.FC<Props> = ({ eventId }) => {
  // State for data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // State for form flow
  const [step, setStep] = useState(1); // 1: Dept, 2: Staff, 3: Message
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [alertMessage, setAlertMessage] = useState('');
  
  // State for confirmation and submission
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
  
  const resetForm = () => {
      setStep(1);
      setSelectedDepartment(null);
      setSelectedStaffIds(new Set());
      setAlertMessage('');
      setIsConfirmModalOpen(false);
      setSubmitStatus('idle');
  };

  // Handler for final submission
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
      setSubmitStatus('success');
      setTimeout(() => {
        resetForm();
      }, 3000);
    } catch (error) {
      console.error("Failed to send alerts:", error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // UI components for each step
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center">Emitir Alerta para a Equipe 🚨</h2>
        {step === 1 && renderDepartmentStep()}
        {step === 2 && renderStaffStep()}
        {step === 3 && renderMessageStep()}
        
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
    </div>
  );
};

export default EmitirAlertaView;
