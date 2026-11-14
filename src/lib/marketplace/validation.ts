import { LIMITS } from './constants';

// Client-side mirrors of the server rules (hand-off §4, §8). They give instant feedback; the server stays the authority.
// Every function returns an error sentence, or undefined when the value is acceptable.

export type FieldErrors = Record<string, string>;
export const firstError = (errors: FieldErrors) => Object.values(errors)[0];

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const TRADE_LICENSE = /^[A-Z0-9/-]{5,30}$/;
const PIN = /^[1-9]\d{5}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const normalizeBusinessId = (value: string) => value.replace(/\s+/g, '').toUpperCase();
export const digitsOnly = (value: string) => value.replace(/\D/g, '');
/** Accepts "98765 43210", "+91 98765 43210" and "09876543210"; returns the 10 national digits. */
export const nationalPhone = (value: string) => { const d = digitsOnly(value); return d.length > 10 ? d.slice(-10) : d; };

export const required = (value: string, label: string) => (value.trim() ? undefined : `${label} is required.`);
export const lengthBetween = (value: string, label: string, min: number, max: number) => {
  const n = value.trim().length;
  if (!n) return `${label} is required.`;
  if (n < min) return `${label} must be at least ${min} characters.`;
  if (n > max) return `${label} must be at most ${max} characters.`;
  return undefined;
};

export function businessId(value: string): string | undefined {
  const id = normalizeBusinessId(value);
  if (!id) return 'Enter your GSTIN, business PAN or trade licence number.';
  if (GSTIN.test(id) || PAN.test(id)) return undefined;
  // A 10 or 15 character value is a mistyped PAN/GSTIN, so it is rejected instead of passing as a licence number.
  if (id.length === 10 || id.length === 15) return 'That looks like a PAN or GSTIN but the format is wrong. Check it and try again.';
  return TRADE_LICENSE.test(id) ? undefined : 'Must be a valid GSTIN, business PAN or trade licence number.';
}

export const indianMobile = (value: string, label = 'Phone') => (/^[6-9]\d{9}$/.test(nationalPhone(value)) ? undefined : `${label} must be a valid 10-digit Indian mobile number.`);
export const optionalEmail = (value: string) => (!value.trim() || EMAIL.test(value.trim()) ? undefined : 'Enter a valid email address.');
export const pinCode = (value: string) => (PIN.test(value.trim()) ? undefined : 'PIN code must be 6 digits and cannot start with 0.');
export const ifsc = (value: string) => (IFSC.test(value.trim().toUpperCase()) ? undefined : 'IFSC must be 11 characters, e.g. HDFC0001234.');
export const accountNumber = (value: string) => {
  const d = value.trim();
  if (!/^\d+$/.test(d)) return 'Account number must contain digits only.';
  return d.length < LIMITS.accountNumber.min || d.length > LIMITS.accountNumber.max ? `Account number must be ${LIMITS.accountNumber.min}–${LIMITS.accountNumber.max} digits.` : undefined;
};
export const year = (value: string) => {
  const n = Number(value);
  const now = new Date().getFullYear();
  return /^\d{4}$/.test(value.trim()) && n >= LIMITS.yearEstablished.min && n <= now ? undefined : `Enter a 4-digit year between ${LIMITS.yearEstablished.min} and ${now}.`;
};
export const iecCode = (value: string) => (!value.trim() || /^[A-Za-z0-9]{10}$/.test(value.trim()) ? undefined : 'Import Export Code must be 10 letters or digits.');
export const timeOfDay = (value: string, label: string) => (TIME.test(value) ? undefined : `${label} must be a time like 09:00.`);

export function hours(open: string, close: string): string | undefined {
  return timeOfDay(open, 'Opening time') || timeOfDay(close, 'Closing time') || (open === close ? 'Opening and closing time cannot be the same.' : undefined);
}

/** Splits "Mumbai, Pune" into clean, de-duplicated chips. */
export const splitList = (value: string) => [...new Set(value.split(/[,\n]/).map(item => item.trim()).filter(Boolean))];

export function listItems(items: string[], label: string, max: number, itemMax: number): string | undefined {
  if (items.length > max) return `${label}: at most ${max} entries.`;
  return items.some(item => item.length > itemMax) ? `${label}: each entry can be up to ${itemMax} characters.` : undefined;
}

/** Collapses a map of optional errors into only the entries that failed. */
export const compact = (errors: Record<string, string | undefined>): FieldErrors =>
  Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => !!entry[1]));

export const parseAmount = (value: string): number | undefined => {
  const text = value.replace(/[₹,\s]/g, '');
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};
