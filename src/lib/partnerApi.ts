const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

export type PartnerRoleType = 'customer' | 'designer' | 'technician' | 'realtor' | 'merchant';
export type PartnerRoleStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface PartnerRole {
  type: PartnerRoleType;
  status: PartnerRoleStatus;
}

export interface PartnerProfile {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  profileImage?: string;
  companyName?: string;
}

export interface PartnerUser {
  id: string;
  email: string | null;
  phone: string | null;
  activeRole?: PartnerRoleType;
  roles: PartnerRole[];
  profiles: Partial<Record<PartnerRoleType, PartnerProfile>>;
}

export interface PartnerSession {
  user: PartnerUser | null;
  activeRole?: PartnerRoleType;
}

export interface MerchantStatus {
  success: boolean;
  isMerchant: boolean;
  isOwner: boolean;
  canAccessDashboard: boolean;
  storeRole: string | null;
  accessBlockedReason: string | null;
  merchant: {
    id: string;
    storeName: string;
    approvalStatus: string;
  } | null;
}

export interface TechnicianService {
  _id: string;
  title: string;
}
export interface TechnicianServiceSection {
  _id: string | null;
  name: string;
  items: TechnicianService[];
}
export interface TechnicianServiceCategory {
  key: string;
  name: string;
  sections: TechnicianServiceSection[];
}

export interface TechnicianProfileRecord {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  phone: string;
  type: 'KN_CERTIFIED' | 'INDEPENDENT';
  city: string;
  categories: string[];
  experienceYears?: number;
  servicesOffered: (string | { _id: string })[];
  categoryExpertise: {
    categoryKey: string;
    experienceYears: number;
    note?: string;
    status?: string;
    proofs?: { url: string; label?: string }[];
  }[];
  coordinates?: { lat: number | null; lng: number | null };
  baseAddress?: string;
  baseAccuracyM?: number | null;
  serviceRadiusKm?: number;
  equipmentChecklist?: string[];
  bankDetails?: { accountNumber?: string; ifscCode?: string; upiId?: string };
  documents?: {
    skillCertificationUrl?: string;
    addressProof?: { type: string | null; documentNumber?: string; documentUrl?: string };
  };
  verificationStatus?: string;
  kycStatus?: string;
}

export class PartnerApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'PartnerApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}, skipRefresh = false): Promise<T> {
  if (!API_BASE_URL) {
    throw new PartnerApiError('The partner app is not connected. Set EXPO_PUBLIC_API_BASE_URL in its environment.', 0, 'API_URL_MISSING');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new PartnerApiError('Could not reach Kraftnex. Check your connection and try again.', 0, 'NETWORK');
  }

  if (response.status === 401 && !skipRefresh && !path.startsWith('/v1/auth/login') && !path.startsWith('/v1/auth/refresh')) {
    await request('/v1/auth/refresh', { method: 'POST', body: '{}' }, true);
    return request<T>(path, init, true);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new PartnerApiError(body?.message || `Kraftnex request failed (${response.status}).`, response.status, body?.code);
  return body as T;
}

export const partnerApi = {
  session: () => request<PartnerSession>('/v1/auth/session'),
  login: (emailOrPhone: string, password: string) => request<PartnerSession>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrPhone, password }),
  }, true),
  logout: () => request<{ message: string }>('/v1/auth/logout', { method: 'POST' }),
  merchantStatus: () => request<MerchantStatus>('/marketplace/merchant/auth/status'),
  sendTechnicianOtp: (phone: string) => request<{ message: string }>('/technician/send-otp', {
    method: 'POST', body: JSON.stringify({ phone, intent: 'register' }),
  }, true),
  verifyTechnicianOtp: (phone: string, otp: string, pushToken?: string | null) => request<{
    exists: boolean;
    phone: string;
    phoneVerificationToken: string;
    technician?: { id?: string; _id?: string; name?: string; email?: string; phone?: string; profilePhoto?: string; city?: string; bio?: string };
  }>('/technician/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp, pushToken }) }, true),
  technicianServiceCatalog: () => request<{ categories: TechnicianServiceCategory[] }>('/services/catalog'),
  reverseGeocode: (lat: number, lng: number) => request<{ address?: { formattedAddress?: string; locality?: string; city?: string } }>(`/services/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`),
  forwardGeocode: (address: string) => request<{ lat: number; lng: number; formattedAddress: string }>(`/services/geocode/forward?address=${encodeURIComponent(address)}`),
  registerTechnician: (payload: Record<string, unknown>) => request<{ technician: { id?: string; _id?: string } }>('/technician/register', {
    method: 'POST', body: JSON.stringify(payload),
  }, true),
  technicianProfile: () => request<{ technician: TechnicianProfileRecord }>('/technician/profile'),
  registerPushToken: (token: string, platform: 'android' | 'ios') => request<{ success: boolean }>('/ai/push-token', {
    method: 'POST', body: JSON.stringify({ token, platform }),
  }),
  submitTechnicianOnboarding: () => request<{ ok: boolean; alreadySubmitted?: boolean; submittedAt?: string }>('/technician/onboarding/submit', {
    method: 'POST', body: '{}',
  }),
  updateTechnicianProfile: (payload: Record<string, unknown>) => request<{ technician: TechnicianProfileRecord }>('/technician/profile', {
    method: 'PATCH', body: JSON.stringify(payload),
  }),
  saveTechnicianExpertise: (payload: Record<string, unknown>) => request<{
    categories: string[];
    servicesOffered: (string | { _id: string })[];
    categoryExpertise: TechnicianProfileRecord['categoryExpertise'];
  }>('/technician/expertise', { method: 'PUT', body: JSON.stringify(payload) }),
  recordPartnerLegalConsent: (context: string) => request<{ ok: boolean; acceptedAt: string; policyVersion: string }>('/consent/legal', {
    method: 'POST',
    body: JSON.stringify({ audience: 'partner', context, policyVersion: '2026-10-22', source: 'partner' }),
  }),
};

export function firstNameOf(user: PartnerUser | null): string | null {
  if (!user) return null;
  const profile = user.profiles?.customer
    || (user.activeRole ? user.profiles?.[user.activeRole] : undefined)
    || Object.values(user.profiles || {}).find(Boolean);
  const name = profile?.name?.trim();
  return name ? name.split(/\s+/)[0] : null;
}
