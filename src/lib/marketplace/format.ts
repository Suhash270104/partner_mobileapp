import { STORE_TIME_ZONE } from './constants';
import type { OperatingHours, Tone } from './types';

export const humanize = (value: unknown): string => {
  const text = String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

export const formatMoney = (value: unknown, empty = '—'): string => {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return empty;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export const formatCompactMoney = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return formatMoney(n);
};

export const formatNumber = (value: unknown): string => { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('en-IN') : '—'; };

const parse = (value: unknown) => { const d = value ? new Date(String(value)) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
export const formatDate = (value: unknown): string => parse(value)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: STORE_TIME_ZONE }) ?? '—';
export const formatDateTime = (value: unknown): string => parse(value)?.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: STORE_TIME_ZONE }) ?? '—';

export function timeAgo(value: unknown, now = Date.now()): string {
  const d = parse(value);
  if (!d) return '';
  const minutes = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : formatDate(d);
}

/** YYYY-MM-DD in store time (IST), offset by whole days from today. */
export function isoDay(offsetDays = 0, now = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
}

/** "Open now" / "Closed now" from operating hours, evaluated in India time as the web app does. */
export function isOpenNow(hours: OperatingHours | undefined, now = new Date()): boolean | null {
  if (!hours?.openTime || !hours.closeTime) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: STORE_TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  if (get('weekday') === 'Sun' && !hours.isOpenSundays) return false;
  const current = Number(get('hour')) * 60 + Number(get('minute'));
  const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const open = toMinutes(hours.openTime), close = toMinutes(hours.closeTime);
  return open < close ? current >= open && current < close : current >= open || current < close;
}

export const toneForStatus = (status: unknown): Tone => {
  const s = String(status ?? '').toLowerCase();
  if (/reject|cancel|suspend|declin|lost|fail/.test(s)) return 'red';
  if (/pending|draft|requested|new|invited|superseded|low/.test(s)) return 'amber';
  if (/responded|quoted|sent|shipped|prepar|approved|scheduled|picked/.test(s)) return 'blue';
  return 'green';
};

export const initialsOf = (name: string, fallback = 'S') => name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || fallback;
export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || '';
export const maskAccount = (value: unknown) => { const t = String(value ?? ''); return t.length > 4 ? `••••${t.slice(-4)}` : t; };
export const unitSuffix = (unit?: string, label?: string) => (label?.trim() ? `per ${label.trim()}` : unit ? `per ${unit.replaceAll('_', ' ')}` : '');

/** Price line for product cards, covering all three price types. */
export function priceText(p: { priceType?: string; sellingPrice?: number; priceMax?: number; unit?: string; unitLabel?: string }): string {
  if (p.priceType === 'on_request') return 'Price on request';
  const unit = unitSuffix(p.unit, p.unitLabel);
  const base = p.priceType === 'range' && p.priceMax ? `${formatMoney(p.sellingPrice)} – ${formatMoney(p.priceMax)}` : formatMoney(p.sellingPrice);
  return unit ? `${base} ${unit}` : base;
}
