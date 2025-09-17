export enum UserRole {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isMaster: boolean;
  eventId?: string;
  events?: Event[];
  photoUrl?: string;
}

export interface OrganizerCompany {
  id: string;
  name: string;
  responsibleName: string;
  responsibleContact: string;
  responsiblePhone?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  details: string;
  logoUrl: string;
  organizerCompanyId: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  name: string;
  eventId: string;
}

export interface Staff {
  id: string;
  name: string;
  personalCode: string;
  organizerCompanyId: string;
  phone?: string;
  photoUrl?: string;
  departmentId?: string;
  role?: string;
}

export interface ParticipantCompany {
  id: string;
  name: string;
  boothCode: string;
  eventId: string;
  responsible: string;
  contact: string;
  responsiblePhone?: string;
  buttonIds: string[];
  logoUrl?: string;
  canOpenCall?: boolean;
}

export interface Collaborator {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  collaboratorCode: string;
  companyId: string;
  createdAt: string;
  photoUrl?: string;
}

export interface Vehicle {
  id: string;
  companyId: string;
  marca: string;
  model: string;
  placa?: string;
  photoUrl: string;
  createdAt: string;
  status: 'Disponível' | 'Vendido';
  updatedAt?: string;
  soldByCollaboratorId?: string;
}

export enum ReportType {
  OPEN_TEXT = 'open_text',
  MULTIPLE_CHOICE = 'multiple_choice',
  YES_NO = 'yes_no',
  CHECKLIST = 'checklist',
  NOTIFY_CALL = 'notify_call',
}

export interface ReportOption {
  id: string;
  label: string;
}

export interface FollowUpConfig {
  triggerValue: 'Sim' | 'Não';
  question: string;
  type: ReportType.OPEN_TEXT | ReportType.MULTIPLE_CHOICE;
  options?: ReportOption[];
}

export interface ReportButtonConfig {
  id: string;
  label: string;
  question: string;
  type: ReportType;
  options?: ReportOption[];
  followUp?: FollowUpConfig;
  departmentId?: string;
  staffId?: string;
  allowedStaffIds?: string[];
}

export interface ReportSubmission {
  id: string;
  eventId: string;
  boothCode: string;
  staffName: string;
  reportLabel: string;
  response: string;
  timestamp: string;
}

export interface StaffActivity {
    id: string;
    staffId: string;
    description: string;
    timestamp: string;
}

export interface AssignedTask {
  id: string; // activity id
  staffId: string;
  staffName: string;
  companyName: string;
  boothCode?: string;
  actionLabel: string;
  description: string;
  timestamp: string;
  status: 'Pendente' | 'Concluída';
}

export interface CompanySalesData {
    id: string;
    name: string;
    logoUrl?: string;
    salesCount: number;
    collaborators: (Collaborator & { salesCount: number; companyName: string })[];
}

export interface StockMovement {
  id: string;
  staffId: string;
  companyId: string;
  vehicleId: string;
  type: 'Venda' | 'Teste Drive';
  timestamp: string;
}

export interface FullStockMovement {
  id: string;
  type: 'Venda' | 'Teste Drive';
  timestamp: string;
  vehicle: {
    marca: string;
    model: string;
    placa?: string;
    photoUrl?: string;
  } | null;
  company: {
    id: string;
    name: string;
  } | null;
  staff: {
    name: string;
  } | null;
}

export enum CallStatus {
  PENDENTE = 'Pendente',
  CONCLUIDO = 'Concluído',
}

export interface CompanyCall {
  id: string;
  createdAt: string;
  eventId: string;
  participantCompanyId: string;
  departmentId: string;
  collaboratorName: string;
  observation?: string;
  status: CallStatus;
  resolvedByStaffId?: string;
  resolverFeedback?: string;
  resolvedAt?: string;
  // Joined data for display
  company?: { name: string; logoUrl?: string };
  department?: { name:string };
  staff?: { name: string };
}

export enum TelaoRequestStatus {
  PENDENTE = 'Pendente',
  CONCLUIDO = 'Concluído',
}

export interface TelaoRequest {
  id: string;
  createdAt: string;
  eventId: string;
  participantCompanyId: string;
  collaboratorId?: string;
  vehicleId?: string;
  status: TelaoRequestStatus;
  resolvedByStaffId?: string;
  resolverFeedback?: string;
  resolvedAt?: string;
  // Joined data for display
  company?: { name: string; logoUrl?: string };
  collaborator?: { name: string };
  vehicle?: { marca: string; model: string };
  staff?: { name: string };
}
