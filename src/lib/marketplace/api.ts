import { PartnerApiError, partnerApi } from '../partnerApi';
import { LEGAL } from './constants';
import { AccessLoss, accessLossOf } from './errors';
import type {
  BulkResult, DashboardMetrics, EnquiryQuestion, Json, Lead, ListResponse, Order, Pagination, Product, Quotation,
  ReturnRequest, Review, Store, StoreStatus, UploadedImage,
} from './types';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Query = Record<string, string | number | boolean | undefined | null>;

const BASE = '/marketplace/merchant';
const encode = encodeURIComponent;

export const queryString = (params: Query = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)); });
  const text = query.toString();
  return text ? `?${text}` : '';
};

// One listener (the store session) is told when the server withdraws access, so every screen reacts the
// same way without each API call site having to know about blocked states.
let accessLossListener: ((reason: AccessLoss) => void) | null = null;
export const onStoreAccessLost = (listener: ((reason: AccessLoss) => void) | null) => { accessLossListener = listener; };

/**
 * Store calls ride the native cookie jar (credentials: include), like every other partner API. A 401 means the
 * 7-day store session lapsed: mint it again once from the Kraftnex session, then retry the call once.
 */
async function call<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const url = `${BASE}${path}`;
  try {
    try {
      return await partnerApi.call<T>(url, method, body);
    } catch (error) {
      if (!(error instanceof PartnerApiError) || error.status !== 401 || path.startsWith('/auth/')) throw error;
      await partnerApi.call(`${BASE}/auth/login`, 'POST', {});
      return await partnerApi.call<T>(url, method, body);
    }
  } catch (error) {
    const lost = accessLossOf(error);
    if (lost) accessLossListener?.(lost);
    throw error;
  }
}

const rowsOf = <T>(data: Json, ...keys: string[]): T[] => {
  for (const key of keys) if (Array.isArray(data[key])) return data[key] as T[];
  return [];
};
const listOf = <T>(data: Json, key: string): ListResponse<T> => ({ items: rowsOf<T>(data, key), pagination: data.pagination as Pagination | undefined, counts: data.counts as Record<string, number> | undefined });

export type ProductQuery = { status?: string; category?: string; q?: string; sort?: string; page?: number; limit?: number };
export type PageQuery = { status?: string; page?: number; limit?: number };

