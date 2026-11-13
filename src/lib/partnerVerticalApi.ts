import { partnerApi, PartnerApiError } from './partnerApi';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const realtorPath = (path: string) => `/realestate/realtor${path}`;

export const realtorApi = {
  registerOtp: (input: { email: string; phone: string }) => partnerApi.call<Record<string, unknown>>('/realestate/realtor/register/send-otp', 'POST', input),
  verifyOtp: (input: { phone: string; otp: string }) => partnerApi.call<{ phoneVerificationToken: string }>('/realestate/realtor/register/verify-otp', 'POST', input),
  register: (input: Record<string, unknown>) => partnerApi.call<Record<string, unknown>>('/realestate/realtor/register', 'POST', input),
  login: (input: { email?: string; phone?: string; password: string }) => partnerApi.call<Record<string, unknown>>('/realestate/realtor/login', 'POST', input),
  logout: () => partnerApi.call<Record<string, unknown>>('/logout', 'POST', {}),
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
  uploadMedia: (file: { uri: string; name: string; mimeType: string }, target: { resourceType: string; resourceId: string; type: string }) => {
    const base = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
    if (!base) return Promise.reject(new PartnerApiError('Set EXPO_PUBLIC_API_BASE_URL to upload realtor media.', 0, 'API_URL_MISSING'));
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    form.append('resourceType', target.resourceType);
    form.append('resourceId', target.resourceId);
    form.append('type', target.type);
    const send = () => fetch(`${base}/realestate/realtor/media`, { method: 'POST', body: form, credentials: 'include', headers: { Accept: 'application/json' } });
    const parse = async (response: Response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new PartnerApiError(body?.message || `Media upload failed (${response.status}).`, response.status, body?.code);
      return body as Record<string, unknown>;
    };
    // A 401 means the access cookie expired: renew the session once (partnerApi.session refreshes) and retry once.
    return send().then(async response => {
      if (response.status !== 401) return parse(response);
      await partnerApi.session();
      return parse(await send());
    });
  },
};

async function merchantRequest<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const fullPath = `/marketplace/merchant${path}`;
  try {
    return await partnerApi.call<T>(fullPath, method, body);
  } catch (error) {
    if (!(error instanceof PartnerApiError) || error.status !== 401 || path.startsWith('/auth/')) throw error;
    await partnerApi.call('/marketplace/merchant/auth/login', 'POST', {});
    return partnerApi.call<T>(fullPath, method, body);
  }
}

const queryString = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  const value = query.toString();
  return value ? `?${value}` : '';
};

