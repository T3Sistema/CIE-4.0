
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    getParticipantCompaniesByEvent, 
    addParticipantCompany, 
    updateParticipantCompany, 
    deleteParticipantCompany, 
    getButtonConfigs, 
    uploadImage, 
    getCollaboratorsByCompany, 
    addCollaborator, 
    updateCollaborator,
    deleteCollaborator,
    getVehiclesByCompany,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    apiBulkAddVehicles
} from '../../services/api';
import { ParticipantCompany, ReportButtonConfig, Collaborator, Vehicle } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';

interface Props {
  eventId: string;
}

const emptyCompany: Omit<ParticipantCompany, 'id'> = {
  name: '', boothCode: '', buttonIds: [], responsible: '', contact: '', responsiblePhone: '', eventId: '', logoUrl: ''
};

const emptyCollaborator: Omit<Collaborator, 'id' | 'createdAt'> = {
  name: '',
  collaboratorCode: '',
  companyId: '',
  email: '',
  phone: '',
  role: '',
  photoUrl: 'https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/molduras/Screenshot%202025-08-25%20182827.png'
};

const DEFAULT_VEHICLE_PHOTO = 'https://ngukhhydpltectxrmvot.supabase.co/storage/v1/object/public/imagens/WhatsApp%20Image%202025-09-12%20at%2000.14.26.jpeg';

const emptyVehicle: Omit<Vehicle, 'id' | 'createdAt'> = {
  marca: '',
  model: '',
  placa: '',
  photoUrl: DEFAULT_VEHICLE_PHOTO,
  companyId: '',
  status: 'Disponível'
};

