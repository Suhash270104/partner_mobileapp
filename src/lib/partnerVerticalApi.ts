import { partnerApi } from './partnerApi';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const realtorPath = (path: string) => `/realestate/realtor${path}`;

const ACCEPTED_IMAGE_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' };
const EXTENSION_OF: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };

/**
 * Phones report image types inconsistently (image/jpg, a missing type, HEIC, a file name with no extension). The server
 * only accepts well-formed types, so settle on one type and a matching extension; unknown formats such as HEIC go as JPEG
 * (the picker re-encodes them to JPEG).
 */
export function normalizeImageFile(file: { uri: string; name: string; mimeType: string }) {
  const clean = (value: string) => value.split('?')[0].split('#')[0];
  const fromType = ACCEPTED_IMAGE_TYPES[(file.mimeType || '').toLowerCase().replace(/^image\//, '')];
  const fromName = ACCEPTED_IMAGE_TYPES[clean(file.name || '').split('.').pop()?.toLowerCase() || ''];
  const fromUri = ACCEPTED_IMAGE_TYPES[clean(file.uri || '').split('.').pop()?.toLowerCase() || ''];
  const mimeType = fromType || fromName || fromUri || 'image/jpeg';
  const base = clean(file.name || '').replace(/\.[^.]*$/, '') || `photo-${Date.now()}`;
  return { uri: file.uri, name: `${base}.${EXTENSION_OF[mimeType]}`, mimeType };
}

/** A plain-language reason for a failed photo upload, including what the server said and what to try. */
export function uploadErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '';
  const status = cause instanceof PartnerApiError ? cause.status : undefined;
  if (status === 413) return 'The photo is too large for the server. Pick a smaller photo.';
  if (status === 415 || status === 400 && /type|format|mime|image/i.test(message)) return `The server does not accept this image format${message ? ` (${message})` : ''}. Use a JPG or PNG photo.`;
  if (status === 401 || status === 403) return `Your session was not accepted for uploads${message ? ` (${message})` : ''}. Sign out and sign in again.`;
  if (status != null && status >= 500) return `The server had a problem saving the photo (error ${status})${message ? `: ${message}` : ''}. Try again shortly.`;
  if (/network request failed|failed to fetch|could not reach/i.test(message)) return 'Could not reach the server to upload the photo. Check your internet connection and that the app is pointed at the right API address.';
  if (cause instanceof PartnerApiError && cause.code === 'API_URL_MISSING') return message;
  return message || 'The photo could not be uploaded for an unknown reason.';
}

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
