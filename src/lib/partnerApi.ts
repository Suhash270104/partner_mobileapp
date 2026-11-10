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
    rejectionReason?: string;
    proofs?: { url: string; label?: string }[];
  }[];
  coordinates?: { lat: number | null; lng: number | null };
  baseAddress?: string;
  baseAccuracyM?: number | null;
  serviceRadiusKm?: number;
  equipmentChecklist?: string[];
  bio?: string;
  profilePhoto?: string;
  liveSelfieUrl?: string;
  availabilitySlots?: { dayOfWeek: number; slots: string[] }[];
  isOnline?: boolean;
  currentStatus?: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  rating?: number;
  totalReviews?: number;
  responseRatePercent?: number;
  jobsCompleted?: number;
  earningsTotal?: number;
  earningsPending?: number;
  onboardingSubmittedAt?: string | null;
  rejectionReason?: string;
  bankDetails?: { accountNumber?: string; ifscCode?: string; upiId?: string };
  documents?: {
    skillCertificationUrl?: string;
    addressProof?: { type: string | null; documentNumber?: string; documentUrl?: string };
  };
  verificationStatus?: string;
  kycStatus?: string;
}

export interface TechnicianBookingRecord {
  id?: string;
  _id?: string;
  bookingNumber?: string;
  status: string;
  serviceCategory?: string;
  serviceSnapshot?: { title?: string };
  scheduledDate?: string;
  scheduledSlot?: string;
  customerDetails?: {
    name?: string;
    phone?: string;
    address?: {
      street?: string;
      locality?: string;
      city?: string;
      pincode?: string;
      lat?: number | null;
      lng?: number | null;
    };
  };
  pricing?: {
    totalAmount?: number;
    balanceDue?: number;
    paymentStatus?: string;
  };
  problemDescription?: string;
  candidateTechnicianQueue?: { technicianId?: string; status?: string; assignedAt?: string }[];
  jobDocumentation?: {
    beforePhotos?: JobPhoto[];
    afterPhotos?: JobPhoto[];
    workSummaryNote?: string;
  };
  diagnosisAddons?: { discoveredIssue?: string; totalAddonPrice?: number; status?: string }[];
  completedAt?: string;
  updatedAt?: string;
}

export interface JobPhoto {
  imageId?: string;
  url: string;
}

export type JobPhotoPhase = 'before' | 'after';
export type CollectionMethod = 'CASH_ON_SERVICE' | 'UPI_QR';

export const TECHNICIAN_CANCEL_REASONS: { code: string; label: string }[] = [
  { code: 'PERSONAL_EMERGENCY', label: 'Personal emergency' },
  { code: 'VEHICLE_BREAKDOWN', label: 'Vehicle broke down' },
  { code: 'PREVIOUS_JOB_OVERRAN', label: 'My previous job is running late' },
  { code: 'TOO_FAR', label: 'Too far to reach in time' },
  { code: 'NOT_MY_SKILL', label: "This job needs skills I don't have" },
  { code: 'CUSTOMER_UNREACHABLE', label: "I can't reach the customer" },
  { code: 'OTHER', label: 'Other reason' },
];

// Mirrors backend/config/serviceSlots.js, the weekly slot vocabulary for KN Certified technicians.
export const SERVICE_SLOT_OPTIONS = ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '2:00 PM - 4:00 PM', '4:00 PM - 6:00 PM'];
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface TechnicianEarningsRecord {
  earningsTotal: number;
  earningsPending: number;
  jobsCompleted: number;
  recentJobs: {
    _id?: string;
    bookingNumber?: string;
    pricing?: { totalAmount?: number; taxAmount?: number; paymentStatus?: string };
    updatedAt?: string;
    serviceCategory?: string;
    technicianPayout: number;
  }[];
}

export type TechnicianKycStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'IN_REVIEW' | 'EXPIRED' | 'EXEMPT';
export type KycSupportReason = 'id_not_accepted' | 'name_mismatch' | 'document_quality' | 'other';

