import { createClient } from '@supabase/supabase-js';
import { 
  User, 
  UserRole, 
  Event, 
  OrganizerCompany, 
  Staff, 
  ParticipantCompany, 
  ReportButtonConfig,
  ReportSubmission,
  StaffActivity,
  Department,
  AssignedTask,
  Collaborator,
  Vehicle,
  CompanySalesData,
  StockMovement,
  FullStockMovement,
  CompanyCall,
  CallStatus,
  TelaoRequest,
  TelaoRequestStatus
} from '../types';

// --- Supabase Client Initialization ---
const supabaseUrl = 'https://ngukhhydpltectxrmvot.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndWtoaHlkcGx0ZWN0eHJtdm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMzcyNjAsImV4cCI6MjA3MjcxMzI2MH0.a_29iTryK6r8MKV-kvww8KBnqchPz8E3vXKGebJ-vQc';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'imagens';

export const uploadImage = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Falha ao fazer upload da imagem.');
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!data || !data.publicUrl) {
      throw new Error('Não foi possível obter a URL pública da imagem.');
  }

  return data.publicUrl;
};


// --- Utils for case conversion between JS (camelCase) and Supabase (snake_case) ---
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const snakeCaseKeys = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(snakeCaseKeys);
  return Object.keys(obj).reduce((acc, key) => {
    acc[toSnakeCase(key)] = snakeCaseKeys(obj[key]);
    return acc;
  }, {} as any);
};

const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const camelCaseKeys = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(camelCaseKeys);

    return Object.keys(obj).reduce((acc, key) => {
        const camelKey = toCamelCase(key);
        // Recursively call camelCaseKeys on the value if it's an object
        acc[camelKey] = camelCaseKeys(obj[key]);
        return acc;
    }, {} as any);
};

// --- Auth ---
export const apiLogin = async (email: string, pass: string): Promise<User> => {
    // 1. Fetch user by email
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !userProfile) {
      throw new Error('Credenciais inválidas.');
    }

    // 2. Unsafe password check (reverted to original logic)
    // NOTE: Storing and comparing plaintext passwords is a major security risk.
    if (userProfile.password !== pass) {
      throw new Error('Credenciais inválidas.');
    }

    // Omit password from returned data
    const { password, ...userWithoutPassword } = userProfile;
    const user = camelCaseKeys(userWithoutPassword) as User;

    // 3. Enrich user object with event data
    if (user.role === UserRole.ORGANIZER && user.eventId) {
        const { data: organizerEvent, error: organizerEventError } = await supabase
            .from('events')
            .select('organizer_company_id')
            .eq('id', user.eventId)
            .single();
        
        if (organizerEventError || !organizerEvent) {
            throw new Error('Não foi possível encontrar a empresa organizadora associada a este usuário.');
        }

        const organizerCompanyId = organizerEvent.organizer_company_id;
        
        const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .eq('organizer_company_id', organizerCompanyId)
            .eq('is_active', true);

        if (eventsError) {
            throw new Error('Falha ao carregar os dados dos eventos.');
        }
        
        user.events = camelCaseKeys(eventsData) as Event[];
        
        if (user.events.length === 0) {
            throw new Error('Você não tem eventos ativos associados.');
        }

        if (!user.events.some(e => e.id === user.eventId)) {
            user.eventId = user.events[0].id;
        }
    } else if (user.eventId) { // For non-organizer roles with an eventId
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('is_active')
            .eq('id', user.eventId)
            .single();
        
        if (eventError || (event && !event.is_active)) {
            throw new Error('O evento associado a esta conta está inativo.');
        }
    }

    return user;
};

export const apiLogout = async () => {
    // Reverted to original simple logout
    return Promise.resolve();
};


// --- Checkin ---
export const validateCheckin = async (boothCode: string, personalCode: string) => {
  const { data: company, error: companyError } = await supabase
    .from('participant_companies')
    .select('*, event:events(*)')
    .eq('booth_code', boothCode.toUpperCase())
    .single();

  if (companyError || !company) throw new Error('Código do Estande inválido.');
  
  const participantCompany = camelCaseKeys(company) as ParticipantCompany;
  const event = camelCaseKeys(company.event) as Event;
  if (!event) throw new Error('Evento associado não encontrado.');
  if (!event.isActive) throw new Error('Este evento está inativo no momento.');

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('*')
    .eq('personal_code', personalCode.toUpperCase())
    .single();

  if (staffError || !staff) throw new Error('Código Pessoal inválido.');

  // NEW LOGIC: Verify the staff is assigned to this event
  const { data: assignment, error: assignmentError } = await supabase
    .from('staff_event_assignments')
    .select('department_id')
    .eq('staff_id', staff.id)
    .eq('event_id', event.id)
    .single();

  if (assignmentError || !assignment) {
    throw new Error('Este membro da equipe não está atribuído a este evento.');
  }
  
  if (event.organizerCompanyId !== staff.organizer_company_id) {
    throw new Error('Equipe e Empresa não pertencem à mesma organização.');
  }
  
  const staffWithDepartment = { ...camelCaseKeys(staff), departmentId: assignment.department_id };

  return { staff: staffWithDepartment as Staff, event, company: participantCompany };
};


export const validateCollaboratorCheckin = async (boothCode: string, collaboratorCode: string) => {
  const { data: company, error: companyError } = await supabase
    .from('participant_companies')
    .select('*, event:events(*)')
    .eq('booth_code', boothCode.toUpperCase())
    .single();

  if (companyError || !company) {
    throw new Error('Código da Empresa inválido.');
  }
  
  const event = company.event ? camelCaseKeys(company.event) as Event : null;
  if (!event || !event.isActive) {
      throw new Error('O evento associado a esta empresa está inativo.');
  }

  const { data: collaborator, error: collaboratorError } = await supabase
    .from('collaborators')
    .select('*')
    .eq('collaborator_code', collaboratorCode.toUpperCase())
    .eq('company_id', company.id)
    .single();

  if (collaboratorError || !collaborator) {
    throw new Error('Código de Colaborador inválido para esta empresa.');
  }

  return { 
      collaborator: camelCaseKeys(collaborator) as Collaborator, 
      company: camelCaseKeys(company) as ParticipantCompany,
      event: event
  };
};

