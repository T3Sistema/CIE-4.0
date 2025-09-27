

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    getReportButtonsForBooth, 
    submitReport, 
    validateCheckin, 
    getButtonConfigs, 
    submitSalesCheckin, 
    getDepartmentsByEvent, 
    getStaffByEvent, 
    getPendingTasksForStaff, 
    apiCompleteTaskActivity, 
    getReportsByEvent, 
    getParticipantCompaniesByEvent, 
    getStaffActivity,
    getVehiclesByCompany,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    uploadImage,
    apiBulkAddVehicles,
    addStockMovement,
    getStockMovementsByCompany,
    getPendingCompanyCallsForStaff,
    resolveCompanyCall,
    getPendingTelaoRequestsForEvent,
    resolveTelaoRequest,
    getCollaboratorsByCompany,
    sendTelaoNotification,
    getDetailedSalesByEvent
} from '../services/api';
import { ReportButtonConfig, ReportType, Department, Staff, AssignedTask, ReportSubmission, ParticipantCompany, StaffActivity, Vehicle, StockMovement, CompanyCall, TelaoRequest, Collaborator } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import Modal from '../components/Modal';
import Input from '../components/Input';
import ConfirmationModal from '../components/ConfirmationModal';

const MedalIcon: React.FC<{ position: number }> = ({ position }) => {
    const medals: { [key: number]: string } = {
        1: '🥇',
        2: '🥈',
        3: '🥉',
    };
    const medal = medals[position];

    if (!medal) return null;

    return (
        <span className="ml-2 flex-shrink-0 text-2xl" role="img" aria-label={`Medalha de ${position}º lugar`}>
            {medal}
        </span>
    );
};

const DEFAULT_VEHICLE_PHOTO = 'https://ngukhhydpltectxrmvot.supabase.co/storage/v1/object/public/imagens/WhatsApp%20Image%202025-09-12%20at%2000.14.26.jpeg';

// FIX: Added missing 'status' property to align with the Vehicle type definition.
const emptyVehicle: Omit<Vehicle, 'id' | 'createdAt'> = {
  marca: '',
  model: '',
  placa: '',
  photoUrl: DEFAULT_VEHICLE_PHOTO,
  companyId: '',
  status: 'Disponível'
};

interface DetailedSale {
  marca: string;
  model: string;
  placa?: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    logoUrl?: string;
  } | null;
  collaborator: {
    id: string;
    name: string;
    photoUrl?: string;
    collaboratorCode: string;
  } | null;
}

