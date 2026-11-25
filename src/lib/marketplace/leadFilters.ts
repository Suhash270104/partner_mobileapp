import { merchantApi } from './api';
import { LIMITS } from './constants';
import type { Lead } from './types';

export type DateField = 'createdAt' | 'requiredBy';
export const MAX_FILTERED_PAGES = 6;

/** Every lead for a status (up to the page cap), so search and date filters do not miss older enquiries. */
export async function fetchLeadsForFiltering(status: string): Promise<{ items: Lead[]; truncated: boolean }> {
  const items: Lead[] = [];
  for (let page = 1; page <= MAX_FILTERED_PAGES; page += 1) {
    const result = await merchantApi.leads({ status: status || undefined, page, limit: LIMITS.listMaxPageSize });
    items.push(...result.items);
    const total = result.pagination?.total;
    const done = !result.items.length || (total != null ? items.length >= total : result.items.length < LIMITS.listMaxPageSize);
    if (done) return { items, truncated: false };
  }
  return { items, truncated: true };
}

export function matchesSearch(lead: Lead, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [lead.buyerName, lead.buyerPhone, lead.productId?.title, lead.requirementTitle, lead.deliveryLocation]
    .some(value => String(value ?? '').toLowerCase().includes(needle));
}

/** The calendar day as YYYY-MM-DD. A date with no real time keeps its written day; a timestamp uses the phone's local day. */
function dayOf(value: string | undefined) {
  if (!value) return '';
  const dateOnly = /^(\d{4}-\d{2}-\d{2})(T00:00:00(\.000)?Z)?$/.exec(value);
  if (dateOnly) return dateOnly[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Both ends are inclusive. A lead without the chosen date is left out once a date is set. */
export function matchesDateRange(lead: Lead, field: DateField, from: string, to: string) {
  if (!from && !to) return true;
  const day = dayOf(lead[field]);
  return !!day && (!from || day >= from) && (!to || day <= to);
}
