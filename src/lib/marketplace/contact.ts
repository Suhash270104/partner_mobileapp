import { nationalPhone } from './validation';

const COUNTRY_CODE = '91';

/** wa.me deep link for an Indian number in any common format, with an optional prefilled message. */
export function whatsappUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '');
  const full = digits.length > 10 ? digits : `${COUNTRY_CODE}${nationalPhone(digits)}`;
  return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