export const apiUnifiedCheckin = async (boothCode: string, personalCode: string) => {
  try {
    // Attempt to validate as staff first
    const staffCheckinResult = await validateCheckin(boothCode, personalCode);
    return {
      type: 'staff',
      data: staffCheckinResult,
    };
  } catch (staffError) {
    // If staff validation fails, attempt to validate as collaborator
    try {
      const collaboratorCheckinResult = await validateCollaboratorCheckin(boothCode, personalCode);
      return {
        type: 'collaborator',
        data: collaboratorCheckinResult,
      };
    } catch (collaboratorError) {
      // If both fail, throw a generic error
      throw new Error('Códigos inválidos. Verifique as informações e tente novamente.');
    }
  }
};

// --- Reports ---
export const getReportButtonsForBooth = async (boothCode: string): Promise<ReportButtonConfig[]> => {
  const { data: company } = await supabase
    .from('participant_companies')
    .select('button_ids')
    .eq('booth_code', boothCode.toUpperCase())
    .single();

  if (!company || !company.button_ids || company.button_ids.length === 0) return [];

  const { data, error } = await supabase
    .from('report_button_configs')
    .select('*')
    .in('id', company.button_ids);

  if (error) throw new Error('Falha ao buscar botões.');
  return camelCaseKeys(data) as ReportButtonConfig[];
};

export const submitReport = async (reportData: Omit<ReportSubmission, 'id' | 'timestamp'>) => {
  const { error: reportError } = await supabase
    .from('reports')
    .insert(snakeCaseKeys({ ...reportData, timestamp: new Date().toISOString() }));

  if (reportError) throw new Error('Falha ao enviar informe.');

  const { data: staff } = await supabase.from('staff').select('id').eq('name', reportData.staffName).single();

  if (staff) {
    const activity = {
      staffId: staff.id,
      eventId: reportData.eventId,
      description: `Registrou '${reportData.reportLabel}' para ${reportData.boothCode}`,
      timestamp: new Date().toISOString()
    };
    await supabase.from('staff_activities').insert(snakeCaseKeys(activity));
  }
};

export const submitCompanyCall = async (payload: {
    eventId: string;
    participantCompanyId: string;
    departmentId: string;
    collaboratorName: string;
    observation: string;
    companyName: string; 
    departmentName: string; 
    boothCode: string; 
}) => {
    const callData = {
        event_id: payload.eventId,
        participant_company_id: payload.participantCompanyId,
        department_id: payload.departmentId,
        collaborator_name: payload.collaboratorName,
        observation: payload.observation,
        status: CallStatus.PENDENTE,
    };

    // The primary action: insert the call into the database.
    const { data, error } = await supabase
        .from('company_calls')
        .insert(callData)
        .select()
        .single();
        
    if (error) {
        // If the database insert fails, this is a critical error.
        console.error('Failed to insert company call:', error);
        throw new Error('Falha ao registrar o chamado.');
    }
    
    // The secondary action: send a webhook notification.
    // This is wrapped in a try/catch block to make it non-critical.
    // If the webhook fails, the error is logged, but the function succeeds,
    // because the call was successfully saved in the database.
    try {
        const webhookUrl = 'https://webhook.triad3.io/webhook/chamados-cie2-0';
        const webhookPayload = {
            eventId: payload.eventId,
            companyName: payload.companyName,
            collaboratorName: payload.collaboratorName,
            departmentName: payload.departmentName,
            observation: payload.observation,
            timestamp: new Date().toISOString(),
        };
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
        });

        if (!response.ok) {
            console.error('Webhook de chamado da empresa não respondeu corretamente:', response.statusText);
        }
    } catch (webhookError) {
        console.error('Falha ao enviar notificação de webhook para chamado da empresa (non-critical):', webhookError);
    }

    // Return the successfully created call data.
    return camelCaseKeys(data);
};

export const submitSalesCheckin = async (payload: any, staffId: string, eventId: string) => {
    // 1. Send webhook
    const webhookUrl = 'https://webhook.triad3.io/webhook/chek-in-vendas-cie';
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        console.error('Webhook response was not ok:', response.statusText);
        throw new Error('Falha no envio do check-in de vendas.');
    }
    
    // 2. Log staff activity
    try {
        const activity = {
            staffId: staffId,
            eventId: eventId,
            description: `Realizou Check-in de Vendas para ${payload.companyName} (${payload.boothCode})`,
        };
        const { error } = await supabase.from('staff_activities').insert(snakeCaseKeys({ ...activity, timestamp: new Date().toISOString() }));
        if (error) {
            // Log error but don't throw, as the primary action (webhook) succeeded.
            console.error('Failed to log sales check-in activity:', error);
        }
    } catch (error) {
        console.error('Exception while logging sales check-in activity:', error);
    }
};

export const getReportsByEvent = async (eventId: string): Promise<ReportSubmission[]> => {
  const { data, error } = await supabase.from('reports').select('*').eq('event_id', eventId);
  if (error) return [];
  return camelCaseKeys(data) as ReportSubmission[];
};

