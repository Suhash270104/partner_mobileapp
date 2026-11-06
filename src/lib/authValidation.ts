// Mirrors partner-app lib/authValidation.ts (and backend/utils/contactValidation.js, passwordPolicy.js).
// The server enforces all of it; this only saves a round trip.

export const EMAIL_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,63}$/;

export function isValidEmail(raw: string): boolean {
  const email = (raw || '').trim();
  if (email.length > 254 || !EMAIL_RE.test(email)) return false;
  const [local, domain] = email.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return domain.split('.').every(label => label.length <= 63 && !label.startsWith('-') && !label.endsWith('-'));
}

const EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com',
  'gmail.comm': 'gmail.com', 'gmail.cpm': 'gmail.com', 'gmail.vom': 'gmail.com', 'gmail.in': 'gmail.com',
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmali.com': 'gmail.com',
  'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'hotmail.con': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'outlook.con': 'outlook.com', 'outlok.com': 'outlook.com',
  'rediffmail.con': 'rediffmail.com', 'redifmail.com': 'rediffmail.com', 'icloud.con': 'icloud.com',
};

export function emailError(raw: string): string | null {
  const email = (raw || '').trim();
  if (!email) return 'Email address is required.';
  if (!isValidEmail(email)) return 'Enter a valid email address (e.g. name@example.com).';
  const at = email.lastIndexOf('@');
  const fix = EMAIL_DOMAIN_TYPOS[email.slice(at + 1).toLowerCase()];
  return fix ? `Did you mean ${email.slice(0, at)}@${fix}?` : null;
}

export const sanitizeEmailInput = (raw: string) => raw.replace(/\s/g, '').slice(0, 254);

const PHONE_RE = /^[6-9]\d{9}$/;
const REPEATED_DIGITS_RE = /^(\d)\1{9}$/;

export function sanitizePhoneInput(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export const isValidPhone = (raw: string) => {
  const digits = sanitizePhoneInput(raw);
  return PHONE_RE.test(digits) && !REPEATED_DIGITS_RE.test(digits);
};

export function phoneError(raw: string): string | null {
  const digits = sanitizePhoneInput(raw);
  if (!digits) return 'Mobile number is required.';
  if (digits.length < 10) return 'Mobile number must be 10 digits.';
  if (!PHONE_RE.test(digits)) return 'Enter a valid Indian mobile number starting with 6, 7, 8 or 9.';
  if (REPEATED_DIGITS_RE.test(digits)) return 'Enter a real mobile number.';
  return null;
}

export const PASSWORD_RULES: { key: string; label: string; test: (pw: string) => boolean }[] = [
  { key: 'length', label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: pw => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: pw => /[a-z]/.test(pw) },
  { key: 'digit', label: 'One number (0-9)', test: pw => /[0-9]/.test(pw) },
  { key: 'symbol', label: 'One special character (!@#$%...)', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

export const passwordOk = (pw: string) => PASSWORD_RULES.every(rule => rule.test(pw));
