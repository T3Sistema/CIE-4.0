import React, { useEffect } from 'react';
import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminLayout from '../../components/Admin/AdminLayout';
import DashboardView from '../../components/Admin/DashboardView';
import ParticipantCompaniesManager from '../../components/Admin/ParticipantCompaniesManager';
import StaffManager from '../../components/Admin/StaffManager';
import ButtonsManager from '../../components/Admin/ButtonsManager';
import NotFoundPage from '../NotFoundPage';
import DepartmentsManager from '../../components/Admin/DepartmentsManager';
import SalesCheckinManager from '../../components/Admin/SalesCheckinManager';
import NotifyCallManager from '../../components/Admin/NotifyCallManager';
import RankingView from '../../components/Admin/RankingView';
import TasksView from '../../components/Admin/TasksView';
import StockControlManager from '../../components/Admin/StockControlManager';
import StockReportView from '../../components/Admin/StockReportView';
import NotificationsManager from '../../components/Admin/NotificationsManager';
import CompanyCallManager from '../../components/Admin/CompanyCallManager';
import CompanyCallsDashboard from '../../components/Admin/CompanyCallsDashboard';
import TelaoRequestsDashboard from '../../components/Admin/TelaoRequestsDashboard';

const EventDashboardPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, updateAuthUser } = useAuth();

  useEffect(() => {
    // Sync the current eventId with the AuthContext for global components like the Header
    if (user && eventId && user.eventId !== eventId) {
      updateAuthUser({ ...user, eventId });
    }
  }, [eventId, user, updateAuthUser]);

  if (!eventId) {
    return <Navigate to="/admin/events" replace />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardView eventId={eventId} />} />
        <Route path="tasks" element={<TasksView eventId={eventId} />} />
        <Route path="ranking" element={<RankingView eventId={eventId} />} />
        <Route path="companies" element={<ParticipantCompaniesManager eventId={eventId} />} />
        <Route path="staff" element={<StaffManager eventId={eventId} />} />
        <Route path="departments" element={<DepartmentsManager eventId={eventId} />} />
        <Route path="buttons" element={<ButtonsManager />} />
        <Route path="sales-checkin" element={<SalesCheckinManager eventId={eventId} />} />
        <Route path="notify-call" element={<NotifyCallManager eventId={eventId} />} />
        <Route path="company-calls" element={<CompanyCallManager eventId={eventId} />} />
        <Route path="company-calls-dashboard" element={<CompanyCallsDashboard />} />
        <Route path="telao-requests" element={<TelaoRequestsDashboard />} />
        <Route path="stock-control" element={<StockControlManager eventId={eventId} />} />
        <Route path="stock-report" element={<StockReportView eventId={eventId} />} />
        <Route path="notifications" element={<NotificationsManager eventId={eventId} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default EventDashboardPage;