export const getEventSalesData = async (eventId: string): Promise<CompanySalesData[]> => {
    const { data: companies, error: companiesError } = await supabase
        .from('participant_companies')
        .select(`
            id,
            name,
            logo_url,
            collaborators (*),
            vehicle_stock ( sold_by_collaborator_id )
        `)
        .eq('event_id', eventId);
    
    if (companiesError) {
        console.error("Error fetching sales data companies:", companiesError);
        throw new Error('Falha ao buscar dados de vendas.');
    }

    if (!companies) return [];

    const processedData = companies.map(company => {
        const soldVehicles = company.vehicle_stock.filter((v: any) => v.sold_by_collaborator_id);
        
        const salesByCollaborator = company.collaborators.map((collaborator: any) => {
            const salesCount = soldVehicles.filter((v: any) => v.sold_by_collaborator_id === collaborator.id).length;
            return {
                ...collaborator,
                salesCount: salesCount,
                companyName: company.name
            };
        });
        
        return {
            id: company.id,
            name: company.name,
            logoUrl: company.logo_url,
            salesCount: soldVehicles.length,
            collaborators: salesByCollaborator,
        };
    });

    return camelCaseKeys(processedData) as CompanySalesData[];
};

export const getSoldVehiclesByEvent = async (eventId: string): Promise<Pick<Vehicle, 'model' | 'marca'>[]> => {
    const { data: companies, error: companiesError } = await supabase
        .from('participant_companies')
        .select('id')
        .eq('event_id', eventId);

    if (companiesError) {
        console.error("Error fetching companies for vehicle map:", companiesError);
        throw new Error('Falha ao buscar empresas do evento.');
    }
    if (!companies || companies.length === 0) {
        return [];
    }
    const companyIds = companies.map(c => c.id);

    const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicle_stock')
        .select('marca, model')
        .in('company_id', companyIds)
        .eq('status', 'Vendido');

    if (vehiclesError) {
        console.error("Error fetching sold vehicles:", vehiclesError);
        throw new Error('Falha ao buscar veículos vendidos.');
    }

    return camelCaseKeys(vehicles) as Pick<Vehicle, 'model' | 'marca'>[];
};


// --- Generic CRUD functions replaced with specific Supabase calls ---

const createApi = <T extends { id: string }>(tableName: string) => ({
    getAll: async (): Promise<T[]> => {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw new Error(error.message);
        return camelCaseKeys(data) as T[];
    },
    add: async (item: Omit<T, 'id'>): Promise<T> => {
        const { data, error } = await supabase.from(tableName).insert(snakeCaseKeys(item)).select().single();
        if (error) throw new Error(error.message);
        return camelCaseKeys(data) as T;
    },
    update: async (updatedItem: T): Promise<T> => {
        const { id, ...updateData } = updatedItem;
        const { data, error } = await supabase.from(tableName).update(snakeCaseKeys(updateData)).eq('id', id).select().single();
        if (error) {
            console.error(`Failed to save ${tableName}:`, error.message);
            throw new Error(error.message);
        }
        return camelCaseKeys(data) as T;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw new Error(error.message);
    },
});


// --- Admins ---
const adminApi = createApi<User>('users');
export const getAdmins = async () => (await adminApi.getAll()).filter(u => u.role === UserRole.ADMIN && u.isMaster);
export const addAdmin = async (data: Omit<User, 'id' | 'role'>) => adminApi.add({ ...data, role: UserRole.ADMIN });
export const updateAdmin = adminApi.update;
export const deleteAdmin = adminApi.delete;

// --- Organizer Companies ---
const organizerApi = createApi<OrganizerCompany>('organizer_companies');
export const getOrganizerCompanies = organizerApi.getAll;
export const getOrganizerCompanyById = async (id: string): Promise<OrganizerCompany | null> => {
    const { data, error } = await supabase.from('organizer_companies').select('*').eq('id', id).single();
    if (error) return null;
    return camelCaseKeys(data);
}
export const getOrganizerUserForEvent = async (eventId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('event_id', eventId)
    .eq('role', UserRole.ORGANIZER)
    .single();
    if (error) return null;
    const { password, ...user } = camelCaseKeys(data);
    return user;
}

export const getUniqueOrganizers = async (): Promise<{ name: string; email: string; }[]> => {
    const { data, error } = await supabase
        .from('users')
        .select('name, email')
        .eq('role', UserRole.ORGANIZER);

    if (error) {
        console.error("Error fetching organizers:", error);
        return [];
    }

    // Use a Map to get unique users by email
    const uniqueOrganizers = Array.from(new Map(data.map(item => [item.email, item])).values());
    
    return uniqueOrganizers as { name: string; email: string; }[];
};


export const updateUserPhoto = async (userId: string, photoUrl: string): Promise<User> => {
    const { data, error } = await supabase
        .from('users')
        .update({ photo_url: photoUrl })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        console.error('Error updating user photo:', error);
        throw new Error('Falha ao atualizar a foto do perfil.');
    }

    return camelCaseKeys(data) as User;
};


// --- Events ---
const eventApi = createApi<Event>('events');
export const getEvents = eventApi.getAll;
export const updateEvent = eventApi.update;

// These complex operations should ideally be server-side transactions (e.g., Supabase Edge Functions)
// to ensure data integrity. This client-side implementation mimics the mock logic.
export const addEventToExistingOrganizer = async (data: {
  event: Omit<Event, 'id' | 'organizerCompanyId' | 'isActive'>,
  userEmail: string
}) => {
  // 1. Find one existing user record for the given email to get their details
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('event_id')
    .eq('email', data.userEmail)
    .eq('role', UserRole.ORGANIZER)
    .limit(1)
    .single();

  if (userError || !existingUser) {
    throw new Error('Organizador existente não encontrado ou ocorreu um erro.');
  }

  // 2. Use their event_id to find the organizer_company_id
  const { data: existingEvent, error: eventError } = await supabase
    .from('events')
    .select('organizer_company_id')
    .eq('id', existingUser.event_id)
    .single();

  if (eventError || !existingEvent) {
    throw new Error('Evento associado ao organizador não encontrado.');
  }
  
  const organizerCompanyId = existingEvent.organizer_company_id;

  // 3. Create the new event
  const newEventData = { ...data.event, organizerCompanyId: organizerCompanyId, isActive: true };
  const newEvent = await eventApi.add(newEventData);

  // 4. Create the default 'Geral' department for the new event
  await departmentApi.add({ name: 'Geral', eventId: newEvent.id });
  
  return newEvent;
};

