import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_COUNTRY, DEFAULT_HOURS, LIMITS } from './constants';
import * as v from './validation';
import type { FieldErrors } from './validation';
import type { Json } from './types';

export const REGISTRATION_STEPS = ['Store', 'Contact', 'Categories', 'Payout'] as const;
export type RegistrationStep = 0 | 1 | 2 | 3;

export interface RegistrationForm {
  storeName: string; businessName: string; businessId: string; businessType: string; legalStatus: string; yearEstablished: string;
  employeeCount: string; ordersFulfilled: string; annualTurnover: string; iecCode: string; description: string;
  phone: string; whatsappNumber: string; sameAsPhone: boolean; email: string;
  streetAddress: string; locality: string; city: string; state: string; pinCode: string;
  businessCategories: string[]; capabilities: string[]; serviceAreas: string; certifications: string;
  openTime: string; closeTime: string; isOpenSundays: boolean;
  accountNumber: string; confirmAccountNumber: string; ifscCode: string; bankName: string; beneficiaryName: string; consent: boolean;
}

export const blankRegistration = (defaults: Partial<RegistrationForm> = {}): RegistrationForm => ({
  storeName: '', businessName: '', businessId: '', businessType: '', legalStatus: '', yearEstablished: '', employeeCount: '', ordersFulfilled: '',
  annualTurnover: '', iecCode: '', description: '', phone: '', whatsappNumber: '', sameAsPhone: true, email: '',
  streetAddress: '', locality: '', city: '', state: '', pinCode: '', businessCategories: [], capabilities: [], serviceAreas: '', certifications: '',
  openTime: DEFAULT_HOURS.openTime, closeTime: DEFAULT_HOURS.closeTime, isOpenSundays: DEFAULT_HOURS.isOpenSundays,
  accountNumber: '', confirmAccountNumber: '', ifscCode: '', bankName: '', beneficiaryName: '', consent: false, ...defaults,
});

const pick = (value: string, label: string) => (value ? undefined : `Select ${label}.`);

/** Validates one wizard step. Returns an empty object when the step can continue. */
export function validateRegistrationStep(step: RegistrationStep, f: RegistrationForm): FieldErrors {
  if (step === 0) {
    return v.compact({
      storeName: v.lengthBetween(f.storeName, 'Store name', LIMITS.storeName.min, LIMITS.storeName.max),
      businessName: v.lengthBetween(f.businessName, 'Legal business name', LIMITS.businessName.min, LIMITS.businessName.max),
      businessId: v.businessId(f.businessId),
      businessType: pick(f.businessType, 'the nature of your business'),
      legalStatus: pick(f.legalStatus, 'your legal status'),
      yearEstablished: v.year(f.yearEstablished),
      employeeCount: pick(f.employeeCount, 'your team size'),
      ordersFulfilled: pick(f.ordersFulfilled, 'orders supplied so far'),
      iecCode: v.iecCode(f.iecCode),
      description: f.description.length > LIMITS.description ? `Keep this under ${LIMITS.description} characters.` : undefined,
    });
  }
  if (step === 1) {
    return v.compact({
      phone: v.indianMobile(f.phone),
      whatsappNumber: f.sameAsPhone ? undefined : v.indianMobile(f.whatsappNumber, 'WhatsApp number'),
      email: v.optionalEmail(f.email),
      streetAddress: v.lengthBetween(f.streetAddress, 'Street address', LIMITS.address.min, LIMITS.address.max),
      locality: f.locality.length > LIMITS.locality ? `Keep this under ${LIMITS.locality} characters.` : undefined,
      city: v.lengthBetween(f.city, 'City', LIMITS.city.min, LIMITS.city.max),
      state: pick(f.state, 'your state'),
      pinCode: v.pinCode(f.pinCode),
    });
  }
  if (step === 2) {
    return v.compact({
      businessCategories: f.businessCategories.length ? undefined : 'Choose at least one category.',
      serviceAreas: v.listItems(v.splitList(f.serviceAreas), 'Service areas', LIMITS.serviceAreas.items, LIMITS.serviceAreas.length),
      certifications: v.listItems(v.splitList(f.certifications), 'Certifications', LIMITS.certifications.items, LIMITS.certifications.length),
      closeTime: v.hours(f.openTime, f.closeTime),
    });
  }
  return v.compact({
    accountNumber: v.accountNumber(f.accountNumber),
    confirmAccountNumber: f.confirmAccountNumber === f.accountNumber ? undefined : 'Account numbers do not match.',
    ifscCode: v.ifsc(f.ifscCode),
    bankName: v.lengthBetween(f.bankName, 'Bank name', LIMITS.bankName.min, LIMITS.bankName.max),
    beneficiaryName: v.lengthBetween(f.beneficiaryName, 'Account holder name', LIMITS.beneficiary.min, LIMITS.beneficiary.max),
    consent: f.consent ? undefined : 'Please accept the terms to continue.',
  });
}