export const merchantApi = {
  status: () => merchantRequest<Record<string, unknown>>('/auth/status'),
  register: (input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>('/auth/register', 'POST', input),
  signOut: () => merchantRequest<Record<string, unknown>>('/auth/logout', 'POST', {}),
  metrics: () => merchantRequest<Record<string, unknown>>('/dashboard/metrics'),
  products: (params: Record<string, string | number | boolean | undefined> = {}) => merchantRequest<Record<string, unknown>>(`/products${queryString(params)}`),
  product: (id: string) => merchantRequest<Record<string, unknown>>(`/products/${encodeURIComponent(id)}`),
  saveProduct: (input: Record<string, unknown>, id?: string) => merchantRequest<Record<string, unknown>>(id ? `/products/${encodeURIComponent(id)}` : '/products', id ? 'PUT' : 'POST', input),
  removeProduct: (id: string) => merchantRequest<Record<string, unknown>>(`/products/${encodeURIComponent(id)}`, 'DELETE'),
  cloneProduct: (id: string) => merchantRequest<Record<string, unknown>>(`/products/${encodeURIComponent(id)}/clone`, 'POST', {}),
  initMedia: (input: { purpose: 'product' | 'logo' | 'banner'; fileName: string; fileType: string; fileSize?: number }) => merchantRequest<Record<string, any>>('/media/init', 'POST', input),
  completeMedia: (id: string) => merchantRequest<Record<string, any>>(`/media/${encodeURIComponent(id)}/complete`, 'POST', {}),
  setStock: (id: string, input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>(`/products/${encodeURIComponent(id)}/stock`, 'PATCH', input),
  bulkProducts: (products: Record<string, unknown>[]) => merchantRequest<Record<string, unknown>>('/products/bulk', 'POST', { products }),
  orders: (params: Record<string, string | number | undefined> = {}) => merchantRequest<Record<string, unknown>>(`/orders${queryString(params)}`),
  updateOrder: (id: string, input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>(`/orders/${encodeURIComponent(id)}/status`, 'PATCH', input),
  returns: (params: Record<string, string | number | undefined> = {}) => merchantRequest<Record<string, unknown>>(`/returns${queryString(params)}`),
  updateReturn: (id: string, input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>(`/returns/${encodeURIComponent(id)}/status`, 'PATCH', input),
  promoCodes: () => merchantRequest<Record<string, unknown>>('/promo-codes'),
  savePromo: (input: Record<string, unknown>, id?: string) => merchantRequest<Record<string, unknown>>(id ? `/promo-codes/${encodeURIComponent(id)}` : '/promo-codes', id ? 'PUT' : 'POST', input),
  deletePromo: (id: string) => merchantRequest<Record<string, unknown>>(`/promo-codes/${encodeURIComponent(id)}`, 'DELETE'),
  flashSales: () => merchantRequest<Record<string, unknown>>('/flash-sales'),
  saveFlashSale: (input: Record<string, unknown>, id?: string) => merchantRequest<Record<string, unknown>>(id ? `/flash-sales/${encodeURIComponent(id)}` : '/flash-sales', id ? 'PUT' : 'POST', input),
  deleteFlashSale: (id: string) => merchantRequest<Record<string, unknown>>(`/flash-sales/${encodeURIComponent(id)}`, 'DELETE'),
  storeOffers: () => merchantRequest<Record<string, unknown>>('/offers'),
  saveStoreOffer: (input: Record<string, unknown>, id?: string) => merchantRequest<Record<string, unknown>>(id ? `/offers/${encodeURIComponent(id)}` : '/offers', id ? 'PUT' : 'POST', input),
  setStoreOfferActive: (id: string, isActive: boolean) => merchantRequest<Record<string, unknown>>(`/offers/${encodeURIComponent(id)}/switch`, 'PATCH', { isActive }),
  deleteStoreOffer: (id: string) => merchantRequest<Record<string, unknown>>(`/offers/${encodeURIComponent(id)}`, 'DELETE'),
  switchStoreOffer: (id: string, input: { displayOnMarketplace?: boolean; status?: 'active' | 'paused' | 'expired' }) => merchantRequest<Record<string, unknown>>(`/offers/${encodeURIComponent(id)}/switch`, 'PATCH', input),
  publishFlashSale: (id: string) => merchantRequest<Record<string, unknown>>(`/flash-sales/${encodeURIComponent(id)}/publish`, 'PATCH', {}),
  addFlashSaleProducts: (id: string, products: { productId: string; discountPercentage?: number; stockLimit?: number }[]) => merchantRequest<Record<string, unknown>>(`/flash-sales/${encodeURIComponent(id)}/products`, 'POST', { products }),
  removeFlashSaleProduct: (id: string, productId: string) => merchantRequest<Record<string, unknown>>(`/flash-sales/${encodeURIComponent(id)}/products/${encodeURIComponent(productId)}`, 'DELETE'),
  returnById: (id: string) => merchantRequest<Record<string, unknown>>(`/returns/${encodeURIComponent(id)}`),
  enquiryQuestions: () => merchantRequest<Record<string, unknown>>('/enquiry-questions'),
  saveEnquiryQuestions: (questions: Record<string, unknown>[]) => merchantRequest<Record<string, unknown>>('/enquiry-questions', 'PUT', { questions }),
  leads: (params: Record<string, string | number | undefined> = {}) => merchantRequest<Record<string, unknown>>(`/leads${queryString(params)}`),
  updateLead: (id: string, input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>(`/leads/${encodeURIComponent(id)}`, 'PATCH', input),
  sendQuotation: (id: string, input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>(`/leads/${encodeURIComponent(id)}/quotations`, 'POST', input),
  reviews: (params: Record<string, string | number | undefined> = {}) => merchantRequest<Record<string, unknown>>(`/reviews${queryString(params)}`),
  store: () => merchantRequest<Record<string, unknown>>('/store'),
  saveStore: (input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>('/store', 'PUT', input),
  saveBank: (input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>('/store/bank', 'PUT', input),
  inviteStaff: (input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>('/store/staff', 'POST', input),
  updateStaff: (id: string, input: Record<string, unknown>) => merchantRequest<Record<string, unknown>>(`/store/staff/${encodeURIComponent(id)}`, 'PATCH', input),
  removeStaff: (id: string) => merchantRequest<Record<string, unknown>>(`/store/staff/${encodeURIComponent(id)}`, 'DELETE'),
};