export interface TechnicianKycState {
  status: TechnicianKycStatus;
  sessionId: string;
  declineCount: number;
  attemptLimit: number;
  attemptsRemaining: number;
  declineReasons: string[];
  nameMatch: 'MATCH' | 'MISMATCH' | 'UNKNOWN';
  documentName: string;
  expiryDate: string | null;
  verifiedAt: string | null;
  decidedAt: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  setupIncomplete: boolean;
}

export interface TechnicianKycSupportTicket {
  ticketId: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt?: string;
}

export const KYC_SUPPORT_REASONS: { value: KycSupportReason; label: string }[] = [
  { value: 'id_not_accepted', label: "My ID wasn't accepted" },
  { value: 'name_mismatch', label: "The name on my ID doesn't match" },
  { value: 'document_quality', label: 'Photo or document quality issue' },
  { value: 'other', label: 'Something else' },
];

export class PartnerApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'PartnerApiError';
  }
}

function uploadFormData<T>(path: string, formData: FormData, skipRefresh: boolean): Promise<T> {
  if (!API_BASE_URL) {
    return Promise.reject(new PartnerApiError('The partner app is not connected. Set EXPO_PUBLIC_API_BASE_URL in its environment.', 0, 'API_URL_MISSING'));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        body = {};
      }

      if (xhr.status === 401 && !skipRefresh) {
        void request('/v1/auth/refresh', { method: 'POST', body: '{}' }, true)
          .then(() => uploadFormData<T>(path, formData, true))
          .then(resolve, reject);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new PartnerApiError(
          typeof body.message === 'string' ? body.message : `Kraftnex request failed (${xhr.status}).`,
          xhr.status,
          typeof body.code === 'string' ? body.code : undefined,
        ));
        return;
      }
      resolve(body as T);
    };
    xhr.onerror = () => reject(new PartnerApiError(
      `Could not reach Kraftnex for POST ${path}. Check that your phone and computer can reach the configured API.`,
      0,
      'NETWORK',
    ));
    xhr.ontimeout = () => reject(new PartnerApiError('The document upload timed out. Check your connection and try again.', 0, 'TIMEOUT'));
    xhr.onabort = () => reject(new PartnerApiError('The document upload was canceled.', 0, 'ABORTED'));
    xhr.send(formData);
  });
}

