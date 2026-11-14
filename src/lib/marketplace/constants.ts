// Single source of truth for every marketplace value that has no metadata endpoint yet.
// These mirror backend/config/marketplaceTaxonomy.js and merchantModel.js (hand-off §14). The server
// validates every value, so these lists only drive pickers and labels. Strings that contain
// non-ASCII characters (en-dash, rupee sign) must be sent exactly as written here.
//
// Categories and subcategories are NOT here: they are loaded live (see taxonomy.ts).

import type { Option } from './types';

const options = (values: readonly string[], labels: Record<string, string> = {}): Option[] =>
  values.map(value => ({ value, label: labels[value] ?? value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) }));

export const BUSINESS_TYPES = ['manufacturer', 'distributor', 'wholesaler', 'dealer', 'retailer', 'fabricator', 'importer', 'service_provider'] as const;
export const LEGAL_STATUSES = ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'huf', 'other'] as const;
export const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;
export const ORDERS_FULFILLED_RANGES = ['Under 100', '100–500', '500–2,000', '2,000–10,000', '10,000+'] as const;
export const ANNUAL_TURNOVER_RANGES = ['Up to ₹1 Cr', '₹1–5 Cr', '₹5–25 Cr', '₹25–100 Cr', '₹100 Cr+'] as const;
export const CAPABILITIES = ['bulk_supply', 'custom_orders', 'installation', 'pan_india_delivery', 'export', 'samples', 'credit_terms'] as const;

export const UNITS = ['piece', 'set', 'box', 'sq_ft', 'sq_m', 'sheet', 'meter', 'pair', 'kg', 'liter', 'pack', 'bag', 'tonne', 'quintal', 'cu_ft', 'cu_m', 'brass', 'running_ft', 'roll', 'bundle', 'carton', 'load'] as const;
export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const PRICE_TYPES = ['fixed', 'range', 'on_request'] as const;
export const PRODUCT_STATUSES = ['published', 'draft', 'archived'] as const;
export const SUPPLY_PERIODS = ['day', 'week', 'month', 'year'] as const;
export const DIMENSION_UNITS = ['mm', 'cm', 'inch', 'ft', 'm'] as const;

export const LEAD_STATUSES = ['new', 'responded', 'quoted', 'won', 'lost', 'closed'] as const;
export const QUOTATION_STATUSES = ['sent', 'superseded', 'accepted', 'declined'] as const;
export const QUESTION_TYPES = ['text', 'textarea', 'number', 'select', 'date'] as const;

export const STORE_ROLES = ['owner', 'manager', 'inventory', 'fulfillment'] as const;
export const INVITABLE_ROLES = ['manager', 'inventory', 'fulfillment'] as const;
export const STAFF_STATUSES = ['invited', 'active', 'suspended'] as const;

export const ORDER_TABS = ['ALL', 'NEW', 'IN_PREPARATION', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'completed', 'refunded'] as const;

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

export const COURIER_PARTNERS = ['Delhivery', 'BlueDart', 'DTDC', 'Ekart', 'Shiprocket', 'India Post', 'Store Delivery'] as const;

