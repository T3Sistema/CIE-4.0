import React, { useState, useEffect, useCallback } from 'react';
import { getStaffByEvent, getTelaoRecipientsForEvent, setTelaoRecipientsForEvent } from '../../services/api';
import { Staff } from '../../types';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';

interface Props {
  eventId: string;
}

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const NotificationsManager: React.FC<Props> = ({ eventId }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffData, recipientIds] = await Promise.all([
        getStaffByEvent(eventId),
        getTelaoRecipientsForEvent(eventId),
      ]);
      setStaffList(staffData);
      setSelectedStaffIds(new Set(recipientIds));
    } catch (error) {
      console.error("Failed to fetch notification config:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        if (newSet.size < 2) {
          newSet.add(staffId);
        }
      }
      return newSet;
    });
  };
  
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await setTelaoRecipientsForEvent(eventId, Array.from(selectedStaffIds));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary">Notificações do Telão</h2>
        <p className="text-text-secondary mt-2 max-w-2xl mx-auto">
          Selecione até 2 membros da equipe para receberem a notificação quando um colaborador solicitar o telão para uma venda.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {staffList.length > 0 ? staffList.map(staff => {
          const isSelected = selectedStaffIds.has(staff.id);
          const isDisabled = !isSelected && selectedStaffIds.size >= 2;

          return (
            <button
              key={staff.id}
              onClick={() => handleToggleStaff(staff.id)}
              disabled={isDisabled}
              className={`relative p-4 rounded-lg text-left transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary ${
                isSelected ? 'bg-primary/10 border-2 border-primary' : 'bg-secondary hover:bg-secondary-hover border-2 border-transparent'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-4">
                <img src={staff.photoUrl || 'https://via.placeholder.com/150'} alt={staff.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-bold truncate">{staff.name}</p>
                  <p className="text-sm text-text-secondary">Cód: {staff.personalCode}</p>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-3 right-3 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <CheckIcon />
                </div>
              )}
            </button>
          )
        }) : (
          <p className="col-span-full text-text-secondary text-center py-8">Nenhum membro da equipe cadastrado neste evento.</p>
        )}
      </div>
      
      <div className="flex justify-end items-center gap-4 pt-4 border-t border-border">
        {saveSuccess && <p className="text-green-500 text-sm font-semibold animate-pulse">Configuração salva com sucesso!</p>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <LoadingSpinner /> : 'Salvar Seleção'}
        </Button>
      </div>
    </div>
  );
};

export default NotificationsManager;