async function request<T>(path: string, init: RequestInit = {}, skipRefresh = false): Promise<T> {
  if (!API_BASE_URL) {
    throw new PartnerApiError('The partner app is not connected. Set EXPO_PUBLIC_API_BASE_URL in its environment.', 0, 'API_URL_MISSING');
  }

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (isFormData && init.body instanceof FormData) {
    return uploadFormData<T>(path, init.body, skipRefresh);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(!isFormData ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch (error) {
    const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
    throw new PartnerApiError(
      `Could not reach Kraftnex for ${init.method || 'GET'} ${path}.${detail} Check that your phone and computer can reach the configured API.`,
      0,
      'NETWORK',
    );
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
  forgotPassword: (email: string) => request<{ message: string }>('/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
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
  technicianKycStatus: () => request<{
    kyc: TechnicianKycState;
    support: TechnicianKycSupportTicket | null;
    configured: boolean;
  }>('/kyc/status'),
  createTechnicianKycSession: () => request<{ url: string; sessionId: string; reused: boolean }>('/kyc/session', {
    method: 'POST',
    body: '{}',
  }),
  syncTechnicianKyc: (sessionId?: string) => request<{ action: string; kyc: TechnicianKycState }>('/kyc/sync', {
    method: 'POST',
    body: JSON.stringify(sessionId ? { sessionId } : {}),
  }),
  submitTechnicianKycSupportRequest: (input: { reason: KycSupportReason; message: string }) => request<{
    ticketId: string;
    status: TechnicianKycSupportTicket['status'];
    duplicate: boolean;
  }>('/kyc/support-request', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updateTechnicianAvailability: (isOnline: boolean, currentStatus?: TechnicianProfileRecord['currentStatus']) => request<{ technician: TechnicianProfileRecord }>('/technician/status', {
    method: 'PATCH',
    body: JSON.stringify({ isOnline, ...(currentStatus ? { currentStatus } : {}) }),
  }),
  technicianIncomingJob: () => request<{ booking: TechnicianBookingRecord | null }>('/technician/jobs/incoming'),
  technicianActiveJobs: () => request<{ bookings: TechnicianBookingRecord[] }>('/technician/jobs/active'),
  technicianJobHistory: () => request<{ bookings: TechnicianBookingRecord[] }>('/technician/jobs/history'),
  technicianEarnings: () => request<TechnicianEarningsRecord>('/technician/earnings'),
  respondToTechnicianJob: (bookingId: string, action: 'accept' | 'reject') => request<{ message: string; booking?: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  }),
  startTechnicianTravel: (bookingId: string) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/start-travel`, {
    method: 'PATCH',
    body: '{}',
  }),
  markTechnicianArrived: (bookingId: string, input: { otp: string; selfieUrl: string; lat?: number; lng?: number }) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/arrived`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
  startTechnicianWork: (bookingId: string) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/start-work`, {
    method: 'PATCH', body: '{}',
  }),
  initTechnicianJobPhoto: (bookingId: string, input: { phase: JobPhotoPhase; fileName: string; fileType: string; fileSize?: number }) => request<{ imageId: string; uploadUrl: string }>(`/technician/jobs/${encodeURIComponent(bookingId)}/photos/init`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  completeTechnicianJobPhoto: (bookingId: string, imageId: string, input: { phase: JobPhotoPhase; lat: number | null; lng: number | null }) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/photos/${encodeURIComponent(imageId)}/complete`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  markTechnicianWorkDone: (bookingId: string, workSummaryNote?: string) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/mark-work-done`, {
    method: 'PATCH', body: JSON.stringify(workSummaryNote ? { workSummaryNote } : {}),
  }),
  submitTechnicianDiagnosisAddon: (bookingId: string, input: { discoveredIssue: string; suggestedFix: string; partName: string; partPrice: number; laborPrice: number }) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/diagnosis-addon`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  completeTechnicianJob: (bookingId: string, input: { otp: string; collected?: { method: CollectionMethod; amount: number } }) => request<{ booking: TechnicianBookingRecord }>(`/technician/jobs/${encodeURIComponent(bookingId)}/complete`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
  cancelTechnicianJob: (bookingId: string, reasonCode: string, note: string) => request<{ message: string }>(`/technician/jobs/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST', body: JSON.stringify({ reasonCode, note }),
  }),
  updateTechnicianLocation: (input: { lat: number; lng: number; accuracy?: number }) => request<{ recorded: boolean }>('/technician/location', {
    method: 'PATCH', body: JSON.stringify(input),
  }),
  registerPushToken: (token: string, platform: 'android' | 'ios') => request<{ success: boolean }>('/ai/push-token', {
    method: 'POST', body: JSON.stringify({ token, platform }),
  }),
  submitTechnicianOnboarding: () => request<{ ok: boolean; alreadySubmitted?: boolean; submittedAt?: string }>('/technician/onboarding/submit', {
    method: 'POST', body: '{}',
  }),
  updateTechnicianProfile: (payload: Record<string, unknown>) => request<{ technician: TechnicianProfileRecord }>('/technician/profile', {
    method: 'PATCH', body: JSON.stringify(payload),
  }),
  uploadTechnicianDocument: (file: { uri: string; name: string; mimeType: string }) => {
    const body = new FormData();
    body.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    return request<{ url: string }>('/technician/profile/document', { method: 'POST', body });
  },
  saveTechnicianExpertise: (payload: Record<string, unknown>) => request<{
    categories: string[];
    servicesOffered: (string | { _id: string })[];
    categoryExpertise: TechnicianProfileRecord['categoryExpertise'];
  }>('/technician/expertise', { method: 'PUT', body: JSON.stringify(payload) }),
  recordPartnerLegalConsent: (context: string) => request<{ ok: boolean; acceptedAt: string; policyVersion: string }>('/consent/legal', {
    method: 'POST',
    body: JSON.stringify({ audience: 'partner', context, policyVersion: '2026-10-22', source: 'partner' }),
  }),
  accountRegisterSendOtp: (email: string, phone: string) => request<{ message?: string; resendAfterSeconds?: number }>('/customer/register/send-otp', {
    method: 'POST', body: JSON.stringify({ email, phone }),
  }, true),
  accountRegisterVerifyOtp: (phone: string, otp: string) => request<{ exists?: boolean; phoneVerificationToken: string }>('/customer/register/verify-otp', {
    method: 'POST', body: JSON.stringify({ phone, otp }),
  }, true),
  accountRegister: (payload: { name: string; email: string; phone: string; password: string; phoneVerificationToken: string }) => request<{ message?: string }>('/customer/register', {
    method: 'POST', body: JSON.stringify({ ...payload, website: '' }),
  }, true),
  studioDashboard: () => request<StudioDashboardResponse>('/dashboard/professional'),
  updateStudioProfile: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/professional/profile', { method: 'PUT', body: JSON.stringify(payload) }),
  openClientProjects: () => request<OpenClientProject[] | { projects?: OpenClientProject[] }>('/client-projects?projectType=client'),
  assignedStudioProjects: (designerId: string) => request<OpenClientProject[]>(`/client-projects/for-professional/${designerId}`),
  assignedStudioProjectsMe: () => request<OpenClientProject[]>('/client-projects/for-professional/me'),
  createStudioProject: (payload: Record<string, unknown>) => request<Record<string, unknown>>('/client-projects', { method: 'POST', body: JSON.stringify(payload) }),
  clientProjectFull: (projectId: string) => request<StudioProjectDetail>(`/client-projects/${projectId}`),
  // Thin typed pass-through for studio screens that call a handful of REST endpoints each.
  call: <T = Record<string, unknown>>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', body?: unknown) =>
    request<T>(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
  studioChatRooms: () => request<unknown[] | { rooms?: unknown[] }>('/chat/rooms/professional/me'),
  sendChatMessage: (roomId: string, message: Record<string, unknown>) => request<{ message?: Record<string, unknown> }>('/chat/message', { method: 'POST', body: JSON.stringify({ roomId, message }) }),
  myProposals: () => request<unknown[]>('/proposals/my-proposals'),
  studioLeads: () => request<StudioLead[]>('/professional/leads?include=refunded'),
  studioAvailableLeads: () => request<StudioAvailableLead[]>('/professional/leads/available'),
  studioUnlockQuote: (projectId: string) => request<StudioUnlockQuote>(`/professional/leads/${projectId}/unlock-quote`),
  studioUnlockWithCredit: (projectId: string) => request<{ leadCredits?: number; bonusLeadCredits?: number }>(`/professional/leads/${projectId}/unlock-with-credit`, { method: 'POST', body: '{}' }),
  studioRefundReasons: () => request<{ reasons?: { id: string; label: string }[] }>('/professional/leads/refund-reasons'),
  studioRequestRefund: (projectId: string, reason: string, details: string) => request<{ success?: boolean }>(`/professional/leads/${projectId}/refund-request`, { method: 'POST', body: JSON.stringify({ reason, details }) }),
  clientProjectDetail: (projectId: string) => request<{ clientName?: string; clientPhone?: string; clientEmail?: string; exactAddress?: string }>(`/client-projects/${projectId}`),
  submitStudioProposal: (payload: { projectId: string; priceEst: string; timeline: string; scopeText: string }) => request<{ proposal?: StudioProposalRecord }>('/proposals', { method: 'POST', body: JSON.stringify(payload) }),
  openProfessionalChatRoom: (projectId: string) => request<{ room?: { roomId?: string } }>('/chat/room/professional', { method: 'POST', body: JSON.stringify({ projectId }) }),
  createCashfreeOrder: (payload: Record<string, unknown>) => request<CashfreeOrder>('/payments/cashfree/order', { method: 'POST', body: JSON.stringify(payload) }),
  verifyCashfreeOrder: (orderId: string, buyerType: 'designer') => request<{ success: boolean; status: 'PAID' | 'PENDING' | 'FAILED' | 'USER_DROPPED' }>('/payments/cashfree/verify', { method: 'POST', body: JSON.stringify({ orderId, buyerType }) }),
  publicPricing: () => request<{ subscriptions?: PublicPlan[] }>('/pricing/public'),
  professionalProfile: () => request<ProfessionalProfileRecord>('/professional/profile'),
  saveProfessionalOnboarding: (payload: { stage: number; businessName: string; companyName: string; data: Record<string, unknown>; isComplete: boolean }) => request<{
    success: boolean;
    designer: { _id?: string; id?: string };
  }>('/professional/onboarding', { method: 'POST', body: JSON.stringify(payload) }),
  verifyProfessionalGst: (gstin: string) => request<{ success: boolean; message?: string; data?: ProfessionalGstDetails }>('/professional/onboarding/verify-gst', {
    method: 'POST',
    body: JSON.stringify({ gstin }),
  }),
  initImageUpload: (payload: { entityType: string; entityId?: string; fileName: string; fileType: string; fileSize?: number }) => request<{
    success: boolean;
    imageId: string;
    uploadUrl: string;
    key: string;
  }>('/images/init', { method: 'POST', body: JSON.stringify(payload) }),
  completeImageUpload: (imageId: string) => request<{ success: boolean; image: { url: string } }>(`/images/${imageId}/complete`, {
    method: 'POST',
    body: '{}',
  }),
  uploadMedia: (file: { uri: string; name: string; mimeType: string }, folder: string) => {
    const body = new FormData();
    body.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    body.append('folder', folder);
    return request<{ publicUrl: string; key: string; isMock?: boolean }>('/media/upload', { method: 'POST', body });
  },
};

export interface ProfessionalGstDetails {
  gstin?: string;
  legalName?: string;
  tradeName?: string;
  gstStatus?: string;
  constitution?: string;
  taxpayerType?: string;
  pan?: string;
  state?: string;
  isVerified?: boolean;
  verifiedAt?: string;
}

export interface ProfessionalProfileRecord {
  _id?: string;
  companyName?: string;
  businessName?: string;
  city?: string;
  experience?: number;
  isOnboarded?: boolean;
  onboardingStage?: number;
  onboardingData?: Record<string, unknown>;
  acceptedBudgetCategories?: string[];
  membershipLevel?: string;
  industries?: string[];
  portfolioImages?: string[];
  approvalStatus?: string;
  isApproved?: boolean;
  leadCredits?: number;
  bonusLeadCredits?: number;
  unlockedClientProjectIds?: unknown[];
  servicesOffered?: string[];
  availability?: string;
}

export function firstNameOf(user: PartnerUser | null): string | null {
  if (!user) return null;
  const profile = user.profiles?.customer
    || (user.activeRole ? user.profiles?.[user.activeRole] : undefined)
    || Object.values(user.profiles || {}).find(Boolean);
  const name = profile?.name?.trim();
  return name ? name.split(/\s+/)[0] : null;
}

export interface StudioProposalRecord {
  _id?: string;
  id?: string;
  status?: string;
  createdAt?: string;
  priceEst?: string;
  amount?: string | number;
  proposedPrice?: string | number;
  budget?: string | number;
  timeline?: string;
  scopeText?: string;
  title?: string;
  projectTitle?: string;
  clientName?: string;
  location?: string;
  city?: string;
  customerId?: { name?: string };
  customer?: { name?: string };
  projectId?: { _id?: string; title?: string; clientName?: string; location?: string; city?: string } | string;
  project?: { title?: string; location?: string; city?: string; budgetRange?: string; timeline?: string };
}

export interface StudioDashboardResponse {
  stats?: { leads?: number; proposalsSubmitted?: number; shortlisted?: number; projectsWon?: number; conversations?: number };
  professional?: { profileViews?: number };
  proposals?: StudioProposalRecord[];
  recentMessages?: { id?: string | number; clientName?: string; text?: string; time?: string }[];
  revenueEarned?: number;
  kaiMetrics?: { score?: number };
}

export interface CashfreeOrder { success: boolean; orderId: string; paymentSessionId: string; environment: 'production' | 'sandbox'; amount?: number; message?: string }

export interface PublicPlan {
  id: string;
  name?: string;
  badge?: string;
  isPopular?: boolean;
  monthlyPrice?: number;
  projectLeadUnlocksPerMonth?: number;
  leadUnlocksPerMonth?: number;
  subtitle?: string;
  credits?: number;
  creditTiers?: { credits: number; renders?: number; monthlyPrice: number; yearlyPrice?: number }[];
  featureSections?: { title?: string; items?: (string | { text?: string; label?: string })[]; features?: (string | { text?: string })[] }[];
  promo?: { isLive?: boolean; label?: string; monthlyPrice?: number };
}

export interface StudioLead {
  id?: string;
  _id?: string;
  projectId?: string;
  roomId?: string;
  status?: string;
  unlockedAt?: string;
  isAwarded?: boolean;
  hasSubmittedProposal?: boolean;
  proposalStatus?: string;
  origin?: string;
  unlockMethod?: string | null;
  creditWallet?: string | null;
  amountPaid?: number | null;
  project?: { _id?: string; id?: string; title?: string; location?: string; city?: string; budgetRange?: string; propertyType?: string; timeline?: string; serviceType?: string };
  customer?: { name?: string; email?: string; phone?: string };
  refund?: { status?: string; reasonLabel?: string; adminNote?: string; creditReturned?: boolean; reviewedAt?: string } | null;
}

export interface StudioAvailableLead {
  id: string;
  title?: string;
  location?: string;
  city?: string;
  budgetRange?: string;
  propertyType?: string;
  timeline?: string;
  areaSqFt?: string | number;
  proposalsReceived?: number;
  maxProposals?: number;
}

export interface StudioUnlockQuote {
  state: 'LOCKED' | 'UNLOCKED' | 'BLOCKED';
  blockedReason: { code: string; message: string } | null;
  leadCredits: number;
  creditCost: number;
  payPrice: number | null;
  payTier: string;
  projectTier?: string;
  bonusLeadCredits?: number;
  planLeadCredits?: number;
  subscriptionTier: string;
}

export interface OpenClientProject {
  _id?: string;
  id?: string;
  title?: string;
  status?: string;
  designerId?: string;
  projectType?: string;
  location?: string;
  city?: string;
  locality?: string;
  budgetRange?: string;
  budgetCategory?: string;
  propertyType?: string;
  timeline?: string;
  areaSqFt?: string | number;
  previewThumbnail?: string;
  moderationStatus?: string;
  proposalsReceived?: number;
  maxProposals?: number;
  updatedAt?: string;
  createdAt?: string;
  membershipLevel?: string;
  category?: string;
  subtype?: string;
  serviceType?: string;
  description?: string;
}

export interface StudioProjectDetail extends OpenClientProject {
  description?: string;
  clientName?: string;
  serviceType?: string;
  tags?: string[];
  galleryImages?: { main?: string; others?: string[] };
  images?: string[];
  portfolioImages?: string[];
}
