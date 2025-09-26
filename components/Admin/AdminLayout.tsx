import React, { useState } from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const BackArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const AdminLayout: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-black font-bold'
        : 'hover:bg-secondary-hover'
    }`;
  
  const showBackButton = user?.isMaster || (user?.role === UserRole.ORGANIZER && user.events && user.events.length > 1);
  const backButtonLink = user?.isMaster ? "/admin/events" : "/organizer/events";

  const menuContent = (
    <>
      {showBackButton && (
        <>
          <Link
            to={backButtonLink}
            onClick={handleLinkClick}
            className="flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-secondary-hover mb-2"
          >
            <BackArrowIcon />
            Voltar para Eventos
          </Link>
          <div className="border-b border-border my-2"></div>
        </>
      )}
      <NavLink to={`/admin/event/${eventId}/dashboard`} end className={navLinkClasses} onClick={handleLinkClick}>
        Dashboard
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/tasks`} className={navLinkClasses} onClick={handleLinkClick}>
        Tarefas Atribuídas
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/ranking`} className={navLinkClasses} onClick={handleLinkClick}>
        Ranking
      </NavLink>
       <NavLink to={`/admin/event/${eventId}/company-calls-dashboard`} className={navLinkClasses} onClick={handleLinkClick}>
        Painel de Chamados
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/telao-requests`} className={navLinkClasses} onClick={handleLinkClick}>
        Solicitações de Telão
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/companies`} className={navLinkClasses} onClick={handleLinkClick}>
        Empresas
      </NavLink>
       <NavLink to={`/admin/event/${eventId}/departments`} className={navLinkClasses} onClick={handleLinkClick}>
        Departamentos
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/staff`} className={navLinkClasses} onClick={handleLinkClick}>
        Equipe
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/buttons`} className={navLinkClasses} onClick={handleLinkClick}>
        Botões de Ação
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/sales-checkin`} className={navLinkClasses} onClick={handleLinkClick}>
        Check-in de Vendas
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/notify-call`} className={navLinkClasses} onClick={handleLinkClick}>
        Chamados (Equipe)
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/company-calls`} className={navLinkClasses} onClick={handleLinkClick}>
        Chamados (Empresas)
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/issue-alert`} className={navLinkClasses} onClick={handleLinkClick}>
        Emitir Alerta 🚨
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/stock-control`} className={navLinkClasses} onClick={handleLinkClick}>
        Log de controle de estoque
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/stock-report`} className={navLinkClasses} onClick={handleLinkClick}>
        Movimentação de Estoque
      </NavLink>
      <NavLink to={`/admin/event/${eventId}/notifications`} className={navLinkClasses} onClick={handleLinkClick}>
        Configurar Notificações
      </NavLink>
    </>
  );

  return (
    <>
      <div className="md:hidden flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Menu</h2>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-md hover:bg-secondary-hover"
          aria-label="Abrir menu"
        >
          <MenuIcon />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
        ></div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-card p-4 shadow-lg transform transition-transform duration-300 ease-in-out md:relative md:inset-auto md:z-auto md:w-64 md:transform-none md:shadow-md md:rounded-lg ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="md:hidden flex justify-end mb-4">
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-md hover:bg-secondary-hover"
                    aria-label="Fechar menu"
                >
                    <CloseIcon />
                </button>
            </div>
            <nav className="space-y-2">
                {menuContent}
            </nav>
        </aside>
        <div className="flex-grow">
          <Outlet />
        </div>
      </div>
    </>
  );
};

export default AdminLayout;