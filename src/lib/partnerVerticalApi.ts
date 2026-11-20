import { partnerApi } from './partnerApi';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const realtorPath = (path: string) => `/realestate/realtor${path}`;

export const realtorApi = {
  profile: () => partnerApi.call<Record<string, unknown>>(realtorPath('/profile')),
  saveProfile: (input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>(realtorPath('/onboarding/profile'), 'PUT', input),
  saveCredentials: (input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>(realtorPath('/onboarding/credentials'), 'PUT', input),
  verifyGst: (gstin: string) => partnerApi.call<Record<string, unknown>>(realtorPath('/onboarding/verify-gst'), 'POST', { gstin }),
  saveServiceArea: (input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>(realtorPath('/onboarding/service-area'), 'PUT', input),
  submitOnboarding: () => partnerApi.call<Record<string, unknown>>(realtorPath('/onboarding/submit'), 'POST', {}),
  developer: {
    get: () => partnerApi.call<Record<string, unknown>>(realtorPath('/developer')),
    create: (input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>(realtorPath('/developer'), 'POST', input),
    update: (id: string, input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/developer')}/${encodeURIComponent(id)}`, 'PUT', input),
    authorizeAgent: (id: string, agentRealtorId: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/developer')}/${encodeURIComponent(id)}/authorize-agent`, 'POST', { agentRealtorId }),
    revokeAgent: (id: string, agentRealtorId: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/developer')}/${encodeURIComponent(id)}/revoke-agent`, 'POST', { agentRealtorId }),
  },
  projects: (method: Method = 'GET', input?: Record<string, unknown>, id?: string) => partnerApi.call<Record<string, unknown>>(realtorPath(`/projects${id ? `/${encodeURIComponent(id)}` : ''}`), method, input),
  submitProject: (id: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/projects')}/${encodeURIComponent(id)}/submit`, 'POST', {}),
  configurations: (projectId: string, method: Method = 'GET', input?: Record<string, unknown>, configId?: string) => partnerApi.call<Record<string, unknown>>(realtorPath(`/projects/${encodeURIComponent(projectId)}/configurations${configId ? `/${encodeURIComponent(configId)}` : ''}`), method, input),
  properties: (method: Method = 'GET', input?: Record<string, unknown>, id?: string) => partnerApi.call<Record<string, unknown>>(realtorPath(`/properties${id ? `/${encodeURIComponent(id)}` : ''}`), method, input),
  listings: (method: Method = 'GET', input?: Record<string, unknown>, id?: string) => partnerApi.call<Record<string, unknown>>(realtorPath(`/listings${id ? `/${encodeURIComponent(id)}` : ''}`), method, input),
  submitListing: (id: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/listings')}/${encodeURIComponent(id)}/submit`, 'POST', {}),
  leads: (status?: string, id?: string) => partnerApi.call<Record<string, unknown>>(realtorPath(`/leads${id ? `/${encodeURIComponent(id)}` : status ? `?status=${encodeURIComponent(status)}` : ''}`)),
  updateLead: (id: string, input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/leads')}/${encodeURIComponent(id)}`, 'PUT', input),
  notifications: () => partnerApi.call<Record<string, unknown>>(realtorPath('/notifications')),
  markNotificationRead: (id: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/notifications')}/${encodeURIComponent(id)}/read`, 'POST', {}),
  markAllNotificationsRead: () => partnerApi.call<Record<string, unknown>>(realtorPath('/notifications/read-all'), 'POST', {}),
  media: {
    list: (resourceType: string, resourceId: string) => partnerApi.call<Record<string, unknown>>(realtorPath(`/media?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`)),
    remove: (id: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/media')}/${encodeURIComponent(id)}`, 'DELETE'),
    setPrimary: (id: string) => partnerApi.call<Record<string, unknown>>(`${realtorPath('/media')}/${encodeURIComponent(id)}/primary`, 'POST', {}),
  },
  uploadMedia: (file: { uri: string; name: string; mimeType: string }, target: { resourceType: string; resourceId: string; type: string; isPrimary?: boolean; sortOrder?: number }) => {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    form.append('resourceType', target.resourceType);
    form.append('resourceId', target.resourceId);
    form.append('type', target.type);
    if (target.isPrimary) form.append('isPrimary', 'true');
    if (target.sortOrder != null) form.append('sortOrder', String(target.sortOrder));
    return partnerApi.call<Record<string, unknown>>('/realestate/realtor/media', 'POST', form);
  },
};