export const addEventAndOrganizer = async (data: {
  event: Omit<Event, 'id' | 'organizerCompanyId' | 'isActive'>,
  organizer: Omit<OrganizerCompany, 'id'>,
  user: { email: string, password?: string }
}) => {
  const newOrganizer = await organizerApi.add(data.organizer);
  const newEventData = { ...data.event, organizerCompanyId: newOrganizer.id, isActive: true };
  const newEvent = await eventApi.add(newEventData);
  const newUserData = {
    name: data.organizer.responsibleName,
    email: data.user.email,
    password: data.user.password || 'password',
    role: UserRole.ORGANIZER,
    isMaster: false,
    eventId: newEvent.id,
    photoUrl: `https://i.pravatar.cc/150?u=${data.user.email}`
  };
  await adminApi.add(newUserData);
  await departmentApi.add({ name: 'Geral', eventId: newEvent.id });
  return newEvent;
};

export const updateEventAndOrganizer = async (data: {
  event: Event,
  organizer: OrganizerCompany,
  user: { email: string, password?: string }
}) => {
  await eventApi.update(data.event);
  await organizerApi.update(data.organizer);
  
  const existingUser = await getOrganizerUserForEvent(data.event.id);
  if (existingUser) {
      const updatedUser: any = {
        id: existingUser.id,
        name: data.organizer.responsibleName,
        email: data.user.email,
      };
      // Only include password if it's being changed
      if (data.user.password) {
        updatedUser.password = data.user.password;
      }
      await supabase.from('users').update(snakeCaseKeys(updatedUser)).eq('id', existingUser.id);
  }
};

export const deleteEvent = async (eventId: string) => {
    // Step 1: Find the event and its organizer company.
    const { data: eventToDelete, error: eventFindError } = await supabase
        .from('events')
        .select('organizer_company_id')
        .eq('id', eventId)
        .single();

    if (eventFindError || !eventToDelete) {
        console.error('Event to delete not found:', eventFindError?.message);
        throw new Error('Evento a ser excluído não encontrado.');
    }
    const organizerId = eventToDelete.organizer_company_id;

    // Step 2: Find the associated organizer's company to get their email, which is the link to the user table.
    const { data: organizerCompanyData, error: companyFindError } = await supabase
        .from('organizer_companies')
        .select('responsible_contact') // This holds the user's email
        .eq('id', organizerId)
        .single();
    
    if (companyFindError) {
        console.error('Organizer company not found:', companyFindError.message);
        throw new Error('Empresa organizadora associada ao evento não foi encontrada.');
    }
    const organizerEmail = organizerCompanyData.responsible_contact;
    
    // Step 3: Find the unique user record for this organizer.
    let userToUpdateOrDelete: {id: string, event_id: string} | null = null;
    if (organizerEmail) {
        const { data: foundUser } = await supabase
            .from('users')
            .select('id, event_id')
            .eq('email', organizerEmail)
            .eq('role', UserRole.ORGANIZER)
            .single();
        userToUpdateOrDelete = foundUser;
    }

    // Step 4: Delete data directly tied to the eventId.
    await supabase.from('reports').delete().eq('event_id', eventId);
    await supabase.from('participant_companies').delete().eq('event_id', eventId);
    await supabase.from('departments').delete().eq('event_id', eventId);

    // Step 5: Delete the event itself.
    await supabase.from('events').delete().eq('id', eventId);
    
    // Step 6: Check for remaining events for this organizer.
    const { data: remainingEvents, error: remainingEventsError } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_company_id', organizerId)
        .limit(1);

    if (remainingEventsError) {
        console.error('Could not check for remaining events:', remainingEventsError.message);
        throw new Error('Falha ao verificar eventos restantes do organizador.');
    }

    // Step 7: Decide whether to clean up the organizer or update the user.
    if (!remainingEvents || remainingEvents.length === 0) {
        // This was the last event. Clean up everything related to the organizer.
        await supabase.from('staff').delete().eq('organizer_company_id', organizerId);
        if (userToUpdateOrDelete) {
            await supabase.from('users').delete().eq('id', userToUpdateOrDelete.id);
        }
        await supabase.from('organizer_companies').delete().eq('id', organizerId);
    } else {
        // There are other events. Check if the user's default eventId needs to be updated.
        if (userToUpdateOrDelete && userToUpdateOrDelete.event_id === eventId) {
            // The user was pointing to the deleted event. Point them to a remaining one.
            const newEventId = remainingEvents[0].id;
            await supabase.from('users').update({ event_id: newEventId }).eq('id', userToUpdateOrDelete.id);
        }
    }
};

// --- Departments ---
const departmentApi = createApi<Department>('departments');
export const getDepartmentsByEvent = async (eventId: string): Promise<Department[]> => {
    const { data, error } = await supabase.from('departments').select('*').eq('event_id', eventId);
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Department[];
};
export const addDepartment = departmentApi.add;
export const updateDepartment = departmentApi.update;
export const deleteDepartment = departmentApi.delete;

// --- Staff ---
const staffApi = createApi<Staff>('staff');
export const getStaffByOrganizer = async (organizerId: string): Promise<Staff[]> => {
    const { data, error } = await supabase.from('staff').select('*').eq('organizer_company_id', organizerId);
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Staff[];
};

