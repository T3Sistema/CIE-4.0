import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getVehiclesByCompany, 
    updateVehicle,
    getEventSalesData,
    sendTelaoNotification,
    getDepartmentsByEvent,
    submitCompanyCall
} from '../services/api';
import { Vehicle, Collaborator, CompanySalesData, ParticipantCompany, Department } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import ConfirmationModal from '../components/ConfirmationModal';
import SalesRankingModal from '../components/SalesRankingModal';

const CollaboratorPage: React.FC = () => {
  const { boothCode } = useParams<{ boothCode: string }>();
  const navigate = useNavigate();
  
  const [checkinInfo, setCheckinInfo] = useState<{ company: ParticipantCompany; collaborator: Collaborator; eventId: string; } | null>(null);
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isTelaoModalOpen, setIsTelaoModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [vehicleToUpdate, setVehicleToUpdate] = useState<Vehicle | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [salesData, setSalesData] = useState<CompanySalesData[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  
  // State for Company Call
  const [isCompanyCallModalOpen, setIsCompanyCallModalOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [observation, setObservation] = useState('');
  const [callSubmitting, setCallSubmitting] = useState(false);
  const [callSubmitStatus, setCallSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');


  useEffect(() => {
    const checkinInfoRaw = sessionStorage.getItem('collaboratorCheckinInfo');
    if (checkinInfoRaw) {
      try {
        const info = JSON.parse(checkinInfoRaw);
        setCheckinInfo(info);
        setCollaborator(info.collaborator);
      } catch (e) {
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [navigate]);
  
  useEffect(() => {
    const fetchInitialData = async () => {
      if (checkinInfo?.company.id) {
        setLoading(true);
        try {
          const vehiclesData = await getVehiclesByCompany(checkinInfo.company.id);
          setVehicles(vehiclesData);

          if(checkinInfo.company.canOpenCall) {
            const departmentsData = await getDepartmentsByEvent(checkinInfo.eventId);
            setDepartments(departmentsData);
            if (departmentsData.length > 0) {
              setSelectedDepartmentId(departmentsData[0].id);
            }
          }

        } catch (err) {
          setError('Falha ao carregar dados.');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchInitialData();
  }, [checkinInfo]);

  useEffect(() => {
    const fetchSalesData = async () => {
        if (checkinInfo?.eventId && checkinInfo.company.id) {
            setRankingLoading(true);
            try {
                const data = await getEventSalesData(checkinInfo.eventId);
                const companySalesData = data.filter(d => d.id === checkinInfo.company.id);
                setSalesData(companySalesData);
            } catch (e) {
                console.error("Failed to fetch sales data for collaborator", e);
            } finally {
                setRankingLoading(false);
            }
        }
    };
    fetchSalesData();
  }, [checkinInfo]);

  const soldVehicles = useMemo(() => {
    return vehicles
      .filter(v => v.status === 'Vendido')
      .sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
    });
  }, [vehicles]);

  const availableVehicles = useMemo(() => {
    return vehicles.filter(v => v.status === 'Disponível');
  }, [vehicles]);

  const handleOpenTelaoModal = () => {
    setIsTelaoModalOpen(true);
  };

  const handleOpenRankingModal = () => {
      setIsRankingModalOpen(true);
  };
  
  const handleMarkAsSold = (vehicle: Vehicle) => {
    setVehicleToUpdate(vehicle);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSold = async () => {
    if (!vehicleToUpdate || !checkinInfo || !collaborator) return;
    try {
      const { updatedAt, ...vehicleData } = vehicleToUpdate;
      await updateVehicle({ 
          ...vehicleData, 
          status: 'Vendido',
          soldByCollaboratorId: collaborator.id
      });
      
      await sendTelaoNotification(
          checkinInfo.eventId,
          vehicleToUpdate,
          collaborator,
          checkinInfo.company
      );

      const [updatedVehicles, updatedSalesData] = await Promise.all([
          getVehiclesByCompany(checkinInfo.company.id),
          getEventSalesData(checkinInfo.eventId)
      ]);
      setVehicles(updatedVehicles);
      const companySalesData = updatedSalesData.filter(d => d.id === checkinInfo.company.id);
      setSalesData(companySalesData);
    } catch (error) {
      console.error("Failed to update vehicle status", error);
    } finally {
      setIsConfirmModalOpen(false);
      setVehicleToUpdate(null);
    }
  };
  
  const handleOpenCompanyCallModal = () => {
    setObservation('');
    setCallSubmitStatus('idle');
    if (departments.length > 0) {
        setSelectedDepartmentId(departments[0].id);
    }
    setIsCompanyCallModalOpen(true);
  };
  
  const handleCompanyCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinInfo || !collaborator || !selectedDepartmentId || !observation) return;
    setCallSubmitting(true);
    setCallSubmitStatus('idle');
    try {
        const department = departments.find(d => d.id === selectedDepartmentId);
        if (!department) throw new Error("Departamento não encontrado");

        await submitCompanyCall({
            eventId: checkinInfo.eventId,
            participantCompanyId: checkinInfo.company.id,
            departmentId: department.id,
            collaboratorName: collaborator.name,
            observation: observation,
            companyName: checkinInfo.company.name,
            departmentName: department.name,
            boothCode: checkinInfo.company.boothCode,
        });
        setCallSubmitStatus('success');
        setTimeout(() => setIsCompanyCallModalOpen(false), 2000);
    } catch (err) {
        setCallSubmitStatus('error');
        console.error("Failed to submit company call:", err);
    } finally {
        setCallSubmitting(false);
    }
  };

  if (loading || !collaborator) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto">
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-primary">Painel do Colaborador</h1>
            <p className="text-text-secondary">Empresa: <span className="font-semibold text-text">{checkinInfo?.company.name}</span></p>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-card p-6 rounded-lg shadow-lg text-center flex flex-col justify-center">
                <h2 className="text-lg font-semibold text-text-secondary">Total de Veículos Vendidos</h2>
                <p className="text-5xl font-bold text-primary mt-2">{soldVehicles.length}</p>
            </div>
            <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col justify-center items-center gap-4">
                <Button onClick={handleOpenTelaoModal} className="w-full text-lg py-3">
                    Solicitar Telão
                </Button>
                <Button onClick={handleOpenRankingModal} className="w-full text-lg py-3">
                    Ranking de Vendas
                </Button>
                {checkinInfo?.company.canOpenCall && (
                    <Button onClick={handleOpenCompanyCallModal} variant="secondary" className="w-full text-lg py-3">
                        Abrir Chamado
                    </Button>
                )}
            </div>
        </div>

        <div>
            <h2 className="text-2xl font-bold mb-4">Histórico de Vendas</h2>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {soldVehicles.length > 0 ? (
                    soldVehicles.map(vehicle => (
                        <div key={vehicle.id} className="p-4 bg-card rounded-lg flex items-center gap-4">
                            <img src={vehicle.photoUrl} alt={vehicle.marca} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                            <div className="flex-grow">
                                <p className="font-bold text-text">{vehicle.marca}</p>
                                <p className="text-sm text-text-secondary">{vehicle.model}</p>
                                <p className="text-sm text-text-secondary">Placa: {vehicle.placa || 'N/D'}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-primary">Vendido em:</p>
                                <p className="text-sm text-text-secondary">
                                    {vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleDateString('pt-BR') : 'Data indisponível'}
                                </p>
                                <p className="text-xs text-text-secondary">
                                    {vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 bg-card rounded-lg">
                        <p className="text-text-secondary">Nenhum veículo vendido ainda.</p>
                    </div>
                )}
            </div>
        </div>

        <Modal isOpen={isTelaoModalOpen} onClose={() => setIsTelaoModalOpen(false)} title="Solicitar Telão: Marcar Veículo Vendido">
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {
                    availableVehicles.length > 0 ? (
                        availableVehicles.map(vehicle => (
                            <div key={vehicle.id} className="p-4 bg-secondary rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <img src={vehicle.photoUrl} alt={vehicle.marca} className="w-16 h-16 rounded-lg object-cover" />
                                    <div>
                                        <p className="font-bold text-text">{vehicle.marca}</p>
                                        <p className="text-sm text-text-secondary">{vehicle.model}</p>
                                        <p className="text-sm text-text-secondary">Placa: {vehicle.placa || 'N/D'}</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleMarkAsSold(vehicle)}
                                    className="w-full sm:w-auto flex-shrink-0"
                                >
                                    VENDIDO
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-text-secondary py-8">Nenhum veículo disponível no estoque.</p>
                    )
                }
            </div>
        </Modal>
        
        {rankingLoading ? <LoadingSpinner /> : (
            <SalesRankingModal 
                isOpen={isRankingModalOpen}
                onClose={() => setIsRankingModalOpen(false)}
                salesData={salesData}
            />
        )}
        
        <Modal isOpen={isCompanyCallModalOpen} onClose={() => setIsCompanyCallModalOpen(false)} title="Abrir Chamado para a Organização">
            {callSubmitStatus === 'success' ? (
                <div className="text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-lg font-semibold">Chamado aberto com sucesso!</p>
                </div>
            ) : (
                <form onSubmit={handleCompanyCallSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="department-select" className="block text-sm font-medium mb-1 text-text">Selecione o Departamento</label>
                        <select
                            id="department-select"
                            value={selectedDepartmentId}
                            onChange={(e) => setSelectedDepartmentId(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            required
                        >
                            {departments.map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="observation" className="block text-sm font-medium mb-1 text-text">Observação</label>
                        <textarea
                            id="observation"
                            value={observation}
                            onChange={(e) => setObservation(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Descreva o motivo do seu chamado aqui..."
                            required
                        />
                    </div>
                    {callSubmitStatus === 'error' && <p className="text-red-500 text-sm text-center">Ocorreu um erro ao enviar o chamado. Tente novamente.</p>}
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsCompanyCallModalOpen(false)} disabled={callSubmitting}>Cancelar</Button>
                        <Button type="submit" disabled={callSubmitting}>
                            {callSubmitting ? <LoadingSpinner /> : 'Enviar Chamado'}
                        </Button>
                    </div>
                </form>
            )}
        </Modal>

        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={handleConfirmSold}
            title="Confirmar Venda"
            message={`Você confirma a venda do veículo "${vehicleToUpdate?.marca} - ${vehicleToUpdate?.model}"? Esta ação não pode ser desfeita.`}
            confirmText="Sim, confirmo"
        />
    </div>
  );
};

export default CollaboratorPage;