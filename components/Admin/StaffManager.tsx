import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    getStaffByEvent, 
    addStaffAndAssignToEvent, 
    updateStaffAndAssignment, 
    unassignStaffFromEvent,
    deleteStaff,
    getEvents, 
    getOrganizerCompanyById, 
    getDepartmentsByEvent, 
    uploadImage, 
    getStaffByOrganizer,
    assignStaffToEvent
} from '../../services/api';
import { Staff, Event, OrganizerCompany, Department } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';

interface Props {
  eventId: string;
}

const emptyStaff: Omit<Staff, 'id'> = {
  name: '', personalCode: '', organizerCompanyId: '', photoUrl: '', phone: '', departmentId: '', role: ''
};

const StaffManager: React.FC<Props> = ({ eventId }) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [allOrganizerStaff, setAllOrganizerStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizer, setOrganizer] = useState<OrganizerCompany | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CHOICE' | 'CREATE' | 'LINK_EXISTING'>('CHOICE');
  const [isConfirmUnlinkModalOpen, setIsConfirmUnlinkModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [itemToUnlink, setItemToUnlink] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [currentStaff, setCurrentStaff] = useState<Omit<Staff, 'id'> | Staff>(emptyStaff);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFileName, setPhotoFileName] = useState('');
  
  const [selectedStaffToLink, setSelectedStaffToLink] = useState<string[]>([]);
  const [linkTargetDepartment, setLinkTargetDepartment] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allEvents = await getEvents();
      const currentEvent = allEvents.find(e => e.id === eventId);
      
      if (currentEvent) {
        const [staffData, departmentsData, organizerData, allStaffData] = await Promise.all([
            getStaffByEvent(eventId),
            getDepartmentsByEvent(eventId),
            getOrganizerCompanyById(currentEvent.organizerCompanyId),
            getStaffByOrganizer(currentEvent.organizerCompanyId)
        ]);

        setOrganizer(organizerData);
        setStaff(staffData);
        setAllOrganizerStaff(allStaffData);
        setDepartments(departmentsData);
        if (departmentsData.length > 0) {
            setLinkTargetDepartment(departmentsData[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch staff data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAddModal = () => {
    setModalMode('CHOICE');
    setIsMainModalOpen(true);
  };

  const handleOpenEditModal = (staffMember: Staff) => {
    setPhotoFile(null);
    setPhotoFileName('');
    setCurrentStaff({ ...staffMember });
    setIsEditing(true);
    setModalMode('CREATE');
    setIsMainModalOpen(true);
  };

  const handleOpenCreateNew = () => {
    setPhotoFile(null);
    setPhotoFileName('');
    if (organizer) {
        setCurrentStaff({...emptyStaff, organizerCompanyId: organizer.id});
        setIsEditing(false);
        setModalMode('CREATE');
    }
  };

  const handleOpenLinkExisting = () => {
    setSelectedStaffToLink([]);
    if (departments.length > 0) {
        setLinkTargetDepartment(departments[0].id);
    }
    setModalMode('LINK_EXISTING');
  };
  
  const handleCloseModal = () => setIsMainModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'personalCode' ? value.toUpperCase().replace(/\s/g, '') : value;
    setCurrentStaff(prev => ({ ...prev, [name]: finalValue }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setPhotoFile(file);
        setPhotoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCurrentStaff(prev => ({ ...prev, photoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffData = { ...currentStaff };

    try {
        if (photoFile) {
            const newPhotoUrl = await uploadImage(photoFile);
            staffData.photoUrl = newPhotoUrl;
        } else if (!isEditing && !staffData.photoUrl) {
            staffData.photoUrl = 'https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/molduras/Screenshot%202025-08-25%20182827.png';
        }

        if (isEditing) {
          await updateStaffAndAssignment(staffData as Staff, eventId);
        } else {
          await addStaffAndAssignToEvent(staffData as Omit<Staff, 'id'>, eventId);
        }
        fetchData();
        handleCloseModal();
    } catch (error) {
        console.error('Failed to submit staff data', error);
    }
  };
  
  const handleUnlinkClick = (id: string) => {
    setItemToUnlink(id);
    setIsConfirmUnlinkModalOpen(true);
  };

  const handleConfirmUnlink = async () => {
    if (itemToUnlink) {
      try {
        await unassignStaffFromEvent(itemToUnlink, eventId);
        fetchData();
      } catch (error) {
        console.error("Failed to unlink staff:", error);
      } finally {
        setItemToUnlink(null);
        setIsConfirmUnlinkModalOpen(false);
      }
    }
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteStaff(itemToDelete);
        fetchData();
      } catch (error) {
        console.error("Failed to delete staff:", error);
      } finally {
        setItemToDelete(null);
        setIsConfirmDeleteModalOpen(false);
      }
    }
  };

  const handleToggleStaffToLink = (staffId: string) => {
    setSelectedStaffToLink(prev => 
        prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const handleLinkStaff = async () => {
    if (selectedStaffToLink.length === 0 || !linkTargetDepartment) {
        alert('Por favor, selecione pelo menos um membro da equipe e um departamento de destino.');
        return;
    }
    setIsLinking(true);
    try {
        const linkPromises = selectedStaffToLink.map(staffId => {
            return assignStaffToEvent(staffId, eventId, linkTargetDepartment);
        });
        await Promise.all(linkPromises);
        fetchData();
        handleCloseModal();
    } catch (error) {
        console.error('Failed to link staff', error);
    } finally {
        setIsLinking(false);
    }
  };


  const getDepartmentName = (departmentId?: string) => {
    return departments.find(d => d.id === departmentId)?.name || 'N/A';
  }

  const staffAvailableToLink = useMemo(() => {
      const currentEventStaffIds = new Set(staff.map(s => s.id));
      return allOrganizerStaff.filter(s => !currentEventStaffIds.has(s.id));
  }, [staff, allOrganizerStaff]);

  const filteredStaff = useMemo(() =>
    staff.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.personalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.role && s.role.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [staff, searchTerm]
  );

  if (loading) return <LoadingSpinner />;

  const renderModalContent = () => {
    switch(modalMode) {
        case 'CHOICE':
            return (
                <div className="flex flex-col gap-4">
                    <Button onClick={handleOpenCreateNew} className="w-full text-lg py-4">
                        Criar Novo Membro
                    </Button>
                    <Button onClick={handleOpenLinkExisting} variant="secondary" className="w-full text-lg py-4">
                        Vincular Membro Existente
                    </Button>
                </div>
            );
        case 'CREATE':
            return (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input id="name" name="name" label="Nome Completo" value={currentStaff.name} onChange={handleChange} required />
                    <Input id="personalCode" name="personalCode" label="Código Pessoal" value={(currentStaff as Staff).personalCode || ''} onChange={handleChange} required />
                    <Input id="role" name="role" label="Cargo / Função" value={(currentStaff as Staff).role || ''} onChange={handleChange} placeholder="Ex: Vendedor, Suporte" />
                    <div>
                        <label htmlFor="departmentId" className="block text-sm font-medium mb-1 text-text">Departamento</label>
                        <select
                            id="departmentId"
                            name="departmentId"
                            value={(currentStaff as Staff).departmentId || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            required
                        >
                            <option value="" disabled>Selecione um departamento</option>
                            {departments.map(dep => (
                                <option key={dep.id} value={dep.id}>{dep.name}</option>
                            ))}
                        </select>
                    </div>
                    <Input id="phone" name="phone" label="Telefone" type="tel" value={(currentStaff as Staff).phone || ''} onChange={handleChange} />
                    <div>
                        <label className="block text-sm font-medium mb-1">Foto</label>
                        <div className="mt-2 flex items-center gap-4">
                            {currentStaff.photoUrl && <img src={currentStaff.photoUrl} alt="Foto preview" className="h-16 w-16 object-cover rounded-full bg-secondary" />}
                            <div className="flex items-center">
                                <label htmlFor="photoUrl" className="cursor-pointer inline-block bg-primary hover:bg-primary-dark text-black font-bold py-2 px-4 rounded-lg transition-colors">
                                    Upload de arquivo
                                </label>
                                <input id="photoUrl" name="photoUrl" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                <span className="ml-3 text-sm text-text-secondary truncate max-w-xs">{photoFileName || 'Nenhum arquivo selecionado'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button type="submit">Salvar</Button>
                    </div>
                </form>
            );
        case 'LINK_EXISTING':
            return (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Selecione os membros para vincular a este evento</h3>
                    <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-2 space-y-2">
                        {staffAvailableToLink.length > 0 ? staffAvailableToLink.map(member => (
                            <label key={member.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary cursor-pointer">
                                <input type="checkbox" checked={selectedStaffToLink.includes(member.id)} onChange={() => handleToggleStaffToLink(member.id)} className="form-checkbox h-5 w-5 rounded text-primary focus:ring-primary bg-background border-border"/>
                                <img src={member.photoUrl} alt={member.name} className="w-10 h-10 rounded-full object-cover"/>
                                <span className="font-medium">{member.name}</span>
                            </label>
                        )) : (
                           <p className="text-center text-text-secondary p-4">Todos os membros da sua equipe já estão neste evento.</p> 
                        )}
                    </div>
                    <div>
                        <label htmlFor="link-department" className="block text-sm font-medium mb-1 text-text">Atribuir ao Departamento</label>
                        <select id="link-department" value={linkTargetDepartment} onChange={(e) => setLinkTargetDepartment(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary" required>
                            {departments.map(dep => (
                                <option key={dep.id} value={dep.id}>{dep.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleLinkStaff} disabled={isLinking || selectedStaffToLink.length === 0}>
                            {isLinking ? <LoadingSpinner/> : `Vincular ${selectedStaffToLink.length} Membro(s)`}
                        </Button>
                    </div>
                </div>
            );
    }
  }
  
  const getModalTitle = () => {
    if (modalMode === 'CREATE') return isEditing ? 'Editar Membro' : 'Adicionar Novo Membro';
    if (modalMode === 'LINK_EXISTING') return 'Vincular Membro Existente';
    return 'Adicionar Membro da Equipe';
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="hidden md:block text-3xl font-bold">Gerenciar Equipe Organizadora</h2>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
          <Input id="search" label="" placeholder="Buscar membro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-64 mb-0" />
          <Button onClick={handleOpenAddModal} className="flex-shrink-0" disabled={!organizer}>Adicionar Membro</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map(member => (
            <div key={member.id} className="bg-card p-5 rounded-lg shadow-md flex flex-col justify-between">
                <div className="flex items-start gap-4 mb-4 flex-grow">
                    <img src={member.photoUrl || 'https://via.placeholder.com/150'} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
                    <div>
                        <h3 className="text-lg font-bold">{member.name}</h3>
                        <p className="text-sm font-semibold text-primary">{member.role || 'Cargo não definido'}</p>
                        <p className="text-sm text-text-secondary">Cód: {member.personalCode}</p>
                        <p className="text-sm text-text-secondary">Depto: {getDepartmentName(member.departmentId)}</p>
                        <p className="text-sm text-text-secondary">Tel: {member.phone || 'N/D'}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border flex-shrink-0">
                    <Button variant="secondary" onClick={() => handleOpenEditModal(member)} className="text-sm w-full">Editar</Button>
                    <Button variant="secondary" onClick={() => handleUnlinkClick(member.id)} className="text-sm w-full">Desvincular</Button>
                    <Button variant="danger" onClick={() => handleDeleteClick(member.id)} className="text-sm w-full">Excluir</Button>
                </div>
            </div>
        ))}
      </div>
      {filteredStaff.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg shadow-md mt-6">
            <h3 className="text-xl font-semibold">Nenhum membro da equipe neste evento</h3>
            <p className="text-text-secondary mt-2">Clique em "Adicionar Membro" para começar.</p>
        </div>
      )}


      <Modal isOpen={isMainModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
        {renderModalContent()}
      </Modal>
      
      <ConfirmationModal
        isOpen={isConfirmUnlinkModalOpen}
        onClose={() => setIsConfirmUnlinkModalOpen(false)}
        onConfirm={handleConfirmUnlink}
        title="Confirmar Desvinculação"
        message="Tem certeza que deseja desvincular este membro deste evento? Ele ainda permanecerá na lista de membros da equipe da sua organização e poderá ser vinculado novamente."
        confirmText="Desvincular"
      />

      <ConfirmationModal
        isOpen={isConfirmDeleteModalOpen}
        onClose={() => setIsConfirmDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão Permanente"
        message="Tem certeza que deseja excluir este membro da equipe PERMANENTEMENTE? Esta ação removerá o membro de TODOS os eventos e da sua organização. Esta ação não pode ser desfeita."
        confirmText="Excluir Permanentemente"
      />
    </div>
  );
};

export default StaffManager;