export const getStaffByEvent = async (eventId: string): Promise<Staff[]> => {
    // 1. Get all assignments for the given event
    const { data: assignments, error: assignmentsError } = await supabase
        .from('staff_event_assignments')
        .select('staff_id, department_id')
        .eq('event_id', eventId);

    if (assignmentsError) {
        console.error("Failed to get staff assignments for event:", assignmentsError);
        return [];
    }

    if (assignments.length === 0) {
        return [];
    }

    const staffIds = assignments.map(a => a.staff_id);
    const departmentMap = new Map(assignments.map(a => [a.staff_id, a.department_id]));

    // 2. Get all staff details for the retrieved IDs
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .in('id', staffIds);

    if (staffError) {
        console.error("Failed to fetch staff details for event:", staffError);
        return [];
    }

    // 3. Combine staff data with their department for this specific event
    const eventStaff = staffData.map(staffMember => ({
        ...camelCaseKeys(staffMember),
        departmentId: departmentMap.get(staffMember.id),
    }));

    return eventStaff as Staff[];
};

export const addStaffAndAssignToEvent = async (staffData: Omit<Staff, 'id'>, eventId: string): Promise<Staff> => {
    const { departmentId, ...restOfStaffData } = staffData;

    // 1. Create the staff member in the main 'staff' table
    const { data: newStaff, error: staffError } = await supabase
        .from('staff')
        .insert(snakeCaseKeys(restOfStaffData))
        .select()
        .single();

    if (staffError) {
        console.error("Error creating staff member:", staffError);
        throw new Error("Falha ao criar o membro da equipe.");
    }

    // 2. Create the assignment in the linking table
    const assignment = {
        staff_id: newStaff.id,
        event_id: eventId,
        department_id: departmentId,
    };

    const { error: assignmentError } = await supabase
        .from('staff_event_assignments')
        .insert(assignment);

    if (assignmentError) {
        // In a real app, we might want to roll back the staff creation here (transaction)
        console.error("Error assigning staff to event:", assignmentError);
        throw new Error("Falha ao vincular o membro da equipe ao evento.");
    }

    return camelCaseKeys({ ...newStaff, departmentId }) as Staff;
};

export const updateStaffAndAssignment = async (staffData: Staff, eventId: string): Promise<Staff> => {
    const { departmentId, id, ...restOfStaffData } = staffData;

    // 1. Update the core staff details
    const { data: updatedStaff, error: staffError } = await supabase
        .from('staff')
        .update(snakeCaseKeys(restOfStaffData))
        .eq('id', id)
        .select()
        .single();

    if (staffError) {
        console.error("Error updating staff member:", staffError);
        throw new Error("Falha ao atualizar os dados do membro da equipe.");
    }

    // 2. Update the assignment for this specific event
    if (departmentId) {
        const { error: assignmentError } = await supabase
            .from('staff_event_assignments')
            .update({ department_id: departmentId })
            .eq('staff_id', id)
            .eq('event_id', eventId);

        if (assignmentError) {
            console.error("Error updating staff assignment:", assignmentError);
            throw new Error("Falha ao atualizar o departamento do membro da equipe para este evento.");
        }
    }

    return camelCaseKeys({ ...updatedStaff, departmentId }) as Staff;
};

export const assignStaffToEvent = async (staffId: string, eventId: string, departmentId: string): Promise<void> => {
    const assignment = {
        staff_id: staffId,
        event_id: eventId,
        department_id: departmentId,
    };

    const { error } = await supabase
        .from('staff_event_assignments')
        .insert(assignment);

    if (error) {
        // Handle unique constraint violation gracefully
        if (error.code === '23505') { // unique_violation
            console.warn(`Staff member ${staffId} is already assigned to event ${eventId}.`);
            throw new Error("Este membro já está vinculado a este evento.");
        }
        console.error("Error assigning staff to event:", error);
        throw new Error("Falha ao vincular o membro da equipe ao evento.");
    }
};

export const unassignStaffFromEvent = async (staffId: string, eventId: string): Promise<void> => {
  const { error } = await supabase
    .from('staff_event_assignments')
    .delete()
    .eq('staff_id', staffId)
    .eq('event_id', eventId);

  if (error) {
    console.error("Error unassigning staff from event:", error);
    throw new Error("Falha ao desvincular o membro da equipe do evento.");
  }
};

export const deleteStaff = staffApi.delete;
export const getStaffActivity = async (staffId: string, eventId: string): Promise<StaffActivity[]> => {
  const { data, error } = await supabase
    .from('staff_activities')
    .select('*')
    .eq('staff_id', staffId)
    .eq('event_id', eventId)
    .order('timestamp', { ascending: false });
  if (error) return [];
  return camelCaseKeys(data) as StaffActivity[];
};

export const apiAddTaskActivity = async (staffId: string, description: string, eventId: string): Promise<void> => {
  const activity = {
    staffId,
    eventId,
    description,
    timestamp: new Date().toISOString()
  };
  const { error } = await supabase.from('staff_activities').insert(snakeCaseKeys(activity));
  if (error) {
    console.error('Failed to add task activity:', error);
    throw new Error('Falha ao atribuir a tarefa.');
  }
};

