import { LIMITS } from './constants';
import * as v from './validation';
import type { FieldErrors } from './validation';
import type { Json, Lead } from './types';

export interface QuotationForm {
  unitPrice: string; priceUnit: string; quantity: string; gstIncluded: boolean; gstPercentage: string;
  deliveryCharges: string; deliveryDays: string; validUntil: string; paymentTerms: string; notes: string;
}

/** Pre-fills what the buyer already told us (quantity and unit) so the seller only types the price. */
export const quotationDefaults = (lead: Lead): QuotationForm => ({
  unitPrice: '', priceUnit: lead.unit ?? '', quantity: lead.quantity ? String(lead.quantity) : '', gstIncluded: false, gstPercentage: '18',
  deliveryCharges: '', deliveryDays: '', validUntil: '', paymentTerms: '', notes: '',
});

export const quotationTotal = (f: QuotationForm): number | undefined => {
  const price = v.parseAmount(f.unitPrice), qty = v.parseAmount(f.quantity);
  return price !== undefined && qty !== undefined ? Math.round(price * qty * 100) / 100 : undefined;
};

const isIsoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

export function validateQuotation(f: QuotationForm): FieldErrors {
  const price = v.parseAmount(f.unitPrice), gst = v.parseAmount(f.gstPercentage), charges = v.parseAmount(f.deliveryCharges);
  return v.compact({
    unitPrice: price === undefined || price <= 0 ? 'Enter the price per unit.' : undefined,
    quantity: f.quantity.trim() && (v.parseAmount(f.quantity) ?? -1) <= 0 ? 'Quantity must be more than 0.' : undefined,
    gstPercentage: f.gstPercentage.trim() && (gst === undefined || gst < 0 || gst > 28) ? 'GST must be between 0 and 28.' : undefined,
    deliveryCharges: f.deliveryCharges.trim() && (charges === undefined || charges < 0) ? 'Enter a valid amount.' : undefined,
    deliveryDays: f.deliveryDays.trim() && !/^\d{1,3}$/.test(f.deliveryDays.trim()) ? 'Enter whole days.' : undefined,
    validUntil: f.validUntil.trim() && !isIsoDay(f.validUntil.trim()) ? 'Use the format YYYY-MM-DD.' : undefined,
    paymentTerms: f.paymentTerms.length > LIMITS.quotePaymentTerms ? `Keep this under ${LIMITS.quotePaymentTerms} characters.` : undefined,
    notes: f.notes.length > LIMITS.quoteNotes ? `Keep this under ${LIMITS.quoteNotes} characters.` : undefined,
  });
}

export function quotationPayload(f: QuotationForm): Json {
  const out: Json = { unitPrice: v.parseAmount(f.unitPrice), gstIncluded: f.gstIncluded };
  const set = (key: string, value: unknown) => { if (value !== undefined && value !== '') out[key] = value; };
  set('priceUnit', f.priceUnit.trim()); set('quantity', v.parseAmount(f.quantity)); set('totalAmount', quotationTotal(f));
  set('gstPercentage', v.parseAmount(f.gstPercentage)); set('deliveryCharges', v.parseAmount(f.deliveryCharges));
  set('deliveryDays', v.parseAmount(f.deliveryDays)); set('validUntil', f.validUntil.trim()); set('paymentTerms', f.paymentTerms.trim()); set('notes', f.notes.trim());
  return out;
}