const InformesPage: React.FC = () => {
  const { boothCode } = useParams<{ boothCode: string }>();
  const navigate = useNavigate();
  
  const [checkinInfo, setCheckinInfo] = useState<{staffName: string, eventId: string, personalCode: string, departmentId?: string, companyName: string, staffId: string, companyId: string} | null>(null);
  const [allButtons, setAllButtons] = useState<ReportButtonConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for report submission modal
  const [selectedButton, setSelectedButton] = useState<ReportButtonConfig | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [primaryResponse, setPrimaryResponse] = useState('');
  const [checklistSelection, setChecklistSelection] = useState<string[]>([]);
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean | null>(null);
  const [respondedButtonIds, setRespondedButtonIds] = useState<string[]>([]);

  // State for booth switching modal
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [newBoothCode, setNewBoothCode] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');

  // State for Sales Check-in
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [salesCollaborators, setSalesCollaborators] = useState<Collaborator[]>([]);
  const [salesAvailableVehicles, setSalesAvailableVehicles] = useState<Vehicle[]>([]);
  const [selectedSaleCollaboratorId, setSelectedSaleCollaboratorId] = useState<string>('');
  const [selectedSaleVehicleId, setSelectedSaleVehicleId] = useState<string>('');
  const [salesDataLoading, setSalesDataLoading] = useState(false);
  const [salesVehicleSearch, setSalesVehicleSearch] = useState('');
  const [salesSubmitting, setSalesSubmitting] = useState(false);
  const [salesSubmitStatus, setSalesSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // FIX: Declare state to store staff IDs with permission for sales check-in.
  const [salesCheckinStaffIds, setSalesCheckinStaffIds] = useState<string[]>([]);

  // State for Notification Call
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationStep, setNotificationStep] = useState<'department' | 'staff' | 'reason'>('department');
  const [selectedNotificationDeptId, setSelectedNotificationDeptId] = useState<string | null>(null);
  const [selectedNotificationStaff, setSelectedNotificationStaff] = useState<Staff | null>(null);
  const [notificationReason, setNotificationReason] = useState('');
  // FIX: Declare state to store staff IDs with permission for notify calls.
  const [notifyCallStaffIds, setNotifyCallStaffIds] = useState<string[]>([]);

  // State for Assigned Tasks
  const [pendingTasks, setPendingTasks] = useState<AssignedTask[]>([]);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [taskCompleting, setTaskCompleting] = useState<string | null>(null);
  
  // State for Ranking Modal
  const [isRankingModalOpen, setIsRankingModalOpen] = useState(false);
  const [allEventReports, setAllEventReports] = useState<ReportSubmission[]>([]);
  const [allEventCompanies, setAllEventCompanies] = useState<ParticipantCompany[]>([]);
  const [staffActivities, setStaffActivities] = useState<StaffActivity[]>([]);
  
  // State for Vehicle Stock Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState<Omit<Vehicle, 'id' | 'createdAt'> | Vehicle>(emptyVehicle);
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [isConfirmVehicleDeleteOpen, setIsConfirmVehicleDeleteOpen] = useState(false);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');

  // State for Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // State for Stock Control
  const [stockControlStaffIds, setStockControlStaffIds] = useState<string[]>([]);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockView, setStockView] = useState<'menu' | 'venda' | 'teste_drive'>('menu');
  const [stockSubmitting, setStockSubmitting] = useState<string | null>(null); // vehicle.id
  const [stockSubmitStatus, setStockSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastSubmittedVehicle, setLastSubmittedVehicle] = useState<{id: string, type: 'Venda' | 'Teste Drive'} | null>(null);
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // State for Company Calls
  const [pendingCompanyCalls, setPendingCompanyCalls] = useState<CompanyCall[]>([]);
  const [isCallsModalOpen, setIsCallsModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [currentCallToResolve, setCurrentCallToResolve] = useState<CompanyCall | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [resolvingCall, setResolvingCall] = useState(false);
  
  // State for Telão Requests
  const [pendingTelaoRequests, setPendingTelaoRequests] = useState<TelaoRequest[]>([]);
  const [isTelaoModalOpen, setIsTelaoModalOpen] = useState(false);
  const [isResolveTelaoModalOpen, setIsResolveTelaoModalOpen] = useState(false);
  const [currentTelaoToResolve, setCurrentTelaoToResolve] = useState<TelaoRequest | null>(null);
  const [telaoFeedbackText, setTelaoFeedbackText] = useState('');
  const [resolvingTelao, setResolvingTelao] = useState(false);

  // Refs for camera functionality
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

    // State for Sold Vehicles Report
    const [isSoldVehiclesModalOpen, setIsSoldVehiclesModalOpen] = useState(false);
    const [soldVehicles, setSoldVehicles] = useState<DetailedSale[]>([]);
    const [soldVehiclesLoading, setSoldVehiclesLoading] = useState(false);
    const [soldVehiclesFilter, setSoldVehiclesFilter] = useState<'my_booth' | 'all_booths'>('my_booth');

  useEffect(() => {
    let eventIdForFetch: string | null = null;
    let staffIdForFetch: string | null = null;

    const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
    if (checkinInfoRaw) {
      try {
        const info = JSON.parse(checkinInfoRaw);
        eventIdForFetch = info.eventId || null;
        staffIdForFetch = info.staffId || null;
        setCheckinInfo({
            staffName: info.staffName || '',
            eventId: info.eventId || '',
            personalCode: info.personalCode || '',
            departmentId: info.departmentId,
            companyName: info.companyName || '',
            staffId: info.staffId || '',
            companyId: info.companyId || ''
        });
      } catch (e) {
        console.error("Failed to parse checkinInfo from sessionStorage", e);
        navigate('/');
      }
    } else {
        navigate('/');
    }
    
    setRespondedButtonIds([]);

    const fetchInitialData = async () => {
      if (!boothCode || !eventIdForFetch || !staffIdForFetch) return;
      try {
        setLoading(true);
        const [companyButtons, allSystemButtons, depts, staff, tasks, reports, companies, activities] = await Promise.all([
            getReportButtonsForBooth(boothCode),
            getButtonConfigs(),
            getDepartmentsByEvent(eventIdForFetch),
            getStaffByEvent(eventIdForFetch),
            getPendingTasksForStaff(staffIdForFetch, eventIdForFetch),
            getReportsByEvent(eventIdForFetch),
            getParticipantCompaniesByEvent(eventIdForFetch),
            getStaffActivity(staffIdForFetch, eventIdForFetch)
        ]);
        setPendingTasks(tasks);
        setDepartments(depts);
        setAllStaff(staff);
        setAllEventReports(reports);
        setAllEventCompanies(companies);
        setStaffActivities(activities);

        const buttonsMap = new Map<string, ReportButtonConfig>();
        companyButtons.forEach(btn => buttonsMap.set(btn.id, btn));
        allSystemButtons.forEach(btn => {
            if (!buttonsMap.has(btn.id)) {
                buttonsMap.set(btn.id, btn);
            }
        });

        const salesConfigs = allSystemButtons.filter(b => b.label === '__SALES_CHECKIN_CONFIG__');
        setSalesCheckinStaffIds(salesConfigs.map(c => c.staffId).filter((id): id is string => !!id));

        const notifyCallConfigs = allSystemButtons.filter(b => b.label === '__NOTIFY_CALL_CONFIG__' && b.type === ReportType.NOTIFY_CALL);
        setNotifyCallStaffIds(notifyCallConfigs.map(c => c.staffId).filter((id): id is string => !!id));
        
        const stockControlConfigs = allSystemButtons.filter(b => b.label === '__STOCK_CONTROL_CONFIG__');
        setStockControlStaffIds(stockControlConfigs.map(c => c.staffId).filter((id): id is string => !!id));

        setAllButtons(Array.from(buttonsMap.values()));
      } catch (err) {
        setError('Falha ao carregar as ações.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [boothCode, navigate]);

  useEffect(() => {
    const fetchCalls = async () => {
        if (checkinInfo?.eventId && checkinInfo?.departmentId) {
            try {
                const calls = await getPendingCompanyCallsForStaff(checkinInfo.eventId, checkinInfo.departmentId);
                setPendingCompanyCalls(calls);
            } catch (e) {
                console.error("Failed to fetch pending calls", e);
            }
        }
    }
    fetchCalls(); // Initial fetch
    const intervalId = setInterval(fetchCalls, 15000); // Poll every 15 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, [checkinInfo]);
  
  useEffect(() => {
    const fetchTelaoRequests = async () => {
        if (checkinInfo?.eventId) {
            try {
                const requests = await getPendingTelaoRequestsForEvent(checkinInfo.eventId);
                setPendingTelaoRequests(requests);
            } catch (e) {
                console.error("Failed to fetch pending telão requests", e);
            }
        }
    }
    fetchTelaoRequests();
    const intervalId = setInterval(fetchTelaoRequests, 15000);

    return () => clearInterval(intervalId);
  }, [checkinInfo]);

  const visibleButtons = useMemo(() => {
    if (!checkinInfo || !checkinInfo.staffId) return [];
    
    return allButtons.filter(button => 
        button.label !== '__SALES_CHECKIN_CONFIG__' &&
        button.label !== '__NOTIFY_CALL_CONFIG__' &&
        !button.label.startsWith('__') && // Hide all internal config buttons
        !respondedButtonIds.includes(button.id) &&
        (button.staffId === checkinInfo.staffId || (!button.staffId && (!button.departmentId || button.departmentId === checkinInfo.departmentId)))
    );
  }, [allButtons, checkinInfo, respondedButtonIds]);
  
  const rankingData = useMemo(() => {
    if (allEventReports.length === 0 || allEventCompanies.length === 0) return [];

    const companyInfoMap = allEventCompanies.reduce((acc, company) => {
        acc[company.boothCode] = { name: company.name, logoUrl: company.logoUrl };
        return acc;
    }, {} as Record<string, { name: string, logoUrl?: string }>);
    
    const counts = allEventReports.reduce((acc, report) => {
      acc[report.boothCode] = (acc[report.boothCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([boothCode, value]) => ({
        label: companyInfoMap[boothCode]?.name || boothCode,
        value,
        logoUrl: companyInfoMap[boothCode]?.logoUrl,
      }))
      .sort((a, b) => b.value - a.value);
  }, [allEventReports, allEventCompanies]);

  const totalActivitiesCount = useMemo(() => {
    if (!staffActivities) return 0;
    // Filter out "task assigned" activities, as they are not actions performed by the staff yet.
    return staffActivities.filter(a => !a.description.startsWith('Tarefa atribuída:')).length;
  }, [staffActivities]);


  // Effect to trigger webhook when all buttons are completed
  useEffect(() => {
    const sendCompletionWebhook = async () => {
        if (checkinInfo && boothCode) {
            try {
                const payload = {
                    staffName: checkinInfo.staffName,
                    boothCode: boothCode,
                    companyName: checkinInfo.companyName,
                };
                await fetch('https://webhook.triad3.io/webhook/notificar-empesa-cie', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error("Failed to send completion webhook:", error);
            }
        }
    };

    if (!loading && allButtons.length > 0 && respondedButtonIds.length > 0 && visibleButtons.length === 0) {
        sendCompletionWebhook();
    }
  }, [visibleButtons, allButtons, respondedButtonIds, checkinInfo, boothCode, loading]);


  const handleButtonClick = (button: ReportButtonConfig) => {
    setSelectedButton(button);
    setSubmissionSuccess(null);
    setPrimaryResponse('');
    setFollowUpResponse('');
    setChecklistSelection([]);
    setIsReportModalOpen(true);
  };

  const openNotifyCallModal = () => {
    const notifyButtonConfig: ReportButtonConfig = {
        id: '__NOTIFY_CALL_CONFIG__',
        label: 'Abrir Chamado',
        question: '',
        type: ReportType.NOTIFY_CALL,
    };
    setSelectedButton(notifyButtonConfig);
    setSubmissionSuccess(null);
    setNotificationStep('department');
    setSelectedNotificationDeptId(null);
    setSelectedNotificationStaff(null);
    setNotificationReason('');
    setIsNotificationModalOpen(true);
  };

  const handleModalClose = useCallback(() => {
    setIsReportModalOpen(false);
    setIsNotificationModalOpen(false);
    setSelectedButton(null);
  }, []);
  
  const handleExit = () => {
    sessionStorage.removeItem('checkinInfo');
    navigate('/');
  }
  
  const handleChecklistChange = (value: string) => {
    setChecklistSelection(prev =>
        prev.includes(value)
            ? prev.filter(item => item !== value)
            : [...prev, value]
    );
  };


  const handleSwitchBooth = async () => {
    if (!newBoothCode || !checkinInfo?.personalCode) {
        setSwitchError('Por favor, insira o código do estande.');
        return;
    }
    setSwitching(true);
    setSwitchError('');
    try {
        const { staff, event, company } = await validateCheckin(newBoothCode, checkinInfo.personalCode);
        sessionStorage.setItem('checkinInfo', JSON.stringify({
            boothCode: newBoothCode.toUpperCase(),
            companyName: company.name,
            companyId: company.id,
            personalCode: checkinInfo.personalCode,
            staffName: staff.name,
            staffPhotoUrl: staff.photoUrl,
            eventId: event.id,
            departmentId: staff.departmentId,
            staffId: staff.id,
        }));
        setIsSwitchModalOpen(false);
        setNewBoothCode('');
        navigate(`/informes/${newBoothCode.toUpperCase()}`);
    } catch (err) {
        setSwitchError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
        setSwitching(false);
    }
  };

  const openSalesCheckinModal = async () => {
    if (!checkinInfo) return;
    setIsSalesModalOpen(true);
    setSalesDataLoading(true);
    setSalesSubmitStatus('idle');
    setSelectedSaleCollaboratorId('');
    setSelectedSaleVehicleId('');
    setSalesVehicleSearch('');
    try {
        const [collaboratorsData, vehiclesData] = await Promise.all([
            getCollaboratorsByCompany(checkinInfo.companyId),
            getVehiclesByCompany(checkinInfo.companyId)
        ]);
        setSalesCollaborators(collaboratorsData);
        setSalesAvailableVehicles(vehiclesData.filter(v => v.status === 'Disponível'));
        if (collaboratorsData.length > 0) {
            setSelectedSaleCollaboratorId(collaboratorsData[0].id);
        }
    } catch (error) {
        console.error("Failed to load data for sales check-in", error);
        setError("Falha ao carregar dados para check-in de vendas.");
    } finally {
        setSalesDataLoading(false);
    }
  };

  const filteredSalesVehicles = useMemo(() => {
    if (!salesVehicleSearch) {
        return salesAvailableVehicles;
    }
    return salesAvailableVehicles.filter(v => 
        (v.placa && v.placa.toUpperCase().includes(salesVehicleSearch.toUpperCase())) ||
        v.marca.toLowerCase().includes(salesVehicleSearch.toLowerCase()) ||
        v.model.toLowerCase().includes(salesVehicleSearch.toLowerCase())
    );
  }, [salesAvailableVehicles, salesVehicleSearch]);

  const handleSubmitSalesCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinInfo || !boothCode || !selectedSaleCollaboratorId || !selectedSaleVehicleId) {
        setSalesSubmitStatus('error');
        return;
    };

    setSalesSubmitting(true);
    setSalesSubmitStatus('idle');

    const vehicleToSell = salesAvailableVehicles.find(v => v.id === selectedSaleVehicleId);
    const collaborator = salesCollaborators.find(c => c.id === selectedSaleCollaboratorId);
    const companyInfo = allEventCompanies.find(c => c.id === checkinInfo.companyId);

    if (!vehicleToSell || !collaborator || !companyInfo) {
        setSalesSubmitStatus('error');
        setSalesSubmitting(false);
        return;
    }

    try {
        const updatedVehicle = await updateVehicle({ 
          ...vehicleToSell, 
          status: 'Vendido',
          soldByCollaboratorId: collaborator.id
        });
        
        // Fire and forget webhook for bd-sheet
        try {
            const webhookPayload = {
                'Veículo (Marca)': updatedVehicle.marca,
                'Veículo (Modelo)': updatedVehicle.model,
                'Placa': updatedVehicle.placa || 'N/D',
                'Loja': companyInfo.name,
                'Vendedor': collaborator.name,
                'Data da Venda': updatedVehicle.updatedAt 
                    ? new Date(updatedVehicle.updatedAt).toLocaleString('pt-BR') 
                    : new Date().toLocaleString('pt-BR'),
            };
            fetch('https://webhook.triad3.io/webhook/bd-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            }).catch(webhookError => {
                console.error("Failed to send bd-sheet webhook (non-critical):", webhookError);
            });
        } catch (e) {
             console.error("Error preparing bd-sheet webhook:", e);
        }

        await sendTelaoNotification(
            checkinInfo.eventId,
            vehicleToSell,
            collaborator,
            companyInfo
        );

        const logDescription = `Registrou venda do veículo ${vehicleToSell.marca} ${vehicleToSell.model} (Placa: ${vehicleToSell.placa || 'N/D'}) pelo vendedor ${collaborator.name}.`;
        await submitReport({
            eventId: checkinInfo.eventId,
            boothCode,
            staffName: checkinInfo.staffName,
            reportLabel: 'Check-in de Venda',
            response: logDescription,
        });

        setSalesSubmitStatus('success');
        setSalesAvailableVehicles(prev => prev.filter(v => v.id !== selectedSaleVehicleId));
        setSelectedSaleVehicleId('');

        setTimeout(() => {
            setIsSalesModalOpen(false);
        }, 2000);

    } catch (error) {
        console.error("Failed to process sale check-in", error);
        setSalesSubmitStatus('error');
    } finally {
        setSalesSubmitting(false);
    }
  };


  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedButton || !boothCode || !checkinInfo) return;
    
    setSubmitting(true);
    setSubmissionSuccess(null);

    let finalResponse = primaryResponse;

    if (selectedButton.type === ReportType.CHECKLIST) {
        finalResponse = checklistSelection.length > 0 ? checklistSelection.join(', ') : 'Nenhum item selecionado.';
    } else if (
      selectedButton.type === ReportType.YES_NO && 
      selectedButton.followUp &&
      primaryResponse === selectedButton.followUp.triggerValue &&
      followUpResponse
    ) {
      finalResponse = `${primaryResponse} - ${selectedButton.followUp.question}: ${followUpResponse}`;
    }

    try {
      await submitReport({
        eventId: checkinInfo.eventId,
        boothCode,
        staffName: checkinInfo.staffName,
        reportLabel: selectedButton.label,
        response: finalResponse,
      });
      setSubmissionSuccess(true);
      setRespondedButtonIds(prev => [...prev, selectedButton.id]);
      setTimeout(() => {
        handleModalClose();
      }, 1500);
    } catch (err) {
      setSubmissionSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNotificationCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedButton || !boothCode || !checkinInfo || !selectedNotificationStaff) return;

    setSubmitting(true);
    setSubmissionSuccess(null);

    try {
        const webhookPayload = {
            staffName: checkinInfo.staffName,
            companyName: checkinInfo.companyName,
            targetStaffPhone: selectedNotificationStaff.phone,
            targetStaffName: selectedNotificationStaff.name,
            reason: notificationReason,
        };
        const webhookResponse = await fetch('https://webhook.triad3.io/webhook/notificar-chamado-cie', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
        });
        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            throw new Error(`Falha ao enviar notificação: ${errorText}`);
        }

        const reportResponse = `Chamado aberto para ${selectedNotificationStaff.name} (Depto: ${departments.find(d => d.id === selectedNotificationStaff.departmentId)?.name || 'N/A'}). Motivo: "${notificationReason}"`;
        await submitReport({
            eventId: checkinInfo.eventId,
            boothCode,
            staffName: checkinInfo.staffName,
            reportLabel: selectedButton.label,
            response: reportResponse,
        });

        setSubmissionSuccess(true);
        if (selectedButton.id !== '__NOTIFY_CALL_CONFIG__') {
          setRespondedButtonIds(prev => [...prev, selectedButton.id]);
        }
        setTimeout(() => {
            handleModalClose();
        }, 1500);

    } catch (err) {
        setSubmissionSuccess(false);
        console.error(err);
    } finally {
        setSubmitting(false);
    }
  };

  const handleCompleteTask = async (task: AssignedTask) => {
      if (!checkinInfo || !task.boothCode) {
          console.error("Missing checkin info or booth code for task completion.");
          return;
      }
      setTaskCompleting(task.id);
      try {
          const taskDetails = parseTaskDetails(task.description);
          await apiCompleteTaskActivity(checkinInfo.staffId, task.description, {
              eventId: checkinInfo.eventId,
              boothCode: task.boothCode,
              staffName: checkinInfo.staffName,
              actionLabel: `[TAREFA] ${task.actionLabel}`,
              actionResponse: taskDetails || 'Tarefa Concluída.'
          });
          // Refresh list
          const updatedTasks = await getPendingTasksForStaff(checkinInfo.staffId, checkinInfo.eventId);
          setPendingTasks(updatedTasks);
      } catch (error) {
          console.error("Failed to complete task", error);
          // TODO: Show error message to user, e.g., using a state for toast notifications
      } finally {
          setTaskCompleting(null);
      }
  };

  const parseTaskDetails = (description: string): string | null => {
    const match = description.match(/Descrição: (.*)$/s);
    return match ? match[1] : null;
  };
  
  // --- Vehicle Functions ---
    const handleOpenVehicleModal = async () => {
        if (!checkinInfo) return;
        setIsVehicleModalOpen(true);
        setVehiclesLoading(true);
        try {
            const data = await getVehiclesByCompany(checkinInfo.companyId);
            setVehicles(data);
            setCurrentVehicle({ ...emptyVehicle, companyId: checkinInfo.companyId });
        } catch (error) {
            console.error("Failed to fetch vehicles", error);
        } finally {
            setVehiclesLoading(false);
        }
    };

    const handleCloseVehicleModal = () => {
        stopCamera();
        setIsVehicleModalOpen(false);
        setVehicles([]);
    };

    const handleVehicleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const finalValue = name === 'placa' ? value.toUpperCase() : value;
        setCurrentVehicle(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleVehiclePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setVehiclePhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentVehicle(prev => ({ ...prev, photoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditVehicle = (vehicle: Vehicle) => {
        setCurrentVehicle(vehicle);
        setIsEditingVehicle(true);
        setVehiclePhotoFile(null);
        document.getElementById('vehicle-modal-content-staff')?.scrollTo(0, 0);
    };

    const handleCancelEditVehicle = () => {
        if (checkinInfo) {
            setCurrentVehicle({ ...emptyVehicle, companyId: checkinInfo.companyId });
        }
        setIsEditingVehicle(false);
        setVehiclePhotoFile(null);
    };

    const handleVehicleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkinInfo) return;
        setIsSubmittingVehicle(true);
        
        const vehicleData = { ...currentVehicle };

        try {
            if (vehiclePhotoFile) {
                const newPhotoUrl = await uploadImage(vehiclePhotoFile);
                vehicleData.photoUrl = newPhotoUrl;
            }

            if (isEditingVehicle) {
                await updateVehicle(vehicleData as Vehicle);
            } else {
                await addVehicle(vehicleData as Omit<Vehicle, 'id' | 'createdAt'>);
            }

            handleCancelEditVehicle();
            const data = await getVehiclesByCompany(checkinInfo.companyId);
            setVehicles(data);

        } catch (error) {
            console.error("Failed to save vehicle", error);
        } finally {
            setIsSubmittingVehicle(false);
        }
    };

    const handleDeleteVehicleClick = (id: string) => {
        setVehicleToDelete(id);
        setIsConfirmVehicleDeleteOpen(true);
    };

    const handleConfirmVehicleDelete = async () => {
        if (vehicleToDelete && checkinInfo) {
            try {
                await deleteVehicle(vehicleToDelete);
                const data = await getVehiclesByCompany(checkinInfo.companyId);
                setVehicles(data);
            } catch (error) {
                console.error("Failed to delete vehicle", error);
            } finally {
                setVehicleToDelete(null);
                setIsConfirmVehicleDeleteOpen(false);
            }
        }
    };

    // --- Camera Functions ---
    const startCamera = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsCameraOpen(true);
            } catch (err) {
                console.error("Error accessing camera: ", err);
                alert("Não foi possível acessar a câmera. Verifique as permissões do seu navegador.");
            }
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const dataURLtoFile = (dataurl: string, filename: string): File => {
        let arr = dataurl.split(','),
            mimeMatch = arr[0].match(/:(.*?);/),
            mime = mimeMatch ? mimeMatch[1] : 'image/jpeg',
            bstr = atob(arr[1]), 
            n = bstr.length, 
            u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type:mime});
    }

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            
            const dataUrl = canvas.toDataURL('image/jpeg');
            const file = dataURLtoFile(dataUrl, `capture-${Date.now()}.jpg`);
            
            setVehiclePhotoFile(file);
            setCurrentVehicle(prev => ({ ...prev, photoUrl: dataUrl }));
            stopCamera();
        }
    };

  // --- Import Functions ---
  const processParsedData = async (data: any[], fields: string[]) => {
    if (!checkinInfo) return;

    const requiredColumns = ['Marca', 'Modelo'];
    const fileColumns = fields.map(f => f.trim());

    if (!requiredColumns.every(col => fileColumns.includes(col))) {
        setImportError(`O arquivo precisa conter as colunas obrigatórias: ${requiredColumns.join(', ')}.`);
        setIsImporting(false);
        return;
    }

    const newVehicles: Omit<Vehicle, 'id' | 'createdAt'>[] = data
        .map((row: any) => {
            const trimmedRow = Object.keys(row).reduce((acc, key) => {
                acc[key.trim()] = row[key];
                return acc;
            }, {} as any);

            const marca = trimmedRow['Marca']?.toString().trim();
            const model = trimmedRow['Modelo']?.toString().trim();
            if (!marca || !model) {
                return null;
            }
            return {
                marca,
                model,
                photoUrl: DEFAULT_VEHICLE_PHOTO,
                status: 'Disponível',
                companyId: checkinInfo.companyId,
            };
        })
        .filter((v: any): v is Omit<Vehicle, 'id' | 'createdAt'> => v !== null);

    if (newVehicles.length === 0) {
        setImportError('Nenhum veículo válido encontrado na planilha.');
        setIsImporting(false);
        return;
    }

    try {
        await apiBulkAddVehicles(newVehicles);
        setImportSuccessMessage(`${newVehicles.length} veículo(s) importado(s) com sucesso!`);
        
        const updatedData = await getVehiclesByCompany(checkinInfo.companyId);
        setVehicles(updatedData);

        setTimeout(() => {
            setIsImportModalOpen(false);
        }, 2000);

    } catch (error) {
        setImportError('Ocorreu um erro ao importar os veículos.');
    } finally {
        setIsImporting(false);
    }
  };
    
  const handleOpenImportModal = () => {
    setImportError(null);
    setImportSuccessMessage(null);
    setIsImportModalOpen(true);
  };

  const handleDownloadTemplate = () => {
      const headers = 'Marca,Modelo';
      const csvContent = "data:text/csv;charset=utf-8," + headers;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "modelo_estoque.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleFileImport = (file: File) => {
    if (!checkinInfo) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccessMessage(null);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
        (window as any).Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results: any) => {
                if (results.errors.length > 0) {
                    setImportError('Erro ao processar o arquivo CSV. Verifique o formato.');
                    setIsImporting(false);
                    return;
                }
                processParsedData(results.data, results.meta.fields);
            },
            error: (error: any) => {
                setImportError('Falha ao ler o arquivo CSV.');
                setIsImporting(false);
            }
        });
    } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = (window as any).XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = (window as any).XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    setImportError('A planilha está vazia ou mal formatada.');
                    setIsImporting(false);
                    return;
                }
                const headers = Object.keys(jsonData[0]);
                processParsedData(jsonData, headers);
            } catch (err) {
                 setImportError('Erro ao processar a planilha. Verifique se o formato está correto.');
                 setIsImporting(false);
            }
        };
        reader.onerror = () => {
            setImportError('Não foi possível ler o arquivo.');
            setIsImporting(false);
        };
        reader.readAsArrayBuffer(file);
    } else {
        setImportError('Formato de arquivo não suportado. Use .csv, .xls ou .xlsx.');
        setIsImporting(false);
    }
  };


    // --- Stock Control Functions ---
    const handleOpenStockControlModal = async () => {
        if (!checkinInfo) return;
        setIsStockModalOpen(true);
        setStockView('menu');
        setStockSubmitStatus('idle');
        setLastSubmittedVehicle(null);
        setStockSearchTerm('');
        setVehiclesLoading(true);
        try {
            const [allCompanyVehicles, movements] = await Promise.all([
                getVehiclesByCompany(checkinInfo.companyId),
                getStockMovementsByCompany(checkinInfo.companyId)
            ]);

            const soldVehicleIdsInLog = new Set(
                movements.filter(m => m.type === 'Venda').map(m => m.vehicleId)
            );

            const availableVehicles = allCompanyVehicles.filter(v => !soldVehicleIdsInLog.has(v.id));
            
            setVehicles(availableVehicles);
        } catch (error) {
            console.error("Failed to fetch vehicles for stock control", error);
        } finally {
            setVehiclesLoading(false);
        }
    };

    const handleCloseStockControlModal = () => {
        setIsStockModalOpen(false);
        setVehicles([]);
    };
    
    const handleStockMovement = async (vehicle: Vehicle, type: 'Venda' | 'Teste Drive') => {
        if (!checkinInfo) return;
        setStockSubmitting(vehicle.id);
        setStockSubmitStatus('idle');
        let wasSuccessful = false;
        try {
            await addStockMovement(checkinInfo.staffId, checkinInfo.companyId, vehicle.id, type, checkinInfo.eventId);
            setStockSubmitStatus('success');
            setLastSubmittedVehicle({id: vehicle.id, type});
            wasSuccessful = true;
        } catch (err) {
            setStockSubmitStatus('error');
            console.error(err);
        } finally {
            setStockSubmitting(null);
            setTimeout(() => {
                if (wasSuccessful && type === 'Venda') {
                    // If it was a successful sale, remove the vehicle from the list after the success message has been shown.
                    setVehicles(prevVehicles => prevVehicles.filter(v => v.id !== vehicle.id));
                }
                setStockSubmitStatus('idle');
                setLastSubmittedVehicle(null);
            }, 3000);
        }
    };

    const filteredVehicles = useMemo(() => {
        if (!vehicleSearchTerm) {
            return vehicles;
        }
        return vehicles.filter(v =>
            v.placa && v.placa.includes(vehicleSearchTerm)
        );
    }, [vehicles, vehicleSearchTerm]);

    const filteredStockVehicles = useMemo(() => {
        if (!stockSearchTerm) {
            return vehicles;
        }
        return vehicles.filter(v =>
            v.placa && v.placa.toUpperCase().includes(stockSearchTerm)
        );
    }, [vehicles, stockSearchTerm]);

  const handleOpenCallsModal = () => setIsCallsModalOpen(true);
  const handleCloseCallsModal = () => setIsCallsModalOpen(false);
  
  const handleOpenResolveModal = (call: CompanyCall) => {
    setCurrentCallToResolve(call);
    setFeedbackText('');
    setIsResolveModalOpen(true);
  };
  const handleCloseResolveModal = () => {
    setIsResolveModalOpen(false);
    setCurrentCallToResolve(null);
  };

  const handleResolveCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCallToResolve || !checkinInfo?.staffId || !feedbackText) return;
    setResolvingCall(true);
    try {
      await resolveCompanyCall(currentCallToResolve.id, checkinInfo.staffId, feedbackText);
      setPendingCompanyCalls(prev => prev.filter(c => c.id !== currentCallToResolve.id));
      handleCloseResolveModal();
    } catch (error) {
      console.error("Failed to resolve call", error);
    } finally {
      setResolvingCall(false);
    }
  };
  
    // --- Telão Request Handlers ---
    const handleOpenTelaoModal = () => setIsTelaoModalOpen(true);
    const handleCloseTelaoModal = () => setIsTelaoModalOpen(false);
    const handleOpenResolveTelaoModal = (req: TelaoRequest) => {
        setCurrentTelaoToResolve(req);
        setTelaoFeedbackText('');
        setIsResolveTelaoModalOpen(true);
    };
    const handleCloseResolveTelaoModal = () => {
        setIsResolveTelaoModalOpen(false);
        setCurrentTelaoToResolve(null);
    };
    const handleResolveTelao = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTelaoToResolve || !checkinInfo?.staffId || !telaoFeedbackText) return;
        setResolvingTelao(true);
        try {
            await resolveTelaoRequest(currentTelaoToResolve.id, checkinInfo.staffId, telaoFeedbackText);
            setPendingTelaoRequests(prev => prev.filter(r => r.id !== currentTelaoToResolve.id));
            handleCloseResolveTelaoModal();
        } catch (error) {
            console.error("Failed to resolve telão request", error);
        } finally {
            setResolvingTelao(false);
        }
    };

    // --- Sold Vehicles Report Handlers ---
    const handleOpenSoldVehiclesModal = async () => {
        if (!checkinInfo) return;
        setIsSoldVehiclesModalOpen(true);
        setSoldVehiclesLoading(true);
        setSoldVehiclesFilter('my_booth');
        try {
            const data = await getDetailedSalesByEvent(checkinInfo.eventId);
            setSoldVehicles(data);
        } catch (error) {
            console.error("Failed to fetch sold vehicles report", error);
        } finally {
            setSoldVehiclesLoading(false);
        }
    };
    
    const filteredSoldVehicles = useMemo(() => {
        if (!checkinInfo) return [];
        if (soldVehiclesFilter === 'all_booths') {
            return soldVehicles;
        }
        return soldVehicles.filter(v => v.company?.id === checkinInfo.companyId);
    }, [soldVehicles, soldVehiclesFilter, checkinInfo]);

    const handleDownloadSoldVehiclesPdf = () => {
        const doc = new (window as any).jspdf.jsPDF();
        const filterText = soldVehiclesFilter === 'my_booth' ? checkinInfo?.companyName : 'Todos os Estandes';
    
        doc.setFontSize(18);
        doc.text(`Relatório de Veículos Vendidos`, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Filtro: ${filterText}`, 14, 30);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 38);
    
        const tableColumn = ["Empresa", "Veículo", "Placa", "Vendedor", "Data/Hora"];
        const tableRows: string[][] = [];

        const sortedSales = [...filteredSoldVehicles].sort((a, b) => {
            const nameA = a.company?.name || '';
            const nameB = b.company?.name || '';
            return nameA.localeCompare(nameB);
        });
    
        sortedSales.forEach(sale => {
            const saleData = [
                sale.company?.name || 'N/A',
                `${sale.marca} ${sale.model}`,
                sale.placa || 'N/D',
                sale.collaborator?.name || 'N/A',
                new Date(sale.updatedAt).toLocaleString('pt-BR')
            ];
            tableRows.push(saleData);
        });
    
        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [18, 181, 229] },
        });
    
        doc.save(`relatorio_veiculos_vendidos.pdf`);
    };


  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 p-4 bg-card rounded-lg shadow">
          <div>
            <h2 className="text-2xl font-bold text-center sm:text-left">
              Estande: <span className="text-primary">{checkinInfo?.companyName || boothCode}</span>
            </h2>
            <p className="text-sm text-text-secondary text-center sm:text-left">Código: {boothCode}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsSwitchModalOpen(true)}>
                Trocar Estande
            </Button>
            <Button variant="danger" onClick={handleExit}>Sair</Button>
          </div>
      </div>
      
      <div className="my-8 p-4 bg-card rounded-lg shadow-lg">
        <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-text-secondary">Total de Atividades Registradas</h3>
            <p className="text-5xl font-bold text-primary tracking-tight">{totalActivitiesCount}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-6">
          <Button onClick={() => setIsTasksModalOpen(true)} className="relative w-full">
              Minhas Tarefas
              {pendingTasks.length > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow-md animate-pulse">
                      {pendingTasks.length}
                  </span>
              )}
          </Button>
          <Button onClick={() => setIsRankingModalOpen(true)} className="w-full">
            Ranking de Visitas
          </Button>
          <Button onClick={handleOpenVehicleModal} className="w-full">
              Estoque de Veículos
          </Button>
          <Button onClick={handleOpenCallsModal} className="relative w-full">
              Chamados Abertos
              {pendingCompanyCalls.length > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow-md animate-pulse">
                      {pendingCompanyCalls.length}
                  </span>
              )}
          </Button>
          <Button onClick={handleOpenTelaoModal} className="relative w-full">
              Solicitações de Telão
              {pendingTelaoRequests.length > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow-md animate-pulse">
                      {pendingTelaoRequests.length}
                  </span>
              )}
          </Button>
          <Button onClick={handleOpenSoldVehiclesModal} className="w-full">
            Relação de Veículos Vendidos
          </Button>
          {checkinInfo?.staffId && salesCheckinStaffIds.includes(checkinInfo.staffId) && (
              <Button onClick={openSalesCheckinModal} className="w-full">
                  Check-in de Vendas
              </Button>
          )}
          {checkinInfo?.staffId && notifyCallStaffIds.includes(checkinInfo.staffId) && (
              <Button onClick={openNotifyCallModal} className="w-full">
                  Abrir Chamado
              </Button>
          )}
          {checkinInfo?.staffId && stockControlStaffIds.includes(checkinInfo.staffId) && (
              <Button onClick={handleOpenStockControlModal} className="w-full">
                  Controle de Estoque
              </Button>
          )}
        </div>
      </div>


      <div className="border-t border-border pt-8 mt-8">
        <h3 className="text-xl mb-4 text-center">Ações Gerais Disponíveis</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {visibleButtons.map((button) => (
            <button key={button.id} onClick={() => handleButtonClick(button)} className="p-6 bg-card rounded-lg shadow-lg text-center transition-transform transform hover:-translate-y-1 hover:shadow-xl">
                <span className="text-xl font-semibold">{button.label}</span>
            </button>
            ))}
            {visibleButtons.length === 0 && (
                <p className="col-span-full text-center text-text-secondary">Todas as ações para esta visita foram concluídas.</p>
            )}
        </div>
      </div>

      {/* Report Submission Modal */}
      {selectedButton && (
        <Modal isOpen={isReportModalOpen} onClose={handleModalClose} title={selectedButton.label}>
          {submissionSuccess === true ? (
             <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Informe enviado com sucesso!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport}>
              <p className="mb-4 text-lg">{selectedButton.question}</p>
              
              {selectedButton.type === ReportType.OPEN_TEXT && (
                <textarea
                  value={primaryResponse}
                  onChange={(e) => setPrimaryResponse(e.target.value)}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  rows={4}
                  required
                />
              )}

              {selectedButton.type === ReportType.MULTIPLE_CHOICE && selectedButton.options && (
                <div className="space-y-2">
                  {selectedButton.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                      <input
                        type="radio"
                        name="report-option"
                        value={option.label}
                        checked={primaryResponse === option.label}
                        onChange={(e) => setPrimaryResponse(e.target.value)}
                        required
                        className="form-radio text-primary focus:ring-primary"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {selectedButton.type === ReportType.CHECKLIST && selectedButton.options && (
                <div className="space-y-2">
                  {selectedButton.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                      <input
                        type="checkbox"
                        name="report-option-checklist"
                        value={option.label}
                        checked={checklistSelection.includes(option.label)}
                        onChange={() => handleChecklistChange(option.label)}
                        className="form-checkbox h-5 w-5 rounded text-primary focus:ring-primary bg-background border-border"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {selectedButton.type === ReportType.YES_NO && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    {['Sim', 'Não'].map(option => (
                        <label key={option} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border-2 border-border hover:bg-border cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-black has-[:checked]:border-primary">
                          <input
                            type="radio"
                            name="yes-no-option"
                            value={option}
                            checked={primaryResponse === option}
                            onChange={(e) => setPrimaryResponse(e.target.value)}
                            required
                            className="sr-only"
                          />
                          <span className="font-semibold">{option}</span>
                        </label>
                    ))}
                  </div>

                  {selectedButton.followUp && primaryResponse === selectedButton.followUp.triggerValue && (
                    <div className="border-t border-border pt-4 animate-fade-in">
                        <label className="block text-sm font-medium mb-2" htmlFor="followUpInput">
                            {selectedButton.followUp.question}
                        </label>
                        {selectedButton.followUp.type === ReportType.MULTIPLE_CHOICE && selectedButton.followUp.options ? (
                           <div className="space-y-2">
                            {selectedButton.followUp.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-border cursor-pointer">
                                <input
                                  type="radio"
                                  name="follow-up-option"
                                  value={option.label}
                                  checked={followUpResponse === option.label}
                                  onChange={(e) => setFollowUpResponse(e.target.value)}
                                  required
                                  className="form-radio text-primary focus:ring-primary"
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                              id="followUpInput"
                              value={followUpResponse}
                              onChange={(e) => setFollowUpResponse(e.target.value)}
                              className="w-full p-2 border border-border rounded-md bg-background"
                              rows={2}
                              required
                          />
                        )}
                    </div>
                  )}
                </div>
              )}

              {submissionSuccess === false && <p className="text-red-500 mt-2 text-center">Falha ao enviar o informe.</p>}
              <div className="mt-6 flex justify-end gap-4">
                <Button type="button" variant="secondary" onClick={handleModalClose}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <LoadingSpinner /> : 'Enviar'}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
      
      {/* Notification Call Modal */}
      <Modal isOpen={isNotificationModalOpen} onClose={handleModalClose} title={selectedButton?.label || 'Notificar Chamado'}>
          {submissionSuccess === true ? (
             <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Chamado enviado com sucesso!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmitNotificationCall}>
                {notificationStep === 'department' && (
                    <div>
                        <h3 className="text-lg font-semibold mb-3">Para qual departamento é o chamado?</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {departments.map(dept => (
                                <button type="button" key={dept.id} onClick={() => { setSelectedNotificationDeptId(dept.id); setNotificationStep('staff'); }} className="w-full text-left p-3 rounded-md bg-secondary hover:bg-secondary-hover transition-colors">
                                    {dept.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {notificationStep === 'staff' && (
                    <div>
                        <div className="flex items-center mb-3">
                            <Button type="button" variant="secondary" onClick={() => setNotificationStep('department')} className="mr-4 text-sm px-2 py-1">Voltar</Button>
                            <h3 className="text-lg font-semibold">Para qual membro da equipe?</h3>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {allStaff.filter(s => s.departmentId === selectedNotificationDeptId).map(staff => (
                                <button type="button" key={staff.id} onClick={() => { setSelectedNotificationStaff(staff); setNotificationStep('reason'); }} className="w-full text-left p-3 rounded-md bg-secondary hover:bg-secondary-hover transition-colors flex items-center gap-3">
                                    <img src={staff.photoUrl} alt={staff.name} className="w-10 h-10 rounded-full object-cover"/>
                                    <span>{staff.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {notificationStep === 'reason' && (
                    <div>
                         <div className="flex items-center mb-3">
                            <Button type="button" variant="secondary" onClick={() => setNotificationStep('staff')} className="mr-4 text-sm px-2 py-1">Voltar</Button>
                            <h3 className="text-lg font-semibold">Qual o motivo do chamado?</h3>
                        </div>
                        <p className="mb-2 text-text-secondary">Para: <span className="font-bold text-text">{selectedNotificationStaff?.name}</span></p>
                        <textarea
                            value={notificationReason}
                            onChange={(e) => setNotificationReason(e.target.value)}
                            className="w-full p-2 border border-border rounded-md bg-background"
                            rows={4}
                            placeholder="Digite o motivo aqui..."
                            required
                        />
                         {submissionSuccess === false && <p className="text-red-500 mt-2 text-center">Falha ao enviar o chamado.</p>}
                        <div className="mt-6 flex justify-end gap-4">
                            <Button type="button" variant="secondary" onClick={handleModalClose}>Cancelar</Button>
                            <Button type="submit" disabled={submitting}>
                            {submitting ? <LoadingSpinner /> : 'Enviar Chamado'}
                            </Button>
                        </div>
                    </div>
                )}
            </form>
          )}
      </Modal>

      {/* Switch Booth Modal */}
      <Modal isOpen={isSwitchModalOpen} onClose={() => setIsSwitchModalOpen(false)} title="Trocar de Estande">
        <div className="space-y-4">
          <p>Você está logado como <span className="font-bold">{checkinInfo?.staffName}</span> (Cód: {checkinInfo?.personalCode}).</p>
          <Input 
            id="new-booth-code"
            label="Código do Novo Estande"
            value={newBoothCode}
            onChange={e => setNewBoothCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="Digite o código do estande"
            autoFocus
          />
          {switchError && <p className="text-red-500 text-sm">{switchError}</p>}
          <div className="flex justify-end gap-4 pt-2">
            <Button variant="secondary" onClick={() => setIsSwitchModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSwitchBooth} disabled={switching}>
                {switching ? <LoadingSpinner /> : 'Validar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sales Check-in Modal */}
      <Modal isOpen={isSalesModalOpen} onClose={() => setIsSalesModalOpen(false)} title="Check-in de Vendas">
        {salesSubmitStatus === 'success' ? (
            <div className="text-center p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-4 text-lg font-semibold">Check-in de vendas enviado com sucesso!</p>
            </div>
        ) : (
            <form onSubmit={handleSubmitSalesCheckin} className="space-y-6">
                {salesDataLoading ? <LoadingSpinner /> : salesCollaborators.length > 0 && salesAvailableVehicles.length > 0 ? (
                    <>
                        <div>
                            <label htmlFor="sale-collaborator" className="block text-sm font-medium mb-1 text-text">Colaborador que realizou a venda</label>
                            <select
                                id="sale-collaborator"
                                value={selectedSaleCollaboratorId}
                                onChange={(e) => setSelectedSaleCollaboratorId(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            >
                                <option value="" disabled>Selecione um colaborador</option>
                                {salesCollaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="sale-vehicle-search" className="block text-sm font-medium mb-1 text-text">Veículo Vendido</label>
                            <Input
                                id="sale-vehicle-search"
                                label=""
                                placeholder="Buscar por placa, marca ou modelo..."
                                value={salesVehicleSearch}
                                onChange={(e) => setSalesVehicleSearch(e.target.value)}
                                className="mb-2"
                            />
                            <div className="max-h-60 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                                {filteredSalesVehicles.length > 0 ? filteredSalesVehicles.map(vehicle => (
                                    <label key={vehicle.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-border cursor-pointer has-[:checked]:bg-primary/20">
                                        <input
                                            type="radio"
                                            name="sale-vehicle"
                                            value={vehicle.id}
                                            checked={selectedSaleVehicleId === vehicle.id}
                                            onChange={(e) => setSelectedSaleVehicleId(e.target.value)}
                                            required
                                            className="form-radio text-primary focus:ring-primary bg-background border-border"
                                        />
                                        <img src={vehicle.photoUrl} alt={vehicle.marca} className="w-12 h-12 object-cover rounded-md" />
                                        <div>
                                            <p className="font-semibold">{vehicle.marca} {vehicle.model}</p>
                                            <p className="text-xs text-text-secondary">Placa: {vehicle.placa || 'N/D'}</p>
                                        </div>
                                    </label>
                                )) : <p className="text-center text-sm text-text-secondary p-4">Nenhum veículo encontrado.</p>}
                            </div>
                        </div>

                        {salesSubmitStatus === 'error' && (
                          <p className="text-red-500 text-sm text-center">Ocorreu um erro ao enviar. Verifique os dados e tente novamente.</p>
                        )}

                        <div className="flex justify-end gap-4 pt-4">
                            <Button type="button" variant="secondary" onClick={() => setIsSalesModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={salesSubmitting || !selectedSaleCollaboratorId || !selectedSaleVehicleId}>
                                {salesSubmitting ? <LoadingSpinner /> : 'Confirmar Venda'}
                            </Button>
                        </div>
                    </>
                ) : (
                    <p className="text-center text-text-secondary py-8">Não há colaboradores ou veículos disponíveis para registrar uma venda.</p>
                )}
            </form>
        )}
      </Modal>

       {/* Assigned Tasks Modal */}
      <Modal isOpen={isTasksModalOpen} onClose={() => setIsTasksModalOpen(false)} title="Minhas Tarefas Pendentes">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {pendingTasks.length > 0 ? (
            pendingTasks.map(task => {
              const taskDetails = parseTaskDetails(task.description);
              return (
                <div key={task.id} className="p-4 bg-secondary rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="flex-grow">
                    <p className="font-bold text-primary">{task.actionLabel}</p>
                    <p>Empresa: <span className="font-semibold">{task.companyName}</span></p>
                    {taskDetails && <p className="text-sm text-text-secondary mt-2 pt-2 border-t border-border/50">{taskDetails}</p>}
                    <p className="text-xs text-text-secondary mt-2">
                      Atribuída em: {new Date(task.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleCompleteTask(task)} 
                    disabled={taskCompleting === task.id}
                    className="flex-shrink-0 self-end sm:self-center"
                    variant="primary"
                  >
                    {taskCompleting === task.id ? (
                       <div className="flex justify-center items-center h-5 w-24">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                      </div>
                    ) : 'Marcar como Concluída'}
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="text-center text-text-secondary py-8">Você não tem nenhuma tarefa pendente. Bom trabalho!</p>
          )}
        </div>
      </Modal>
      
      {/* Ranking Modal */}
      <Modal isOpen={isRankingModalOpen} onClose={() => setIsRankingModalOpen(false)} title="Ranking de Visitas por Estande">
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {rankingData.length > 0 ? (
            rankingData.map((item, index) => {
              const maxValue = Math.max(...rankingData.map(d => d.value), 0);
              return (
                <div key={index} className="flex items-center gap-4 group w-full p-2">
                  <span className="text-right font-semibold text-text-secondary w-10">{index + 1}º</span>
                  <img 
                    src={item.logoUrl || 'https://via.placeholder.com/150?text=Logo'} 
                    alt={`${item.label} logo`} 
                    className="w-8 h-8 rounded-full object-contain bg-white flex-shrink-0"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-text truncate pr-2" title={item.label}>{item.label}</p>
                      <div className="flex items-center">
                        <p className="text-sm font-bold text-primary">{item.value}</p>
                        {index < 3 && <MedalIcon position={index + 1} />}
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-primary h-4 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-text-secondary py-8">Nenhum dado de visita para exibir.</p>
          )}
        </div>
      </Modal>
      
      {/* Vehicle Stock Modal */}
      <Modal isOpen={isVehicleModalOpen} onClose={handleCloseVehicleModal} title={`Estoque de Veículos de ${checkinInfo?.companyName}`}>
        {isCameraOpen && (
            <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex flex-col items-center justify-center p-4">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-md rounded-lg mb-4"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="flex gap-4">
                <Button onClick={capturePhoto}>Capturar Foto</Button>
                <Button variant="secondary" onClick={stopCamera}>Cancelar</Button>
            </div>
            </div>
        )}
        <div id="vehicle-modal-content-staff" className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleOpenImportModal}>Importar Planilha</Button>
            </div>
            <form onSubmit={handleVehicleSubmit} className="p-4 border border-border rounded-lg space-y-4 bg-secondary">
                <h3 className="text-lg font-semibold">{isEditingVehicle ? 'Editar Veículo' : 'Adicionar Novo Veículo'}</h3>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-shrink-0">
                    <img src={(currentVehicle as Vehicle).photoUrl || DEFAULT_VEHICLE_PHOTO} alt="Preview" className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover bg-background" />
                    </div>
                    <div className="flex-grow space-y-2 w-full">
                    <Button type="button" onClick={startCamera} className="w-full">Tirar Foto</Button>
                    <label htmlFor="vehicle-photo-upload-staff" className="cursor-pointer w-full inline-block text-center bg-secondary hover:bg-secondary-hover text-text font-bold py-2 px-4 rounded-lg transition-colors">
                        Enviar Arquivo
                    </label>
                    <input id="vehicle-photo-upload-staff" type="file" accept="image/*" onChange={handleVehiclePhotoFileChange} className="hidden" />
                    </div>
                </div>
                <Input id="vehicle-marca" name="marca" label="Marca do Veículo" value={(currentVehicle as Vehicle).marca} onChange={handleVehicleChange} required />
                <Input id="vehicle-model" name="model" label="Modelo" value={(currentVehicle as Vehicle).model} onChange={handleVehicleChange} required />
                <Input id="vehicle-placa" name="placa" label="Placa" value={(currentVehicle as Vehicle).placa || ''} onChange={handleVehicleChange} />
                <div className="flex justify-end gap-2">
                    {isEditingVehicle && <Button type="button" variant="secondary" onClick={handleCancelEditVehicle}>Cancelar Edição</Button>}
                    <Button type="submit" disabled={isSubmittingVehicle}>
                        {isSubmittingVehicle ? <div className="flex justify-center items-center h-5 w-36"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div></div> : (isEditingVehicle ? 'Salvar Alterações' : 'Adicionar Veículo')}
                    </Button>
                </div>
            </form>

            <div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-2">Veículos Cadastrados</h4>
                <Input 
                    id="vehicle-search-staff"
                    label=""
                    placeholder="Buscar por Placa..."
                    value={vehicleSearchTerm}
                    onChange={(e) => setVehicleSearchTerm(e.target.value.toUpperCase())}
                    className="mb-4"
                />
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {vehiclesLoading ? <LoadingSpinner /> : (
                    filteredVehicles.length > 0 ? filteredVehicles.map(vehicle => (
                        <div key={vehicle.id} className="flex justify-between items-center p-2 bg-secondary rounded-md">
                        <div className="flex items-center gap-3">
                            <img src={vehicle.photoUrl} alt={vehicle.marca} className="w-12 h-12 rounded-md object-cover" />
                            <div>
                            <p className="font-semibold">{vehicle.marca}</p>
                            <p className="text-sm text-text-secondary">{vehicle.model}</p>
                            <p className="text-sm text-text-secondary">Placa: {vehicle.placa || 'N/D'}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" className="py-1 px-2 text-xs" onClick={() => handleEditVehicle(vehicle)}>Editar</Button>
                            <Button variant="danger" className="py-1 px-2 text-xs" onClick={() => handleDeleteVehicleClick(vehicle.id)}>Excluir</Button>
                        </div>
                        </div>
                    )) : <p className="text-center text-text-secondary py-4">{vehicleSearchTerm ? 'Nenhum veículo encontrado para a busca.' : 'Nenhum veículo cadastrado.'}</p>
                    )}
                </div>
            </div>
        </div>
      </Modal>
      
      {/* Stock Control Modal */}
      <Modal isOpen={isStockModalOpen} onClose={handleCloseStockControlModal} title="Controle de Movimentação de Estoque">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {stockView === 'menu' && (
                <div className="flex flex-col gap-4 p-4">
                    <Button onClick={() => setStockView('venda')} className="w-full text-lg py-4">Venda</Button>
                    <Button onClick={() => setStockView('teste_drive')} className="w-full text-lg py-4">Test Drive</Button>
                </div>
            )}

            {(stockView === 'venda' || stockView === 'teste_drive') && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <Button variant="secondary" onClick={() => setStockView('menu')}>
                            &larr; Voltar
                        </Button>
                        <h3 className="text-xl font-semibold text-primary">
                            {stockView === 'venda' ? 'Confirmar Venda' : 'Confirmar Test Drive'}
                        </h3>
                    </div>

                    <Input
                        id="stock-search"
                        label=""
                        placeholder="Buscar por Placa..."
                        value={stockSearchTerm}
                        onChange={(e) => setStockSearchTerm(e.target.value.toUpperCase())}
                        className="mb-4"
                    />

                    {vehiclesLoading ? <LoadingSpinner /> : (
                        <div className="space-y-3">
                            {filteredStockVehicles.length > 0 ? filteredStockVehicles.map(vehicle => (
                                <div key={vehicle.id} className="p-3 bg-secondary rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                                    <div className="flex items-center gap-4">
                                        <img src={vehicle.photoUrl} alt={vehicle.marca} className="w-16 h-16 rounded-lg object-cover" />
                                        <div>
                                            <p className="font-bold text-text">{vehicle.marca}</p>
                                            <p className="text-sm text-text-secondary">{vehicle.model}</p>
                                            <p className="text-sm text-text-secondary">Placa: {vehicle.placa || 'N/D'}</p>
                                        </div>
                                    </div>
                                    
                                    {lastSubmittedVehicle?.id === vehicle.id ? (
                                        <div className="text-green-400 font-bold flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            {lastSubmittedVehicle.type === 'Teste Drive' ? 'Test Drive' : lastSubmittedVehicle.type} Registrada!
                                        </div>
                                    ) : (
                                        <Button
                                            onClick={() => handleStockMovement(vehicle, stockView === 'venda' ? 'Venda' : 'Teste Drive')}
                                            disabled={stockSubmitting === vehicle.id}
                                            className="w-full sm:w-auto flex-shrink-0"
                                        >
                                            {stockSubmitting === vehicle.id 
                                                ? <div className="flex justify-center items-center h-5 w-40"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div></div>
                                                : `Confirmar ${stockView === 'venda' ? 'Venda' : 'Test Drive'}`
                                            }
                                        </Button>
                                    )}
                                </div>
                            )) : (
                                <p className="text-center text-text-secondary py-8">{stockSearchTerm ? 'Nenhum veículo encontrado para a placa informada.' : 'Nenhum veículo no estoque desta empresa.'}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
      </Modal>
      
      {/* Company Calls Modals */}
      <Modal isOpen={isCallsModalOpen} onClose={handleCloseCallsModal} title="Chamados Pendentes">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {pendingCompanyCalls.length > 0 ? (
            pendingCompanyCalls.map(call => (
              <div key={call.id} className="p-4 bg-secondary rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex-grow">
                  <p className="font-bold text-primary">{call.company?.name || 'Empresa desconhecida'}</p>
                  <p>Colaborador: <span className="font-semibold">{call.collaboratorName}</span></p>
                  <p className="text-sm text-text-secondary mt-2 pt-2 border-t border-border/50">{call.observation}</p>
                  <p className="text-xs text-text-secondary mt-2">
                    Aberto em: {new Date(call.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Button 
                  onClick={() => handleOpenResolveModal(call)}
                  className="flex-shrink-0 self-end sm:self-center"
                  variant="primary"
                >
                  Resolver
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-text-secondary py-8">Nenhum chamado pendente para o seu departamento.</p>
          )}
        </div>
      </Modal>

      <Modal isOpen={isResolveModalOpen} onClose={handleCloseResolveModal} title={`Resolver Chamado de ${currentCallToResolve?.company?.name}`}>
        <form onSubmit={handleResolveCall} className="space-y-4">
          <div>
            <label htmlFor="feedback" className="block text-sm font-medium mb-1">Feedback / Resolução</label>
            <textarea
              id="feedback"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Descreva a ação tomada para resolver este chamado."
              required
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseResolveModal} disabled={resolvingCall}>Cancelar</Button>
            <Button type="submit" disabled={resolvingCall}>
              {resolvingCall ? <LoadingSpinner /> : 'Concluir Chamado'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Telão Requests Modals */}
      <Modal isOpen={isTelaoModalOpen} onClose={handleCloseTelaoModal} title="Solicitações de Telão Pendentes">
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {pendingTelaoRequests.length > 0 ? (
            pendingTelaoRequests.map(req => (
              <div key={req.id} className="p-4 bg-secondary rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex-grow">
                  <p className="font-bold text-primary">{req.company?.name || 'Empresa desconhecida'}</p>
                  <p>Vendedor: <span className="font-semibold">{req.collaborator?.name}</span></p>
                  <p className="text-sm text-text-secondary mt-2 pt-2 border-t border-border/50">Veículo: {req.vehicle?.marca} {req.vehicle?.model}</p>
                  <p className="text-xs text-text-secondary mt-2">
                    Aberto em: {new Date(req.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Button 
                  onClick={() => handleOpenResolveTelaoModal(req)}
                  className="flex-shrink-0 self-end sm:self-center"
                  variant="primary"
                >
                  Resolver
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-text-secondary py-8">Nenhuma solicitação de telão pendente.</p>
          )}
        </div>
      </Modal>

      <Modal isOpen={isResolveTelaoModalOpen} onClose={handleCloseResolveTelaoModal} title={`Resolver Solicitação de ${currentTelaoToResolve?.company?.name}`}>
        <form onSubmit={handleResolveTelao} className="space-y-4">
          <div>
            <label htmlFor="telao-feedback" className="block text-sm font-medium mb-1">Feedback / Resolução</label>
            <textarea
              id="telao-feedback"
              value={telaoFeedbackText}
              onChange={(e) => setTelaoFeedbackText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Descreva a ação tomada para atender a esta solicitação."
              required
            />
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseResolveTelaoModal} disabled={resolvingTelao}>Cancelar</Button>
            <Button type="submit" disabled={resolvingTelao}>
              {resolvingTelao ? <LoadingSpinner /> : 'Concluir Solicitação'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sold Vehicles Report Modal */}
        <Modal isOpen={isSoldVehiclesModalOpen} onClose={() => setIsSoldVehiclesModalOpen(false)} title="Relação de Veículos Vendidos">
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center p-1 bg-background rounded-lg w-full sm:w-auto">
                        <Button onClick={() => setSoldVehiclesFilter('my_booth')} variant={soldVehiclesFilter === 'my_booth' ? 'primary' : 'secondary'} className={`w-1/2 sm:w-auto !rounded-r-none !transform-none ${soldVehiclesFilter !== 'my_booth' && 'bg-secondary'}`}>{checkinInfo?.companyName || 'Meu Estande'}</Button>
                        <Button onClick={() => setSoldVehiclesFilter('all_booths')} variant={soldVehiclesFilter === 'all_booths' ? 'primary' : 'secondary'} className={`w-1/2 sm:w-auto !rounded-l-none !transform-none ${soldVehiclesFilter !== 'all_booths' && 'bg-secondary'}`}>Todos os Estandes</Button>
                    </div>
                    <Button onClick={handleDownloadSoldVehiclesPdf} variant="secondary" disabled={filteredSoldVehicles.length === 0}>Download PDF</Button>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {soldVehiclesLoading ? <LoadingSpinner /> : (
                        filteredSoldVehicles.length > 0 ? filteredSoldVehicles.map((sale, index) => (
                            <div key={index} className="p-3 bg-secondary rounded-lg">
                                <div className="flex items-center gap-4">
                                    <img src={sale.company?.logoUrl} alt={sale.company?.name} className="w-12 h-12 object-contain bg-white p-1 rounded-full"/>
                                    <div>
                                        <p className="font-bold text-primary">{sale.company?.name}</p>
                                        <p className="text-sm">{sale.marca} {sale.model} - {sale.placa || 'S/ Placa'}</p>
                                        <p className="text-xs text-text-secondary">Vendido por: {sale.collaborator?.name}</p>
                                        <p className="text-xs text-text-secondary">{new Date(sale.updatedAt).toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-center text-text-secondary py-8">Nenhuma venda encontrada para o filtro selecionado.</p>
                    )}
                </div>
            </div>
        </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Estoque via Planilha">
          <div className="space-y-4">
              <p className="text-text-secondary">Envie um arquivo <code className="bg-background text-primary px-1 rounded">.csv, .xls ou .xlsx</code> com as colunas: <code className="bg-background text-primary px-1 rounded">Marca</code> (obrigatório), <code className="bg-background text-primary px-1 rounded">Modelo</code> (obrigatório)</p>
              
              <Button onClick={handleDownloadTemplate} variant="secondary" className="w-full">Baixar Planilha Modelo (.csv)</Button>
              
              <input 
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={(e) => e.target.files && handleFileImport(e.target.files[0])}
                  className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-black hover:file:bg-primary-dark"
                  disabled={isImporting}
              />
              
              {isImporting && <div className="flex items-center gap-2"><LoadingSpinner /><p>Importando, por favor aguarde...</p></div>}
              {importError && <p className="text-red-500 text-sm">{importError}</p>}
              {importSuccessMessage && <p className="text-green-500 text-sm font-semibold">{importSuccessMessage}</p>}
          </div>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={isConfirmVehicleDeleteOpen}
        onClose={() => setIsConfirmVehicleDeleteOpen(false)}
        onConfirm={handleConfirmVehicleDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este veículo do estoque?"
        confirmText="Excluir"
      />

      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default InformesPage;