// --- Participant Companies ---
const companyApi = createApi<ParticipantCompany>('participant_companies');
export const getParticipantCompaniesByEvent = async (eventId: string): Promise<ParticipantCompany[]> => {
    const { data, error } = await supabase.from('participant_companies').select('*').eq('event_id', eventId);
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as ParticipantCompany[];
};
export const addParticipantCompany = async (companyData: Omit<ParticipantCompany, 'id'>): Promise<ParticipantCompany> => {
  const newCompany = await companyApi.add(companyData);

  if (newCompany) {
    try {
      const webhookUrl = 'https://webhook.triad3.io/webhook/c12c6861-f16a-466d-a450-8b2aae9110f9';
      
      let eventName = 'Evento não encontrado';
      if (newCompany.eventId) {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('name')
          .eq('id', newCompany.eventId)
          .single();
        
        if (eventError) {
            console.error('Error fetching event name for webhook:', eventError.message);
        } else if (eventData) {
            eventName = eventData.name;
        }
      }

      const payload = {
        ...newCompany,
        eventName: eventName,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Webhook response was not ok:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to send data to webhook:', error);
    }
  }
  
  return newCompany;
};
export const updateParticipantCompany = companyApi.update;
export const deleteParticipantCompany = companyApi.delete;

// --- Collaborators ---
const collaboratorApi = createApi<Collaborator>('collaborators');
export const getCollaboratorsByCompany = async (companyId: string): Promise<Collaborator[]> => {
    const { data, error } = await supabase
      .from('collaborators')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Collaborator[];
};
export const addCollaborator = async (item: Omit<Collaborator, 'id' | 'createdAt'>): Promise<Collaborator> => {
    const { data, error } = await supabase.from('collaborators').insert(snakeCaseKeys(item)).select().single();
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Collaborator;
};
export const updateCollaborator = collaboratorApi.update;
export const deleteCollaborator = collaboratorApi.delete;

// --- Vehicle Stock ---
const vehicleApi = createApi<Vehicle>('vehicle_stock');
export const getVehiclesByCompany = async (companyId: string): Promise<Vehicle[]> => {
    const { data, error } = await supabase
      .from('vehicle_stock')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Vehicle[];
};
export const addVehicle = async (item: Omit<Vehicle, 'id' | 'createdAt'>): Promise<Vehicle> => {
    const { data, error } = await supabase.from('vehicle_stock').insert(snakeCaseKeys(item)).select().single();
    if (error) throw new Error(error.message);
    return camelCaseKeys(data) as Vehicle;
};
export const updateVehicle = vehicleApi.update;
export const deleteVehicle = vehicleApi.delete;

export const apiBulkAddVehicles = async (vehicles: Omit<Vehicle, 'id' | 'createdAt'>[]): Promise<Vehicle[]> => {
    const { data, error } = await supabase.from('vehicle_stock').insert(vehicles.map(v => snakeCaseKeys(v))).select();
    if (error) {
        console.error("Bulk add vehicles error:", error);
        throw new Error('Falha ao adicionar veículos em massa.');
    }
    return camelCaseKeys(data) as Vehicle[];
};

// --- Button Configs ---
const buttonApi = createApi<ReportButtonConfig>('report_button_configs');
export const getButtonConfigs = buttonApi.getAll;
export const addButtonConfig = buttonApi.add;
export const updateButtonConfig = buttonApi.update;
export const deleteButtonConfig = buttonApi.delete;

// --- Tasks ---
export const apiCompleteTaskActivity = async (
  staffId: string, 
  originalDescription: string,
  reportDetails: {
      eventId: string;
      boothCode: string;
      staffName: string;
      actionLabel: string;
      actionResponse: string;
  }
): Promise<void> => {
  // 1. Log completion in staff_activities
  const completedDescription = originalDescription.replace('Tarefa atribuída:', 'Tarefa concluída:');
  const activity = {
    staffId,
    eventId: reportDetails.eventId,
    description: completedDescription,
    timestamp: new Date().toISOString()
  };
  const { error: activityError } = await supabase.from('staff_activities').insert(snakeCaseKeys(activity));
  if (activityError) {
    console.error('Failed to complete task activity:', activityError);
    throw new Error('Falha ao concluir a tarefa.');
  }

  // 2. Add a record to the reports table
  const reportData = {
    eventId: reportDetails.eventId,
    boothCode: reportDetails.boothCode,
    staffName: reportDetails.staffName,
    reportLabel: reportDetails.actionLabel,
    response: reportDetails.actionResponse,
  };
  const { error: reportError } = await supabase
    .from('reports')
    .insert(snakeCaseKeys({ ...reportData, timestamp: new Date().toISOString() }));
  if (reportError) {
    console.error('Failed to submit task completion report:', reportError);
    // This is a new side-effect, throwing is appropriate to signal failure
    throw new Error('Falha ao registrar a conclusão da tarefa no relatório da empresa.');
  }
};

const parseTaskDescription = (description: string): { actionLabel: string; companyName: string; boothCode?: string } | null => {
    // Tries to match new format with boothCode first
    const matchWithCode = description.match(/Realizar '([^']+)' na empresa '([^']+)' \[([^\]]+)\]/);
    if (matchWithCode && matchWithCode.length === 4) {
        return { 
            actionLabel: matchWithCode[1].trim(), 
            companyName: matchWithCode[2].trim(), 
            boothCode: matchWithCode[3].trim() 
        };
    }
    // Fallback to old format
    const matchWithoutCode = description.match(/Realizar '([^']+)' na empresa '([^']+)'/);
    if (matchWithoutCode && matchWithoutCode.length === 3) {
        return { 
            actionLabel: matchWithoutCode[1].trim(), 
            companyName: matchWithoutCode[2].trim() 
        };
    }
    return null;
};

