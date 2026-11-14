import { useState } from 'react';
import { View } from 'react-native';
import { useFormState } from '../../../hooks/useFormState';
import { LIMITS } from '../../../lib/marketplace/constants';
import { errorMessage, isAlreadyWon, parseFieldErrors } from '../../../lib/marketplace/errors';
import { formatMoney } from '../../../lib/marketplace/format';
import { QuotationForm, quotationDefaults, quotationPayload, quotationTotal, validateQuotation } from '../../../lib/marketplace/quotationForm';
import { firstError } from '../../../lib/marketplace/validation';
import type { Json, Lead } from '../../../lib/marketplace/types';
import { BottomSheet, FormField, PillButton, Text, ToggleRow, palette } from '../../ui';

function QuotationFormBody({ lead, onClose, onSend }: { lead: Lead; onClose: () => void; onSend: (payload: Json) => Promise<void> }) {
  // Starts from the buyer's quantity and unit; the body remounts each time the sheet opens.
  const { form, setErrors, errors, set } = useFormState<QuotationForm>(() => quotationDefaults(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = quotationTotal(form);
  const send = async () => {
    const found = validateQuotation(form);
    setErrors(found);
    if (Object.keys(found).length) { setError(firstError(found) ?? ''); return; }
    setBusy(true); setError('');
    try { await onSend(quotationPayload(form)); onClose(); }
    catch (cause) {
      const fields = parseFieldErrors(cause);
      if (Object.keys(fields).length) setErrors(fields);
      setError(isAlreadyWon(cause) ? 'The buyer has already accepted a quotation for this enquiry.' : errorMessage(cause, 'Could not send the quotation.'));
    } finally { setBusy(false); }
  };

  const money = (key: 'unitPrice' | 'deliveryCharges') => (v: string) => set(key, v.replace(/[^\d.]/g, ''));
  return <View style={{ gap: 14 }}>
    <FormField label="Price per unit" required prefix="₹" value={form.unitPrice} onChangeText={money('unitPrice')} keyboardType="decimal-pad" error={errors.unitPrice} />
    <FormField label="Unit (e.g. sq ft, bag)" value={form.priceUnit} onChangeText={v => set('priceUnit', v)} />
    <FormField label="Quantity" value={form.quantity} onChangeText={v => set('quantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" error={errors.quantity} />
    {total !== undefined ? <View style={{ padding: 12, borderRadius: 14, backgroundColor: palette.greenSoft }}><Text style={{ color: palette.greenText, fontSize: 13, fontWeight: '800' }}>Total {formatMoney(total)}</Text></View> : null}
    <ToggleRow label="Price includes GST" value={form.gstIncluded} onChange={v => set('gstIncluded', v)} />
    <FormField label="GST %" value={form.gstPercentage} onChangeText={v => set('gstPercentage', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" error={errors.gstPercentage} />
    <FormField label="Delivery charges (optional)" prefix="₹" value={form.deliveryCharges} onChangeText={money('deliveryCharges')} keyboardType="decimal-pad" error={errors.deliveryCharges} />
    <FormField label="Delivery time (days)" value={form.deliveryDays} onChangeText={v => set('deliveryDays', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={3} error={errors.deliveryDays} />
    <FormField label="Quote valid until" value={form.validUntil} onChangeText={v => set('validUntil', v)} placeholder="YYYY-MM-DD" keyboardType="default" error={errors.validUntil} />
    <FormField label="Payment terms" value={form.paymentTerms} onChangeText={v => set('paymentTerms', v)} maxLength={LIMITS.quotePaymentTerms} error={errors.paymentTerms} placeholder="e.g. 50% advance, 50% on delivery" />
    <FormField label="Notes to buyer" value={form.notes} onChangeText={v => set('notes', v)} multiline maxLength={LIMITS.quoteNotes} error={errors.notes} />
    {error ? <Text style={{ color: palette.red, fontSize: 13, fontWeight: '700' }}>{error}</Text> : null}
    <PillButton title="Send to buyer" icon="send" loading={busy} onPress={() => void send()} />
  </View>;
}

/** Send (or revise) a quotation. The total is calculated from unit price × quantity as the server does. */
export function QuotationFormSheet({ visible, lead, revising, onClose, onSend }: { visible: boolean; lead: Lead; revising: boolean; onClose: () => void; onSend: (payload: Json) => Promise<void> }) {
  return <BottomSheet visible={visible} onClose={onClose} tall title={revising ? 'Send revised quotation' : 'Send quotation'}>{visible ? <QuotationFormBody lead={lead} onClose={onClose} onSend={onSend} /> : null}</BottomSheet>;
}
