import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { triad3Logo } from '../assets/logo';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { uploadImage, updateUserPhoto, updateCollaborator, getCompanyCallsByEvent, getTelaoRequestsByEvent } from '../services/api';
import { UserRole, Collaborator, CallStatus, TelaoRequestStatus } from '../types';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout, updateAuthUser } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ name: string; photoUrl?: string; } | null>(null);
  const [collaboratorInfo, setCollaboratorInfo] = useState<Collaborator | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Admin photo modal state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Collaborator modals state
  const [isCollabPhotoModalOpen, setIsCollabPhotoModalOpen] = useState(false);
  const [collabNewPhotoFile, setCollabNewPhotoFile] = useState<File | null>(null);
  const [collabNewPhotoPreview, setCollabNewPhotoPreview] = useState<string | null>(null);
  const [isCollabUpdating, setIsCollabUpdating] = useState(false);
  const [collabUpdateError, setCollabUpdateError] = useState<string | null>(null);

  const [pendingNotificationsCount, setPendingNotificationsCount] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.ORGANIZER) || !user.eventId) {
        setPendingNotificationsCount(0);
        return;
    }

    const eventId = user.eventId;
    let isMounted = true;

    const fetchPendingNotifications = async () => {
        try {
            const [calls, telaoRequests] = await Promise.all([
                getCompanyCallsByEvent(eventId),
                getTelaoRequestsByEvent(eventId),
            ]);
            if (isMounted) {
                const pendingCalls = calls.filter(c => c.status === CallStatus.PENDENTE).length;
                const pendingTelao = telaoRequests.filter(r => r.status === TelaoRequestStatus.PENDENTE).length;
                setPendingNotificationsCount(pendingCalls + pendingTelao);
            }
        } catch (e) {
            console.error("Failed to fetch pending notifications for header", e);
        }
    };

    fetchPendingNotifications();
    const intervalId = setInterval(fetchPendingNotifications, 30000); // Poll every 30 seconds

    return () => {
        isMounted = false;
        clearInterval(intervalId);
    };

  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/informes/')) {
        const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
        if (checkinInfoRaw) {
            try {
                const info = JSON.parse(checkinInfoRaw);
                setStaffInfo({ name: info.staffName || '', photoUrl: info.staffPhotoUrl });
                setCollaboratorInfo(null);
            } catch (e) {
                setStaffInfo(null);
            }
        }
    } else if (location.pathname.startsWith('/collaborator/')) {
        const checkinInfoRaw = sessionStorage.getItem('collaboratorCheckinInfo');
        if (checkinInfoRaw) {
            try {
                const info = JSON.parse(checkinInfoRaw);
                setCollaboratorInfo(info.collaborator || null);
                setStaffInfo(null);
            } catch (e) {
                setCollaboratorInfo(null);
            }
        }
    } else {
        setStaffInfo(null);
        setCollaboratorInfo(null);
    }
  }, [location.pathname]);

  // --- Admin Photo Handlers ---
  const openPhotoModal = () => {
    setIsUserMenuOpen(false);
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    setUploadError(null);
    setIsPhotoModalOpen(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoSave = async () => {
    if (!newPhotoFile || !user) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const newPhotoUrl = await uploadImage(newPhotoFile);
      const updatedUser = await updateUserPhoto(user.id, newPhotoUrl);
      updateAuthUser(updatedUser);
      setIsPhotoModalOpen(false);
    } catch (error) {
      console.error("Failed to update photo", error);
      setUploadError(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsUploading(false);
    }
  };
  
  // --- Collaborator Profile Handlers ---
  const updateCollaboratorSession = (updatedCollaborator: Collaborator) => {
    const checkinInfoRaw = sessionStorage.getItem('collaboratorCheckinInfo');
    if (checkinInfoRaw) {
        const info = JSON.parse(checkinInfoRaw);
        info.collaborator = updatedCollaborator;
        sessionStorage.setItem('collaboratorCheckinInfo', JSON.stringify(info));
    }
  };
  
  const openCollaboratorPhotoModal = () => {
    setIsUserMenuOpen(false);
    setCollabNewPhotoFile(null);
    setCollabNewPhotoPreview(null);
    setCollabUpdateError(null);
    setIsCollabPhotoModalOpen(true);
  };

  const handleCollaboratorPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setCollabNewPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCollabNewPhotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleCollaboratorPhotoSave = async () => {
    if (!collabNewPhotoFile || !collaboratorInfo) return;
    setIsCollabUpdating(true);
    setCollabUpdateError(null);
    try {
        const newPhotoUrl = await uploadImage(collabNewPhotoFile);
        const updatedCollaborator = await updateCollaborator({ ...collaboratorInfo, photoUrl: newPhotoUrl });
        setCollaboratorInfo(updatedCollaborator);
        updateCollaboratorSession(updatedCollaborator);
        setIsCollabPhotoModalOpen(false);
    } catch (error) {
        setCollabUpdateError(error instanceof Error ? error.message : 'Ocorreu um erro.');
    } finally {
        setIsCollabUpdating(false);
    }
  };

  // Don't render header on login or check-in pages
  if (location.pathname === '/login' || location.pathname === '/') {
    return null;
  }

  return (
    <>
      <header className="bg-card shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to={user?.isMaster ? "/admin/events" : "/"}>
            <img src={triad3Logo} alt="Triad3 Logo" className="h-12 w-12 rounded-full object-cover" />
          </Link>
          <h1 className="text-xl font-bold text-text">
            Central de Inteligência do Evento (CIE)
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated && user ? (
            <>
              <Link to={`/admin/event/${user.eventId}/company-calls-dashboard`} className="relative p-2 rounded-full hover:bg-secondary-hover transition-colors" aria-label="Notificações de chamados">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {pendingNotificationsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow-md">
                          {pendingNotificationsCount}
                      </span>
                  )}
              </Link>
              <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary-hover transition-colors">
                  <img src={user.photoUrl || 'https://via.placeholder.com/150'} alt={user.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary" />
                  <span className="hidden sm:inline font-semibold text-sm">{user.name}</span>
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                    <button
                      onClick={openPhotoModal}
                      className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                    >
                      Trocar Foto
                    </button>
                    <div className="border-t border-border my-1"></div>
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                    >
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : staffInfo ? (
              <>
                <div className="flex items-center gap-2">
                  <img src={staffInfo.photoUrl || 'https://via.placeholder.com/150'} alt={staffInfo.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary" />
                  <span className="hidden sm:inline font-semibold text-sm">{staffInfo.name}</span>
                </div>
                <Link to="/" className="text-sm font-medium text-primary hover:text-blue-500">
                    Voltar
                </Link>
              </>
          ) : collaboratorInfo ? (
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary-hover transition-colors">
                <img src={collaboratorInfo.photoUrl || 'https://via.placeholder.com/150'} alt={collaboratorInfo.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary" />
                <div className="hidden sm:block text-left">
                  <span className="font-semibold text-sm">{collaboratorInfo.name}</span>
                  <p className="text-xs text-text-secondary">{collaboratorInfo.collaboratorCode}</p>
                </div>
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                  <button
                    onClick={openCollaboratorPhotoModal}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                  >
                    Trocar Foto
                  </button>
                  <div className="border-t border-border my-1"></div>
                  <button
                    onClick={() => {
                        sessionStorage.removeItem('collaboratorCheckinInfo');
                        navigate('/');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
              <Link to="/login" className="text-sm font-medium text-primary hover:text-blue-500">
                  Login
              </Link>
          )}
        </div>
      </header>

      <Modal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title="Alterar Foto de Perfil">
        <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-text-secondary">Sua foto atual:</p>
                <img src={user?.photoUrl || 'https://via.placeholder.com/150'} alt="Foto atual" className="w-24 h-24 rounded-full object-cover" />
                
                {newPhotoPreview && (
                    <>
                        <p className="text-sm text-text-secondary mt-2">Nova foto:</p>
                        <img src={newPhotoPreview} alt="Nova foto preview" className="w-24 h-24 rounded-full object-cover" />
                    </>
                )}
            </div>
            
            <div>
                <label htmlFor="photo-upload" className="cursor-pointer w-full inline-block text-center bg-secondary hover:bg-secondary-hover text-text font-bold py-2 px-4 rounded-lg transition-colors">
                    {newPhotoFile ? 'Escolher outra foto' : 'Escolher foto'}
                </label>
                <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                />
            </div>

            {uploadError && <p className="text-red-500 text-sm text-center">{uploadError}</p>}

            <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setIsPhotoModalOpen(false)} disabled={isUploading}>
                    Cancelar
                </Button>
                <Button onClick={handlePhotoSave} disabled={!newPhotoFile || isUploading}>
                    {isUploading ? <LoadingSpinner /> : 'Salvar'}
                </Button>
            </div>
        </div>
      </Modal>

      {/* Collaborator Photo Modal */}
      <Modal isOpen={isCollabPhotoModalOpen} onClose={() => setIsCollabPhotoModalOpen(false)} title="Alterar Foto">
        <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
                <img src={collabNewPhotoPreview || collaboratorInfo?.photoUrl || 'https://via.placeholder.com/150'} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
            </div>
            <div>
                <label htmlFor="collab-photo-upload" className="cursor-pointer w-full inline-block text-center bg-secondary hover:bg-secondary-hover text-text font-bold py-2 px-4 rounded-lg transition-colors">
                    {collabNewPhotoFile ? 'Escolher outra foto' : 'Escolher foto'}
                </label>
                <input id="collab-photo-upload" type="file" accept="image/*" onChange={handleCollaboratorPhotoFileChange} className="hidden" />
            </div>
            {collabUpdateError && <p className="text-red-500 text-sm text-center">{collabUpdateError}</p>}
            <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setIsCollabPhotoModalOpen(false)} disabled={isCollabUpdating}>
                    Cancelar
                </Button>
                <Button onClick={handleCollaboratorPhotoSave} disabled={!collabNewPhotoFile || isCollabUpdating}>
                    {isCollabUpdating ? <LoadingSpinner /> : 'Salvar'}
                </Button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default Header;