export const getAssignedTasksByEvent = async (eventId: string): Promise<AssignedTask[]> => {
    const staffList = await getStaffByEvent(eventId);
    if (staffList.length === 0) return [];

    const staffMap = new Map(staffList.map(s => [s.id, s.name]));
    const staffIds = staffList.map(s => s.id);

    const { data: activitiesData, error } = await supabase
        .from('staff_activities')
        .select('*')
        .in('staff_id', staffIds)
        .eq('event_id', eventId)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching activities for tasks:', error);
        return [];
    }

    const allActivities = camelCaseKeys(activitiesData) as StaffActivity[];
    const assignedMap = new Map<string, StaffActivity>();
    const completedSet = new Set<string>();

    for (const activity of allActivities) {
        const coreDescription = activity.description
            .replace('Tarefa atribuída: ', '')
            .replace('Tarefa concluída: ', '');
        const key = `${activity.staffId}::${coreDescription}`;

        if (activity.description.startsWith('Tarefa concluída:')) {
            completedSet.add(key);
        } else if (activity.description.startsWith('Tarefa atribuída:')) {
            if (!assignedMap.has(key)) {
                assignedMap.set(key, activity);
            }
        }
    }

    const tasks: AssignedTask[] = [];
    for (const [key, activity] of assignedMap.entries()) {
        const parsed = parseTaskDescription(activity.description);
        if (parsed) {
            tasks.push({
                id: activity.id,
                staffId: activity.staffId,
                staffName: staffMap.get(activity.staffId) || 'Desconhecido',
                companyName: parsed.companyName,
                boothCode: parsed.boothCode,
                actionLabel: parsed.actionLabel,
                description: activity.description,
                timestamp: activity.timestamp,
                status: completedSet.has(key) ? 'Concluída' : 'Pendente',
            });
        }
    }

    return tasks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const getPendingTasksForStaff = async (staffId: string, eventId: string): Promise<AssignedTask[]> => {
    const { data: activitiesData, error } = await supabase
        .from('staff_activities')
        .select('*')
        .eq('staff_id', staffId)
        .eq('event_id', eventId)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching activities for staff:', error);
        return [];
    }

    const allActivities = camelCaseKeys(activitiesData) as StaffActivity[];
    const assignedMap = new Map<string, StaffActivity>();
    const completedSet = new Set<string>();

    for (const activity of allActivities) {
        const coreDescription = activity.description
            .replace('Tarefa atribuída: ', '')
            .replace('Tarefa concluída: ', '');
        const key = `${activity.staffId}::${coreDescription}`;

        if (activity.description.startsWith('Tarefa concluída:')) {
            completedSet.add(key);
        } else if (activity.description.startsWith('Tarefa atribuída:')) {
            if (!assignedMap.has(key)) {
                assignedMap.set(key, activity);
            }
        }
    }
    
    const tasks: AssignedTask[] = [];
    for (const [key, activity] of assignedMap.entries()) {
        if (!completedSet.has(key)) { // Only add if not completed
            const parsed = parseTaskDescription(activity.description);
            if (parsed) {
                tasks.push({
                    id: activity.id,
                    staffId: activity.staffId,
                    staffName: '', // Not needed here
                    companyName: parsed.companyName,
                    boothCode: parsed.boothCode,
                    actionLabel: parsed.actionLabel,
                    description: activity.description,
                    timestamp: activity.timestamp,
                    status: 'Pendente',
                });
            }
        }
    }

    return tasks;
};

export const addStockMovement = async (
  staffId: string,
  companyId: string,
  vehicleId: string,
  type: 'Venda' | 'Teste Drive',
  eventId: string
) => {
  const movement = {
    staffId,
    companyId,
    vehicleId,
    type,
    timestamp: new Date().toISOString(),
  };
  const { error: movementError } = await supabase
    .from('stock_movements')
    .insert(snakeCaseKeys(movement));

  if (movementError) {
    // Log the detailed error for easier debugging
    console.error('Supabase error on stock movement insert:', movementError);
    throw new Error('Falha ao registrar movimentação de estoque.');
  }

  // Also log as a general staff activity
  const activity = {
    staffId: staffId,
    eventId: eventId,
    description: `Registrou '${type}' (Controle de Estoque) para o veículo ID ${vehicleId}`,
    timestamp: new Date().toISOString(),
  };
  const { error: activityError } = await supabase
    .from('staff_activities')
    .insert(snakeCaseKeys(activity));

  if (activityError) {
    console.error('Failed to log stock movement activity:', activityError);
    // Don't throw, as the primary action succeeded.
  }
};

export const getStockMovementsByCompany = async (companyId: string): Promise<StockMovement[]> => {
    const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('company_id', companyId);
    if (error) {
        console.error("Error fetching stock movements:", error);
        throw new Error("Falha ao buscar movimentações de estoque.");
    }
    return camelCaseKeys(data) as StockMovement[];
};

export const getStockMovementsByEvent = async (eventId: string): Promise<FullStockMovement[]> => {
    // 1. Get company IDs for the event
    const { data: companies, error: companiesError } = await supabase
        .from('participant_companies')
        .select('id')
        .eq('event_id', eventId);

    if (companiesError || !companies || companies.length === 0) {
        if (companiesError) console.error("Error fetching companies for stock movements:", companiesError);
        return [];
    }
    const companyIds = companies.map(c => c.id);

    // 2. Fetch movements for those companies and join related data
    const { data, error } = await supabase
        .from('stock_movements')
        .select(`
            id,
            type,
            timestamp,
            vehicle:vehicle_stock(marca, model, photo_url, placa),
            company:participant_companies(id, name),
            staff:staff(name)
        `)
        .in('company_id', companyIds)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error("Error fetching stock movements report:", error);
        throw new Error("Falha ao buscar o relatório de movimentações de estoque.");
    }
    
    return camelCaseKeys(data) as FullStockMovement[];
};

// --- Telão Notifications ---
export const getTelaoRecipientsForEvent = async (eventId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('telao_notification_recipients')
        .select('staff_id')
        .eq('event_id', eventId);
    if (error) {
        console.error('Error fetching telão recipients:', error);
        return [];
    }
    return data.map(r => r.staff_id);
};

export const setTelaoRecipientsForEvent = async (eventId: string, staffIds: string[]): Promise<void> => {
    const { error: deleteError } = await supabase
        .from('telao_notification_recipients')
        .delete()
        .eq('event_id', eventId);

    if (deleteError) {
        console.error('Error clearing old telão recipients:', deleteError);
        throw new Error('Falha ao atualizar os destinatários.');
    }

    if (staffIds.length > 0) {
        const rowsToInsert = staffIds.map(staff_id => ({
            event_id: eventId,
            staff_id: staff_id,
        }));
        const { error: insertError } = await supabase
            .from('telao_notification_recipients')
            .insert(rowsToInsert);

        if (insertError) {
            console.error('Error inserting new telão recipients:', insertError);
            throw new Error('Falha ao salvar os novos destinatários.');
        }
    }
};

