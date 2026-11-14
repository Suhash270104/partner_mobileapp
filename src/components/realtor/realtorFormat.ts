// Formatting + status rules shared by the realtor workspace. Rules come from the hand-off doc (sections 7, 8, 11).
export type Data = Record<string, any>;
export type StatusTone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'slate';

export function humanize(value: unknown) {
  const text = String(value ?? '').replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/** ₹1.45 Cr / ₹85 L / ₹45,000 — the compact price the website shows on property cards. */
export function formatPriceShort(value: unknown) {
  const amount = Number(value);
  if (value == null || value === '' || !Number.isFinite(amount) || amount <= 0) return '';
  const trim = (n: number) => String(Number(n.toFixed(2)));
  if (amount >= 1e7) return `₹${trim(amount / 1e7)} Cr`;
  if (amount >= 1e5) return `₹${trim(amount / 1e5)} L`;
  try { return `₹${amount.toLocaleString('en-IN')}`; } catch { return `₹${amount}`; }
}

export const priceOf = (property: Data) => property.listingPurpose === 'rent' || (!property.price && property.monthlyRent)
  ? (formatPriceShort(property.monthlyRent) ? `${formatPriceShort(property.monthlyRent)}/mo` : '')
  : formatPriceShort(property.price);

export function timeAgo(value: unknown) {
  const time = new Date(String(value || '')).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const EDITABLE_STATUSES = ['draft', 'changes_requested'];
export const LIVE_STATUS = 'published';

export function statusMeta(status: unknown): { label: string; tone: StatusTone; icon: string } {
  switch (String(status || 'draft')) {
    case 'published': return { label: 'Live on marketplace', tone: 'green', icon: 'check' };
    case 'pending_review': return { label: 'Pending review', tone: 'amber', icon: 'clock' };
    case 'under_review': return { label: 'Under review', tone: 'amber', icon: 'clock' };
    case 'changes_requested': return { label: 'Changes requested', tone: 'red', icon: 'fileText' };
    case 'rejected': return { label: 'Rejected', tone: 'red', icon: 'x' };
    case 'paused': return { label: 'Paused', tone: 'slate', icon: 'clock' };
    case 'sold': return { label: 'Sold', tone: 'violet', icon: 'check' };
    case 'rented': return { label: 'Rented', tone: 'violet', icon: 'check' };
    case 'expired': return { label: 'Expired', tone: 'slate', icon: 'clock' };
    case 'archived': return { label: 'Archived', tone: 'slate', icon: 'layers' };
    default: return { label: 'Draft (unpublished)', tone: 'slate', icon: 'fileText' };
  }
}

export const LEAD_STATUS_OPTIONS = ['unlocked', 'contacted', 'site_visit_scheduled', 'negotiating', 'closed_won', 'closed_lost'];
export function leadTone(status: unknown): StatusTone {
  switch (String(status)) {
    case 'unlocked': return 'blue';
    case 'contacted': case 'site_visit_scheduled': return 'amber';
    case 'negotiating': return 'violet';
    case 'closed_won': return 'green';
    case 'closed_lost': return 'red';
    default: return 'slate';
  }
}

export function locationLine(item: Data) {
  const loc: Data = item.location && typeof item.location === 'object' ? item.location : {};
  return [loc.locality || item.locality, loc.city || item.city].filter(Boolean).join(', ');
}

export function areaLine(property: Data) {
  const area = property.carpetArea || property.superBuiltUpArea || property.builtUpArea || property.plotArea;
  return area ? `${Number(area).toLocaleString('en-IN')} sqft` : '';
}

export const publicSite = () => process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || '';
export const liveListingUrl = (listingId: string) => { const base = publicSite(); return base && listingId ? `${base}/find-properties/listing/?id=${encodeURIComponent(listingId)}` : ''; };

/** Photo minimum enforced by the server when a listing is submitted for review (hand-off section 7). */
export function minPhotosFor(propertyType: string) {
  if (['apartment', 'villa', 'independent_house', 'farmhouse', 'pg'].includes(propertyType)) return 5;
  if (['commercial', 'office', 'shop', 'warehouse'].includes(propertyType)) return 3;
  return 1;
}
export const MAX_PHOTOS = 15;