// ── Picker options (value + label) ─────────────────────────────────────────────
export const BUSINESS_TYPE_OPTIONS = options(BUSINESS_TYPES);
export const LEGAL_STATUS_OPTIONS = options(LEGAL_STATUSES, { llp: 'LLP', huf: 'HUF', private_limited: 'Private limited', public_limited: 'Public limited' });
export const EMPLOYEE_OPTIONS = options(EMPLOYEE_RANGES, Object.fromEntries(EMPLOYEE_RANGES.map(v => [v, v])));
export const ORDERS_FULFILLED_OPTIONS = options(ORDERS_FULFILLED_RANGES, Object.fromEntries(ORDERS_FULFILLED_RANGES.map(v => [v, v])));
export const ANNUAL_TURNOVER_OPTIONS = options(ANNUAL_TURNOVER_RANGES, Object.fromEntries(ANNUAL_TURNOVER_RANGES.map(v => [v, v])));
export const CAPABILITY_OPTIONS = options(CAPABILITIES, { pan_india_delivery: 'Pan-India delivery' });
export const STATE_OPTIONS: Option[] = INDIAN_STATES.map(value => ({ value, label: value }));
export const UNIT_OPTIONS = options(UNITS, {
  sq_ft: 'Square foot (sq. ft)', sq_m: 'Square metre (sq. m)', meter: 'Running metre', liter: 'Litre', kg: 'Kilogram',
  tonne: 'Tonne', quintal: 'Quintal (100 kg)', cu_ft: 'Cubic foot', cu_m: 'Cubic metre', running_ft: 'Running foot',
});
export const GST_OPTIONS: Option[] = GST_RATES.map(rate => ({ value: String(rate), label: `${rate}%` }));
export const PRICE_TYPE_OPTIONS: Option[] = [
  { value: 'fixed', label: 'Fixed price' }, { value: 'range', label: 'Price range' }, { value: 'on_request', label: 'On request' },
];
export const SUPPLY_PERIOD_OPTIONS = options(SUPPLY_PERIODS, { day: 'Per day', week: 'Per week', month: 'Per month', year: 'Per year' });
export const DIMENSION_UNIT_OPTIONS = options(DIMENSION_UNITS, Object.fromEntries(DIMENSION_UNITS.map(v => [v, v])));
export const LEAD_STATUS_OPTIONS = options(LEAD_STATUSES);
export const QUESTION_TYPE_OPTIONS: Option[] = [
  { value: 'text', label: 'Short text' }, { value: 'textarea', label: 'Long text' }, { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' }, { value: 'date', label: 'Date' },
];
export const STAFF_ROLE_OPTIONS: Option[] = [
  { value: 'manager', label: 'Manager' }, { value: 'inventory', label: 'Inventory specialist' }, { value: 'fulfillment', label: 'Fulfilment' },
];
export const ROLE_LABELS: Record<string, string> = { owner: 'Store owner', manager: 'Manager', inventory: 'Inventory specialist', fulfillment: 'Fulfilment' };
export const COURIER_OPTIONS: Option[] = COURIER_PARTNERS.map(value => ({ value, label: value }));

// ── Server limits and defaults (hand-off §4, §8) ──────────────────────────────
export const LIMITS = {
  storeName: { min: 2, max: 120 }, businessName: { min: 2, max: 200 }, description: 2000, address: { min: 3, max: 300 }, locality: 120,
  city: { min: 2, max: 80 }, serviceAreas: { items: 50, length: 80 }, certifications: { items: 20, length: 80 },
  accountNumber: { min: 9, max: 18 }, bankName: { min: 2, max: 120 }, beneficiary: { min: 2, max: 120 },
  yearEstablished: { min: 1900 }, iecCode: 10,
  productTitle: { min: 3, max: 200 }, productDescription: 5000, brand: 120, sku: 64, unitLabel: 60, photos: 12, photosUi: 5,
  maxPrice: 100_000_000, leadTimeDays: 365, deliveryLocations: 30, tags: 30,
  questions: 15, questionLabel: { min: 2, max: 200 }, questionOptions: { min: 2, max: 20 },
  quotePaymentTerms: 300, quoteNotes: 2000, noteLength: 2000, listPageSize: 20, listMaxPageSize: 50, bulkRows: 500, analyticsDays: 30,
} as const;

export const DEFAULT_HOURS = { openTime: '09:00', closeTime: '20:00', isOpenSundays: false } as const;
export const DEFAULT_COUNTRY = 'India';
export const STORE_TIME_ZONE = 'Asia/Kolkata';
export const STORE_SESSION_DAYS = 7;

// ── Legal consent (shared with the web wizard) ────────────────────────────────
export const LEGAL = { audience: 'partner', context: 'seller_signup', policyVersion: '2026-10-22', source: 'partner' } as const;

// ── Server error codes the app reacts to (hand-off §13) ───────────────────────
export const ERROR_CODES = {
  validation: 'VALIDATION_ERROR', sessionExpired: 'AUTH_SESSION_EXPIRED', merchantSessionRequired: 'MERCHANT_SESSION_REQUIRED',
  phoneRequired: 'PHONE_VERIFICATION_REQUIRED', pending: 'MERCHANT_PENDING_APPROVAL', suspended: 'MERCHANT_SUSPENDED',
  rejected: 'MERCHANT_REJECTED', roleForbidden: 'MERCHANT_ROLE_FORBIDDEN', accessRevoked: 'MERCHANT_ACCESS_REVOKED',
  notFound: 'MERCHANT_NOT_FOUND', alreadyRegistered: 'MERCHANT_ALREADY_REGISTERED', businessIdInUse: 'BUSINESS_ID_IN_USE',
  alreadyWon: 'ALREADY_WON', slugUnavailable: 'SLUG_UNAVAILABLE', rateLimited: 'AUTH_RATE_LIMITED',
} as const;

// ── Support & public links (override per build through env) ───────────────────
export const SUPPORT = {
  email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || '',
  phone: process.env.EXPO_PUBLIC_SUPPORT_PHONE?.trim() || '',
  siteUrl: (process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim() || '').replace(/\/+$/, ''),
  ifscLookupUrl: process.env.EXPO_PUBLIC_IFSC_LOOKUP_URL?.trim() || 'https://ifsc.razorpay.com',
} as const;