export const sendTelaoNotification = async (
  eventId: string,
  vehicle: Pick<Vehicle, 'id' | 'marca' | 'model'>,
  collaborator: Pick<Collaborator, 'id' | 'name'>,
  company: Pick<ParticipantCompany, 'id' | 'name'>
) => {
  try {
    const requestData = {
      event_id: eventId,
      participant_company_id: company.id,
      collaborator_id: collaborator.id,
      vehicle_id: vehicle.id,
      status: TelaoRequestStatus.PENDENTE,
    };
    const { error: requestError } = await supabase
      .from('telao_requests')
      .insert(requestData);
    
    if (requestError) {
      console.error("Failed to create telão request:", requestError);
    }
  } catch (dbError) {
    console.error("Exception while creating telão request:", dbError);
  }
  
  const staffIds = await getTelaoRecipientsForEvent(eventId);

  if (staffIds.length === 0) {
    console.log(`No telão notification recipients configured for event ${eventId}.`);
    return;
  }

  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('name, phone')
    .in('id', staffIds);

  if (staffError) {
    console.error('Error fetching staff info for telão notification:', staffError);
    return;
  }

  const validStaff = staffData.filter((s): s is { name: string; phone: string } => !!s.name && !!s.phone);

  if (validStaff.length === 0) {
    console.warn(`Configured staff for telão notifications have no valid contact info for event ${eventId}.`);
    return;
  }

  const oldWebhookUrl = 'https://webhook.triad3.io/webhook/solicitar-telao-cie'; 
  const oldPayload = {
    companyName: company.name,
    collaboratorName: collaborator.name,
    vehicleMarca: vehicle.marca,
    vehicleModel: vehicle.model,
    targetPhones: validStaff.map(s => s.phone),
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(oldWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oldPayload),
    });
    if (!response.ok) console.error('Telão notification webhook response was not ok:', response.statusText);
  } catch (error) {
    console.error('Failed to send telão notification webhook:', error);
  }

  const newWebhookUrl = 'https://webhook.prospectai.chat/webhook/0ec71931-e44c-45e2-b4e3-434a9767a11d';
  const newPayload = {
    collaboratorName: collaborator.name,
    companyName: company.name,
    selectedStaff: validStaff.map(s => ({ name: s.name, phone: s.phone })),
  };

  try {
    const response = await fetch(newWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayload),
    });
    if (!response.ok) console.error('Prospect AI Chat webhook response was not ok:', response.statusText);
  } catch (error) {
    console.error('Failed to send Prospect AI Chat webhook:', error);
  }
};


// --- Company Calls ---
export const getCompanyCallsByEvent = async (eventId: string): Promise<CompanyCall[]> => {
    const { data, error } = await supabase
        .from('company_calls')
        .select(`
            *,
            company:participant_companies(name, logo_url),
            department:departments(name),
            staff:staff(name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching company calls:", error);
        throw new Error("Falha ao buscar os chamados.");
    }

    return camelCaseKeys(data) as CompanyCall[];
};

export const getPendingCompanyCallsForStaff = async (eventId: string, departmentId: string): Promise<CompanyCall[]> => {
    const { data, error } = await supabase
        .from('company_calls')
        .select(`
            *,
            company:participant_companies(name, logo_url)
        `)
        .eq('event_id', eventId)
        .eq('department_id', departmentId)
        .eq('status', CallStatus.PENDENTE)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error("Error fetching pending calls for staff:", error);
        return [];
    }
    
    return camelCaseKeys(data) as CompanyCall[];
};

export const resolveCompanyCall = async (callId: string, staffId: string, feedback: string): Promise<CompanyCall> => {
    const { data, error } = await supabase
        .from('company_calls')
        .update({
            status: CallStatus.CONCLUIDO,
            resolved_by_staff_id: staffId,
            resolver_feedback: feedback,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', callId)
        .select()
        .single();
    
    if (error) {
        console.error("Error resolving company call:", error);
        throw new Error("Falha ao resolver o chamado.");
    }
    
    return camelCaseKeys(data) as CompanyCall;
};

// --- Telão Requests ---
export const getTelaoRequestsByEvent = async (eventId: string): Promise<TelaoRequest[]> => {
    const { data, error } = await supabase
        .from('telao_requests')
        .select(`
            *,
            company:participant_companies(name, logo_url),
            collaborator:collaborators(name),
            vehicle:vehicle_stock(marca, model),
            staff:staff(name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching telão requests:", error);
        throw new Error("Falha ao buscar as solicitações de telão.");
    }

    return camelCaseKeys(data) as TelaoRequest[];
};

export const getPendingTelaoRequestsForEvent = async (eventId: string): Promise<TelaoRequest[]> => {
    const { data, error } = await supabase
        .from('telao_requests')
        .select(`
            *,
            company:participant_companies(name, logo_url),
            collaborator:collaborators(name),
            vehicle:vehicle_stock(marca, model)
        `)
        .eq('event_id', eventId)
        .eq('status', TelaoRequestStatus.PENDENTE)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error("Error fetching pending telão requests:", error);
        return [];
    }
    
    return camelCaseKeys(data) as TelaoRequest[];
};

export const resolveTelaoRequest = async (requestId: string, staffId: string, feedback: string): Promise<TelaoRequest> => {
    const { data, error } = await supabase
        .from('telao_requests')
        .update({
            status: TelaoRequestStatus.CONCLUIDO,
            resolved_by_staff_id: staffId,
            resolver_feedback: feedback,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();
    
    if (error) {
        console.error("Error resolving telão request:", error);
        throw new Error("Falha ao resolver a solicitação.");
    }
    
    return camelCaseKeys(data) as TelaoRequest;
};