const ParticipantCompaniesManager: React.FC<Props> = ({ eventId }) => {
  const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
  const [allButtons, setAllButtons] = useState<ReportButtonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Omit<ParticipantCompany, 'id'> | ParticipantCompany>({...emptyCompany, eventId});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFileName, setLogoFileName] = useState('');
  
  const [companyStats, setCompanyStats] = useState<Record<string, { collaborators: number; stock: number }>>({});


  // State for card interactions
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  
  // State for choice modals
  const [isCollaboratorChoiceModalOpen, setIsCollaboratorChoiceModalOpen] = useState(false);
  const [isStockChoiceModalOpen, setIsStockChoiceModalOpen] = useState(false);

  // State for Collaborators Modal
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [collaboratorModalMode, setCollaboratorModalMode] = useState<'add' | 'view'>('add');
  const [selectedCompany, setSelectedCompany] = useState<ParticipantCompany | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [isSubmittingCollaborator, setIsSubmittingCollaborator] = useState(false);
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<string | null>(null);
  const [isConfirmCollaboratorDeleteOpen, setIsConfirmCollaboratorDeleteOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [collaboratorSearchTerm, setCollaboratorSearchTerm] = useState('');
  
  const [currentCollaborator, setCurrentCollaborator] = useState<Omit<Collaborator, 'id' | 'createdAt'> | Collaborator>(emptyCollaborator);
  const [isEditingCollaborator, setIsEditingCollaborator] = useState(false);


  // State for Vehicle Stock Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [stockModalMode, setStockModalMode] = useState<'add' | 'view'>('add');
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

  // Refs for camera functionality
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesData, buttonsData] = await Promise.all([getParticipantCompaniesByEvent(eventId), getButtonConfigs()]);
      setCompanies(companiesData);
      setAllButtons(buttonsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (companies.length > 0) {
        const fetchStats = async () => {
            const statsPromises = companies.map(async (company) => {
                const [collaboratorsData, vehiclesData] = await Promise.all([
                    getCollaboratorsByCompany(company.id),
                    getVehiclesByCompany(company.id)
                ]);
                return {
                    companyId: company.id,
                    stats: {
                        collaborators: collaboratorsData.length,
                        stock: vehiclesData.length
                    }
                };
            });
            const results = await Promise.all(statsPromises);
            const statsMap = results.reduce((acc, result) => {
                acc[result.companyId] = result.stats;
                return acc;
            }, {} as Record<string, { collaborators: number; stock: number }>);
            setCompanyStats(statsMap);
        };
        fetchStats();
    }
  }, [companies]);

  // Effect to fetch collaborators when a company is selected
  useEffect(() => {
    if (selectedCompany && isCollaboratorModalOpen) {
      const fetchCollaborators = async () => {
        setCollaboratorsLoading(true);
        try {
          const data = await getCollaboratorsByCompany(selectedCompany.id);
          setCollaborators(data);
        } catch (error) {
          console.error("Failed to fetch collaborators", error);
        } finally {
          setCollaboratorsLoading(false);
        }
      };
      fetchCollaborators();
    }
  }, [selectedCompany, isCollaboratorModalOpen]);
  
  // Effect to fetch vehicles when a company is selected for the vehicle modal
  useEffect(() => {
    if (selectedCompany && isVehicleModalOpen) {
        const fetchVehicles = async () => {
            setVehiclesLoading(true);
            try {
                const data = await getVehiclesByCompany(selectedCompany.id);
                setVehicles(data);
            } catch (error) {
                console.error("Failed to fetch vehicles", error);
            } finally {
                setVehiclesLoading(false);
            }
        };
        fetchVehicles();
    }
  }, [selectedCompany, isVehicleModalOpen]);

  const handleOpenModal = (company?: ParticipantCompany) => {
    setLogoFile(null);
    setLogoFileName('');
    if (company) {
      setCurrentCompany({ ...company });
      setIsEditing(true);
    } else {
      setCurrentCompany({...emptyCompany, eventId});
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'boothCode' ? value.toUpperCase().replace(/\s/g, '') : value;
    setCurrentCompany(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setLogoFile(file);
        setLogoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCurrentCompany(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCurrentCollaborator(prev => ({ ...prev, photoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };


  const handleButtonToggle = (buttonId: string) => {
    const currentButtonIds = currentCompany.buttonIds || [];
    const newButtonIds = currentButtonIds.includes(buttonId)
      ? currentButtonIds.filter(id => id !== buttonId)
      : [...currentButtonIds, buttonId];
    setCurrentCompany(prev => ({...prev, buttonIds: newButtonIds}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyData = { ...currentCompany };
    
    try {
      if (logoFile) {
        const newLogoUrl = await uploadImage(logoFile);
        companyData.logoUrl = newLogoUrl;
      }
      
      if (isEditing) {
        await updateParticipantCompany(companyData as ParticipantCompany);
      } else {
        await addParticipantCompany(companyData as Omit<ParticipantCompany, 'id'>);
      }
      fetchData();
      handleCloseModal();
    } catch(error) {
        console.error("Failed to submit company data", error);
    }
  };
  
  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteParticipantCompany(itemToDelete);
      fetchData();
      setItemToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  // --- Card Interaction ---
  const handleCardClick = (companyId: string) => {
    const isOpening = activeCompanyId !== companyId;
    setActiveCompanyId(isOpening ? companyId : null);
  };

  // --- Collaborator Functions ---
  const handleOpenCollaboratorsModal = (company: ParticipantCompany) => {
    setSelectedCompany(company);
    setIsCollaboratorModalOpen(true);
  };

  const handleCloseCollaboratorsModal = () => {
    setIsCollaboratorModalOpen(false);
    setSelectedCompany(null);
    setCollaborators([]);
    setCollaboratorSearchTerm('');
  };
  
  const handleCollaboratorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'collaboratorCode' ? value.toUpperCase().replace(/\s/g, '') : value;
    setCurrentCollaborator(prev => ({ ...prev, [name]: finalValue }));
  };
  
  const handleAddNewCollaborator = () => {
    setCurrentCollaborator({ ...emptyCollaborator, companyId: selectedCompany?.id || '' });
    setIsEditingCollaborator(false);
    setPhotoFile(null);
  };

  const handleEditCollaborator = (collaborator: Collaborator) => {
    setCurrentCollaborator(collaborator);
    setIsEditingCollaborator(true);
    setPhotoFile(null);
    setCollaboratorModalMode('add');
    document.getElementById('collaborator-modal-content')?.scrollTo(0, 0);
  };

  const handleCancelEditCollaborator = () => {
      handleAddNewCollaborator(); // Resets state
      setCollaboratorModalMode('view');
  };

  const handleSubmitCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setIsSubmittingCollaborator(true);
    
    let dataToSubmit = { ...currentCollaborator };
    
    try {
        if (photoFile) {
            const newPhotoUrl = await uploadImage(photoFile);
            dataToSubmit.photoUrl = newPhotoUrl;
        }

        if (isEditingCollaborator) {
            await updateCollaborator(dataToSubmit as Collaborator);
        } else {
            await addCollaborator({ ...dataToSubmit, companyId: selectedCompany.id } as Omit<Collaborator, 'id' | 'createdAt'>);
        }
        
        const data = await getCollaboratorsByCompany(selectedCompany.id);
        setCollaborators(data);

        if(isEditingCollaborator) {
            setCollaboratorModalMode('view');
        }
        handleAddNewCollaborator(); // Reset form for next entry
        
    } catch (error) {
        console.error("Failed to submit collaborator", error);
    } finally {
        setIsSubmittingCollaborator(false);
    }
  };

  const handleDeleteCollaboratorClick = (id: string) => {
    setCollaboratorToDelete(id);
    setIsConfirmCollaboratorDeleteOpen(true);
  };

  const handleConfirmCollaboratorDelete = async () => {
    if (collaboratorToDelete && selectedCompany) {
      try {
        await deleteCollaborator(collaboratorToDelete);
        const data = await getCollaboratorsByCompany(selectedCompany.id);
        setCollaborators(data);
      } catch (error) {
          console.error("Failed to delete collaborator", error);
      } finally {
        setCollaboratorToDelete(null);
        setIsConfirmCollaboratorDeleteOpen(false);
      }
    }
  };
  
  // --- Vehicle Functions ---
    const handleOpenVehicleModal = (company: ParticipantCompany) => {
        setSelectedCompany(company);
        setIsVehicleModalOpen(true);
    };

    const handleCloseVehicleModal = () => {
        stopCamera();
        setIsVehicleModalOpen(false);
        setSelectedCompany(null);
        setVehicles([]);
        setVehicleSearchTerm('');
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

    const handleAddNewVehicle = () => {
        setCurrentVehicle({ ...emptyVehicle, companyId: selectedCompany?.id || '' });
        setIsEditingVehicle(false);
        setVehiclePhotoFile(null);
    };

    const handleEditVehicle = (vehicle: Vehicle) => {
        setCurrentVehicle(vehicle);
        setIsEditingVehicle(true);
        setVehiclePhotoFile(null);
        setStockModalMode('add');
        document.getElementById('vehicle-modal-content')?.scrollTo(0, 0);
    };

    const handleCancelEditVehicle = () => {
        handleAddNewVehicle();
        setStockModalMode('view');
    };

    const handleVehicleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) return;
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

            const data = await getVehiclesByCompany(selectedCompany.id);
            setVehicles(data);

            if (isEditingVehicle) {
                setStockModalMode('view');
            }
            handleAddNewVehicle();

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
        if (vehicleToDelete && selectedCompany) {
            try {
                await deleteVehicle(vehicleToDelete);
                const data = await getVehiclesByCompany(selectedCompany.id);
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
        if (!selectedCompany) return;

        const requiredColumns = ['Marca', 'Modelo', 'Placa'];
        const fileColumns = fields.map(f => f.trim());

        if (!requiredColumns.every(col => fileColumns.includes(col))) {
            setImportError(`O arquivo precisa conter as colunas obrigatórias: ${requiredColumns.join(', ')}.`);
            setIsImporting(false);
            return;
        }

        const newVehicles: Omit<Vehicle, 'id' | 'createdAt'>[] = data
            // FIX: Add an explicit return type to the map callback to prevent type widening on the 'status' property.
            .map((row: any): Omit<Vehicle, 'id' | 'createdAt'> | null => {
                const trimmedRow = Object.keys(row).reduce((acc, key) => {
                    acc[key.trim()] = row[key];
                    return acc;
                }, {} as any);

                const marca = trimmedRow['Marca']?.toString().trim();
                const model = trimmedRow['Modelo']?.toString().trim();
                const placa = trimmedRow['Placa']?.toString().trim();

                if (!marca || !model || !placa) {
                    return null;
                }
                return {
                    marca,
                    model,
                    placa,
                    photoUrl: DEFAULT_VEHICLE_PHOTO,
                    status: 'Disponível',
                    companyId: selectedCompany.id,
                };
            })
            .filter((v): v is Omit<Vehicle, 'id' | 'createdAt'> => v !== null);

        if (newVehicles.length === 0) {
            setImportError('Nenhum veículo válido encontrado na planilha.');
            setIsImporting(false);
            return;
        }

        try {
            await apiBulkAddVehicles(newVehicles);
            setImportSuccessMessage(`${newVehicles.length} veículo(s) importado(s) com sucesso!`);
            
            const updatedData = await getVehiclesByCompany(selectedCompany.id);
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
        const headers = 'Marca,Modelo,Placa';
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
        if (!selectedCompany) return;
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


  const filteredCompanies = useMemo(() =>
    companies.filter(company =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.boothCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.responsible?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [companies, searchTerm]
  );
  
  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c =>
        c.name.toLowerCase().includes(collaboratorSearchTerm.toLowerCase()) ||
        c.collaboratorCode.toLowerCase().includes(collaboratorSearchTerm.toLowerCase())
    );
  }, [collaborators, collaboratorSearchTerm]);

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearchTerm) {
        return vehicles;
    }
    return vehicles.filter(v =>
        v.placa && v.placa.includes(vehicleSearchTerm)
    );
  }, [vehicles, vehicleSearchTerm]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="hidden md:block text-3xl font-bold">Gerenciar Empresas Participantes</h2>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
          <Input id="search" label="" placeholder="Buscar empresa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-64 mb-0" />
          <Button onClick={() => handleOpenModal()} className="flex-shrink-0">Adicionar Empresa</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map(company => {
          const companyButtons = allButtons.filter(b => company.buttonIds.includes(b.id));
          const isActive = activeCompanyId === company.id;
          const stats = companyStats[company.id] || { collaborators: 0, stock: 0 };


          return (
            <div 
                key={company.id} 
                className={`bg-card p-5 rounded-lg shadow-md flex flex-col justify-between transition-all duration-300 ${isActive ? 'ring-2 ring-primary' : 'ring-2 ring-transparent'}`}
                onClick={() => handleCardClick(company.id)}
            >
              <div className="flex-grow cursor-pointer">
                <div className="flex items-start gap-4 mb-3">
                  <img src={company.logoUrl || 'https://via.placeholder.com/150?text=Logo'} alt={`${company.name} logo`} className="w-16 h-16 object-contain rounded-md bg-secondary p-1 flex-shrink-0" />
                  <div className="flex-grow overflow-hidden">
                      <h3 className="text-xl font-bold text-primary truncate">{company.name}</h3>
                      <p className="text-sm text-text-secondary">Cód. Estande: {company.boothCode}</p>
                  </div>
                </div>
                <div className="border-t border-border my-3"></div>
                <p><strong>Responsável:</strong> {company.responsible || 'N/D'}</p>
                <p><strong>Email:</strong> {company.contact || 'N/D'}</p>
                <p className="mb-3"><strong>Telefone:</strong> {company.responsiblePhone || 'N/D'}</p>

                <div className="flex justify-between text-sm mt-3 font-semibold">
                    <p>Colaboradores: <span className="text-primary">{stats.collaborators}</span></p>
                    <p>Estoque: <span className="text-primary">{stats.stock}</span></p>
                </div>
                
                <div className="border-t border-border pt-3 mt-3">
                    <h4 className="font-semibold mb-2 text-sm">Botões de Ação:</h4>
                    {companyButtons.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {companyButtons.map(b => (
                                <span key={b.id} className="text-xs bg-secondary text-primary font-medium py-1 px-2 rounded-full">
                                    {b.label}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary">Nenhum botão configurado.</p>
                    )}
                </div>
              </div>
              
              {isActive && (
                 <div className="mt-4 pt-4 border-t border-border flex-shrink-0 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" onClick={() => handleOpenModal(company)} className="text-sm w-full">Editar</Button>
                        <Button variant="danger" onClick={() => handleDeleteClick(company.id)} className="text-sm w-full">Excluir</Button>
                        <Button variant="secondary" onClick={() => { setSelectedCompany(company); setIsCollaboratorChoiceModalOpen(true); }} className="text-sm w-full col-span-2">Colaboradores</Button>
                        <Button variant="secondary" onClick={() => { setSelectedCompany(company); setIsStockChoiceModalOpen(true); }} className="text-sm w-full col-span-2">Estoque</Button>
                    </div>
                 </div>
              )}

            </div>
          )
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Empresa' : 'Adicionar Empresa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" name="name" label="Nome da Empresa" value={currentCompany.name} onChange={handleChange} required />
          <Input id="boothCode" name="boothCode" label="Código do Estande" value={currentCompany.boothCode} onChange={handleChange} required />
          <div>
            <label className="block text-sm font-medium mb-1">
                Logo da Empresa
            </label>
            <div className="mt-2 flex items-center gap-4">
                {currentCompany.logoUrl && (
                    <img src={currentCompany.logoUrl} alt="Logo preview" className="h-16 w-16 object-contain rounded-md bg-secondary" />
                )}
                <div className="flex items-center">
                    <label htmlFor="logoUrl" className="cursor-pointer inline-block bg-primary hover:bg-primary-dark text-black font-bold py-2 px-4 rounded-lg transition-colors">
                        Upload de arquivo
                    </label>
                    <input
                        id="logoUrl"
                        name="logoUrl"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <span className="ml-3 text-sm text-text-secondary truncate max-w-xs">{logoFileName || 'Nenhum arquivo selecionado'}</span>
                </div>
            </div>
          </div>
          <Input id="responsible" name="responsible" label="Responsável" value={currentCompany.responsible || ''} onChange={handleChange} />
          <Input id="contact" name="contact" label="Email de Contato" type="email" value={currentCompany.contact || ''} onChange={handleChange} />
          <Input id="responsiblePhone" name="responsiblePhone" label="Telefone do Responsável" type="tel" value={currentCompany.responsiblePhone || ''} onChange={handleChange} />
          
          <div>
            <h4 className="font-semibold mb-2">Botões de Ação Associados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                {allButtons
                  .filter(button => !button.label.startsWith('__'))
                  .map(button => (
                    <label key={button.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                        <input
                            type="checkbox"
                            checked={currentCompany.buttonIds.includes(button.id)}
                            onChange={() => handleButtonToggle(button.id)}
                            className="form-checkbox rounded text-primary focus:ring-primary bg-background border-border"
                        />
                        <span className="truncate">{button.label}</span>
                    </label>
                ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Collaborator Choice Modal */}
      <Modal isOpen={isCollaboratorChoiceModalOpen} onClose={() => setIsCollaboratorChoiceModalOpen(false)} title={`Gerenciar Colaboradores de ${selectedCompany?.name}`}>
          <div className="flex flex-col gap-4">
              <p className="text-center text-text-secondary">O que você gostaria de fazer?</p>
              <Button onClick={() => {
                  setCollaboratorModalMode('add');
                  handleAddNewCollaborator();
                  setIsCollaboratorChoiceModalOpen(false);
                  handleOpenCollaboratorsModal(selectedCompany!);
              }} className="w-full text-lg py-3">
                  Adicionar Colaborador
              </Button>
              <Button onClick={() => {
                  setCollaboratorModalMode('view');
                  setCollaboratorSearchTerm('');
                  setIsCollaboratorChoiceModalOpen(false);
                  handleOpenCollaboratorsModal(selectedCompany!);
              }} variant="secondary" className="w-full text-lg py-3">
                  Ver Colaboradores
              </Button>
          </div>
      </Modal>

      {/* Stock Choice Modal */}
      <Modal isOpen={isStockChoiceModalOpen} onClose={() => setIsStockChoiceModalOpen(false)} title={`Gerenciar Estoque de ${selectedCompany?.name}`}>
          <div className="flex flex-col gap-4">
              <p className="text-center text-text-secondary">O que você gostaria de fazer?</p>
              <Button onClick={() => {
                  setStockModalMode('add');
                  handleAddNewVehicle();
                  setIsStockChoiceModalOpen(false);
                  handleOpenVehicleModal(selectedCompany!);
              }} className="w-full text-lg py-3">
                  Adicionar Estoque
              </Button>
              <Button onClick={() => {
                  setStockModalMode('view');
                  setVehicleSearchTerm('');
                  setIsStockChoiceModalOpen(false);
                  handleOpenVehicleModal(selectedCompany!);
              }} variant="secondary" className="w-full text-lg py-3">
                  Ver Estoque
              </Button>
          </div>
      </Modal>


      {/* Collaborators Modal */}
      <Modal 
        isOpen={isCollaboratorModalOpen} 
        onClose={handleCloseCollaboratorsModal} 
        title={collaboratorModalMode === 'add' ? (isEditingCollaborator ? `Editar Colaborador` : `Adicionar Colaborador para ${selectedCompany?.name}`) : `Colaboradores de ${selectedCompany?.name}`}
      >
        <div id="collaborator-modal-content" className="space-y-6 max-h-[70vh] overflow-y-auto">
          {collaboratorModalMode === 'add' && (
              <form onSubmit={handleSubmitCollaborator} className="space-y-4 p-4 border-t border-border bg-secondary rounded-b-lg">
                  <div className="flex items-center gap-4">
                      <img src={currentCollaborator.photoUrl || 'https://via.placeholder.com/150'} alt="Preview" className="w-16 h-16 rounded-full object-cover"/>
                      <div>
                          <label htmlFor="collaborator-photo-upload" className="cursor-pointer bg-secondary hover:bg-secondary-hover text-text font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                              Escolher Foto
                          </label>
                          <input id="collaborator-photo-upload" type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" />
                      </div>
                  </div>
                  <Input id="name" name="name" label="Nome Completo" value={currentCollaborator.name} onChange={handleCollaboratorChange} required />
                  <Input id="collaboratorCode" name="collaboratorCode" label="Código do Colaborador" value={currentCollaborator.collaboratorCode} onChange={handleCollaboratorChange} required />
                  <Input id="role" name="role" label="Cargo / Função" value={currentCollaborator.role || ''} onChange={handleCollaboratorChange} />
                  <Input id="email" name="email" label="Email" type="email" value={currentCollaborator.email || ''} onChange={handleCollaboratorChange} />
                  <Input id="phone" name="phone" label="Telefone" type="tel" value={currentCollaborator.phone || ''} onChange={handleCollaboratorChange} />

                  <div className="flex justify-end gap-2">
                      {isEditingCollaborator && <Button type="button" variant="secondary" onClick={handleCancelEditCollaborator}>Cancelar Edição</Button>}
                      <Button type="submit" disabled={isSubmittingCollaborator}>
                          {isSubmittingCollaborator ? <div className="flex justify-center items-center h-5 w-32"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div></div> : (isEditingCollaborator ? 'Salvar Alterações' : 'Adicionar Colaborador')}
                      </Button>
                  </div>
              </form>
          )}

          {collaboratorModalMode === 'view' && (
            <div className="border-t border-border pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                <Input
                    id="collaborator-search"
                    label=""
                    placeholder="Buscar por nome ou código..."
                    value={collaboratorSearchTerm}
                    onChange={(e) => setCollaboratorSearchTerm(e.target.value)}
                    className="flex-grow w-full sm:w-auto mb-0"
                />
                <Button onClick={() => { handleAddNewCollaborator(); setCollaboratorModalMode('add'); }} className="w-full sm:w-auto">Adicionar Novo</Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {collaboratorsLoading ? <LoadingSpinner /> : (
                  filteredCollaborators.length > 0 ? filteredCollaborators.map(collab => (
                    <div key={collab.id} className="flex justify-between items-center p-2 bg-secondary rounded-md">
                      <div className="flex items-center gap-3 flex-grow overflow-hidden">
                          <img src={collab.photoUrl || 'https://via.placeholder.com/150'} alt={collab.collaboratorCode} className="w-10 h-10 rounded-full object-cover" />
                          <div className="truncate">
                            <p className="font-semibold truncate">{collab.name}</p>
                            <p className="text-sm text-text-secondary truncate">{collab.collaboratorCode}</p>
                          </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button variant="secondary" className="py-1 px-2 text-xs" onClick={() => handleEditCollaborator(collab)}>Editar</Button>
                        <Button variant="danger" className="py-1 px-2 text-xs" onClick={() => handleDeleteCollaboratorClick(collab.id)}>Excluir</Button>
                      </div>
                    </div>
                  )) : <p className="text-center text-text-secondary py-4">Nenhum colaborador encontrado.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
      
      {/* Vehicle Stock Modal */}
      <Modal 
        isOpen={isVehicleModalOpen} 
        onClose={handleCloseVehicleModal} 
        title={stockModalMode === 'add' ? (isEditingVehicle ? 'Editar Veículo' : `Adicionar Veículo para ${selectedCompany?.name}`) : `Estoque de ${selectedCompany?.name}`}
      >
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
        <div id="vehicle-modal-content" className="space-y-6 max-h-[70vh] overflow-y-auto">
            {stockModalMode === 'add' && (
                <form onSubmit={handleVehicleSubmit} className="p-4 border-t border-border rounded-b-lg space-y-4 bg-secondary">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-shrink-0">
                        <img src={(currentVehicle as Vehicle).photoUrl || DEFAULT_VEHICLE_PHOTO} alt="Preview" className="w-24 h-24 md:w-32 md:h-32 rounded-lg object-cover bg-background" />
                        </div>
                        <div className="flex-grow space-y-2 w-full">
                        <Button type="button" onClick={startCamera} className="w-full">Tirar Foto</Button>
                        <label htmlFor="vehicle-photo-upload" className="cursor-pointer w-full inline-block text-center bg-secondary hover:bg-secondary-hover text-text font-bold py-2 px-4 rounded-lg transition-colors">
                            Enviar Arquivo
                        </label>
                        <input id="vehicle-photo-upload" type="file" accept="image/*" onChange={handleVehiclePhotoFileChange} className="hidden" />
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
            )}

            {stockModalMode === 'view' && (
                <div className="border-t border-border pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <Input
                            id="vehicle-search"
                            label=""
                            placeholder="Buscar por Placa..."
                            value={vehicleSearchTerm}
                            onChange={(e) => setVehicleSearchTerm(e.target.value.toUpperCase())}
                            className="flex-grow w-full sm:w-auto mb-0"
                        />
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" onClick={handleOpenImportModal} className="flex-grow">Importar</Button>
                        <Button onClick={() => { handleAddNewVehicle(); setStockModalMode('add'); }} className="flex-grow">Adicionar Novo</Button>
                      </div>
                    </div>
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
            )}
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Estoque via Planilha">
          <div className="space-y-4">
              <p className="text-text-secondary">Envie um arquivo <code className="bg-background text-primary px-1 rounded">.csv, .xls ou .xlsx</code> com as colunas: <code className="bg-background text-primary px-1 rounded">Marca</code> (obrigatório), <code className="bg-background text-primary px-1 rounded">Modelo</code> (obrigatório), <code className="bg-background text-primary px-1 rounded">Placa</code> (obrigatório)</p>
              
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
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta empresa?"
        confirmText="Excluir"
      />
      <ConfirmationModal
        isOpen={isConfirmCollaboratorDeleteOpen}
        onClose={() => setIsConfirmCollaboratorDeleteOpen(false)}
        onConfirm={handleConfirmCollaboratorDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este colaborador?"
        confirmText="Excluir"
      />
       <ConfirmationModal
        isOpen={isConfirmVehicleDeleteOpen}
        onClose={() => setIsConfirmVehicleDeleteOpen(false)}
        onConfirm={handleConfirmVehicleDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este veículo do estoque?"
        confirmText="Excluir"
      />
       <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
    `}</style>
    </div>
  );
};

export default ParticipantCompaniesManager;