export const merchantApi = {
  // ── Session ────────────────────────────────────────────────────────────────
  status: () => call<StoreStatus>('/auth/status'),
  login: () => call<Json>('/auth/login', 'POST', {}),
  register: (payload: Json) => call<Json>('/auth/register', 'POST', payload),
  logout: () => call<Json>('/auth/logout', 'POST', {}),
  recordLegalConsent: () => partnerApi.call('/consent/legal', 'POST', LEGAL).catch(() => undefined),

  // ── Overview, analytics ────────────────────────────────────────────────────
  metrics: () => call<DashboardMetrics>('/dashboard/metrics'),
  analytics: (from: string, to: string) => call<{ report: Json }>(`/analytics${queryString({ from, to })}`).then(r => r.report),

  // ── Store settings and team ────────────────────────────────────────────────
  store: () => call<Json>('/store').then(r => (r.merchant ?? r.store ?? r) as Store),
  saveStore: (input: Json) => call<Json>('/store', 'PUT', input),
  saveBank: (input: Json) => call<Json>('/store/bank', 'PUT', input),
  inviteStaff: (input: Json) => call<Json>('/store/staff', 'POST', input),
  updateStaff: (id: string, input: Json) => call<Json>(`/store/staff/${encode(id)}`, 'PATCH', input),
  removeStaff: (id: string) => call<Json>(`/store/staff/${encode(id)}`, 'DELETE'),

  // ── Products ───────────────────────────────────────────────────────────────
  products: (query: ProductQuery = {}) => call<Json>(`/products${queryString(query)}`).then(r => listOf<Product>(r, 'products')),
  product: (id: string) => call<Json>(`/products/${encode(id)}`).then(r => r.product as Product),
  createProduct: (input: Json) => call<Json>('/products', 'POST', input).then(r => r.product as Product),
  updateProduct: (id: string, input: Json) => call<Json>(`/products/${encode(id)}`, 'PUT', input).then(r => r.product as Product),
  setStock: (id: string, input: { inStock?: boolean; stockQuantity?: number }) => call<Json>(`/products/${encode(id)}/stock`, 'PATCH', input),
  cloneProduct: (id: string) => call<Json>(`/products/${encode(id)}/clone`, 'POST', {}),
  archiveProduct: (id: string) => call<Json>(`/products/${encode(id)}`, 'DELETE'),
  /** Partial success is a 201 with `failed` rows; a fully rejected batch still carries the same body on the error. */
  bulkProducts: async (products: Json[]): Promise<BulkResult> => {
    try { return await call<BulkResult>('/products/bulk', 'POST', { products }); }
    catch (error) {
      const data = error instanceof PartnerApiError ? error.data as BulkResult | undefined : undefined;
      if (data && Array.isArray(data.failed)) return data;
      throw error;
    }
  },

  // ── Media (init → upload → complete) ───────────────────────────────────────
  initMedia: (input: { purpose: 'product' | 'logo' | 'banner'; fileName: string; fileType: string; fileSize?: number }) => call<Json>('/media/init', 'POST', input),
  completeMedia: (id: string) => call<Json>(`/media/${encode(id)}/complete`, 'POST', {}).then(r => r.image as UploadedImage),

  // ── Leads and quotations ───────────────────────────────────────────────────
  leads: (query: PageQuery = {}) => call<Json>(`/leads${queryString(query)}`).then(r => listOf<Lead>(r, 'leads')),
  /** The API has no single-lead endpoint, so page through the list (newest first) until the lead turns up. */
  findLead: async (id: string, maxPages = 6): Promise<Lead | undefined> => {
    for (let page = 1; page <= maxPages; page += 1) {
      const result = await call<Json>(`/leads${queryString({ page, limit: 50 })}`).then(r => listOf<Lead>(r, 'leads'));
      const hit = result.items.find(lead => lead._id === id);
      if (hit) return hit;
      if (page >= (result.pagination?.totalPages ?? 1)) break;
    }
    return undefined;
  },
  updateLead: (id: string, input: { status?: string; merchantNote?: string }) => call<Json>(`/leads/${encode(id)}`, 'PATCH', input).then(r => r.lead as Lead | undefined),
  sendQuotation: (id: string, input: Partial<Quotation>) => call<Json>(`/leads/${encode(id)}/quotations`, 'POST', input).then(r => r.lead as Lead | undefined),
  enquiryQuestions: () => call<Json>('/enquiry-questions').then(r => rowsOf<EnquiryQuestion>(r, 'questions')),
  saveEnquiryQuestions: (questions: EnquiryQuestion[]) => call<Json>('/enquiry-questions', 'PUT', { questions }),

  // ── Reviews ────────────────────────────────────────────────────────────────
  reviews: (query: { rating?: number | string; page?: number; limit?: number } = {}) => call<Json>(`/reviews${queryString(query)}`).then(r => ({
    ...listOf<Review>(r, 'reviews'), stats: (r.stats ?? {}) as { average?: number; count?: number; breakdown?: Record<string, number> },
  })),

  // ── Legacy orders and returns ──────────────────────────────────────────────
  orders: (query: { tab?: string; page?: number; limit?: number } = {}) => call<Json>(`/orders${queryString(query)}`).then(r => listOf<Order>(r, 'orders')),
  order: (id: string) => call<Json>(`/orders/${encode(id)}`).then(r => (r.order ?? r) as Order),
  updateOrder: (id: string, input: Json) => call<Json>(`/orders/${encode(id)}/status`, 'PATCH', input),
  returns: (query: PageQuery = {}) => call<Json>(`/returns${queryString(query)}`).then(r => listOf<ReturnRequest>(r, 'returns')),
  updateReturn: (id: string, input: Json) => call<Json>(`/returns/${encode(id)}/status`, 'PATCH', input),
};
