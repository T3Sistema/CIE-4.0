
import React, { useState, useEffect, useCallback } from 'react';
import { getParticipantCompaniesByEvent, updateParticipantCompany } from '../../services/api';
import { ParticipantCompany } from '../../types';
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

const CompanyCallManager: React.FC<Props> = ({ eventId }) => {
  const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companiesData = await getParticipantCompaniesByEvent(eventId);
      setCompanies(companiesData);
      const initialSelected = new Set(
        companiesData.filter(c => c.canOpenCall).map(c => c.id)
      );
      setSelectedCompanyIds(initialSelected);
    } catch (error) {
      console.error("Failed to fetch company call config:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleCompany = (companyId: string) => {
    setSelectedCompanyIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(companyId)) {
        newSet.delete(companyId);
      } else {
        newSet.add(companyId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updatePromises: Promise<any>[] = [];
      companies.forEach(company => {
        const isCurrentlySelected = selectedCompanyIds.has(company.id);
        const wasInitiallySelected = !!company.canOpenCall;

        if (isCurrentlySelected !== wasInitiallySelected) {
          updatePromises.push(updateParticipantCompany({ ...company, canOpenCall: isCurrentlySelected }));
        }
      });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchData();
    } catch (error) {
      console.error("Failed to save company call permissions:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary">Chamados (Empresas)</h2>
        <p className="text-text-secondary mt-2 max-w-2xl mx-auto">
          Selecione as empresas que terão permissão para abrir chamados diretamente para os departamentos da organização.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {companies.length > 0 ? companies.map(company => {
          const isSelected = selectedCompanyIds.has(company.id);
          return (
            <button
              key={company.id}
              onClick={() => handleToggleCompany(company.id)}
              className={`relative p-4 rounded-lg text-left transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary ${
                isSelected ? 'bg-primary/10 border-2 border-primary' : 'bg-secondary hover:bg-secondary-hover border-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src={company.logoUrl || 'https://via.placeholder.com/150'} alt={company.name} className="w-16 h-16 rounded-md object-contain p-1 bg-white flex-shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-bold truncate">{company.name}</p>
                  <p className="text-sm text-text-secondary">Cód: {company.boothCode}</p>
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
          <p className="col-span-full text-text-secondary text-center py-8">Nenhuma empresa participante cadastrada neste evento.</p>
        )}
      </div>
      
      <div className="flex justify-end items-center gap-4 pt-4 border-t border-border">
        {saveSuccess && <p className="text-green-500 text-sm font-semibold animate-pulse">Permissões salvas com sucesso!</p>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <LoadingSpinner /> : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
};

export default CompanyCallManager;