/** Builds the POST /auth/register body. Optional keys are omitted when empty (the server rejects empty strings for some). */
export function buildRegistrationPayload(f: RegistrationForm): Json {
  const phone = v.nationalPhone(f.phone);
  const payload: Json = {
    storeName: f.storeName.trim(), businessName: f.businessName.trim(), businessId: v.normalizeBusinessId(f.businessId),
    phone, whatsappNumber: f.sameAsPhone ? phone : v.nationalPhone(f.whatsappNumber),
    address: { streetAddress: f.streetAddress.trim(), city: f.city.trim(), state: f.state, pinCode: f.pinCode.trim(), country: DEFAULT_COUNTRY },
    businessCategories: f.businessCategories, businessType: f.businessType, legalStatus: f.legalStatus, yearEstablished: Number(f.yearEstablished),
    employeeCount: f.employeeCount, ordersFulfilled: f.ordersFulfilled, capabilities: f.capabilities,
    serviceAreas: v.splitList(f.serviceAreas), certifications: v.splitList(f.certifications),
    operatingHours: { openTime: f.openTime, closeTime: f.closeTime, isOpenSundays: f.isOpenSundays },
    bankDetails: { accountNumber: f.accountNumber.trim(), ifscCode: f.ifscCode.trim().toUpperCase(), beneficiaryName: f.beneficiaryName.trim(), bankName: f.bankName.trim() },
  };
  if (f.description.trim()) payload.description = f.description.trim();
  if (f.email.trim()) payload.email = f.email.trim();
  if (f.annualTurnover) payload.annualTurnover = f.annualTurnover;
  if (f.iecCode.trim()) payload.iecCode = f.iecCode.trim().toUpperCase();
  if (f.locality.trim()) payload.address.locality = f.locality.trim();
  return payload;
}

/** Which wizard step owns a server field path (hand-off §4.5), so a 400 can jump back to the right place. */
export function stepForField(path: string): RegistrationStep {
  const root = path.split('.')[0];
  if (root === 'bankDetails') return 3;
  if (['businessCategories', 'operatingHours', 'capabilities', 'serviceAreas', 'certifications'].includes(root)) return 2;
  if (['phone', 'whatsappNumber', 'email', 'address'].includes(root)) return 1;
  return 0;
}

/** Server paths such as "address.pinCode" or "bankDetails.ifscCode" back to the flat form keys used by the screens. */
export function formKeyForField(path: string): string {
  const tail = path.split('.').pop() ?? path;
  return ({ streetAddress: 'streetAddress', pinCode: 'pinCode', ifscCode: 'ifscCode' } as Record<string, string>)[tail] ?? tail;
}

// ── Draft: survives app restarts and the sign-in detour; never stores bank account numbers or the consent tick ──
const DRAFT_KEY = 'marketplace.registration.draft.v1';
type Draft = Omit<RegistrationForm, 'accountNumber' | 'confirmAccountNumber' | 'consent'> & { step: number };

export async function saveRegistrationDraft(form: RegistrationForm, step: number) {
  const { accountNumber: _a, confirmAccountNumber: _c, consent: _k, ...safe } = form;
  try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ ...safe, step })); } catch { /* a draft is a convenience only */ }
}

export async function loadRegistrationDraft(): Promise<{ form: RegistrationForm; step: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { step, ...rest } = JSON.parse(raw) as Draft;
    return { form: blankRegistration(rest), step: Math.min(3, Math.max(0, Number(step) || 0)) };
  } catch { return null; }
}

export const clearRegistrationDraft = () => AsyncStorage.removeItem(DRAFT_KEY).catch(() => undefined);
