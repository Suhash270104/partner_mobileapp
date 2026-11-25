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
import { DatePickerField } from '../../realtor/DatePickerField';

// A quote dated today would already count as expired for the buyer, so the earliest choice is tomorrow.
const tomorrow = () => { const day = new Date(); day.setDate(day.getDate() + 1); day.setHours(0, 0, 0, 0); return day; };

type SheetProps = { visible: boolean; lead: Lead; revising: boolean; onClose: () => void; onSend: (payload: Json) => Promise<void> };

function QuotationSheetSession({ visible, lead, revising, onClose, onSend }: SheetProps) {
  // Starts from the buyer's quantity and unit; this remounts each time the sheet opens.
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
  return <BottomSheet visible={visible} onClose={onClose} tall title={revising ? 'Send revised quotation' : 'Send quotation'}
    footer={<View style={{ gap: 8 }}>
      {error ? <Text style={{ color: palette.red, fontSize: 12.5, fontWeight: '700' }}>{error}</Text> : null}
      <PillButton title="Send to buyer" icon="send" loading={busy} onPress={() => void send()} />
    </View>}>
    <View style={{ gap: 14 }}>
    <FormField label="Price per unit" required prefix="₹" value={form.unitPrice} onChangeText={money('unitPrice')} keyboardType="decimal-pad" error={errors.unitPrice} />
    <FormField label="Unit (e.g. sq ft, bag)" value={form.priceUnit} onChangeText={v => set('priceUnit', v)} />
    <FormField label="Quantity" value={form.quantity} onChangeText={v => set('quantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" error={errors.quantity} />
    {total !== undefined ? <View style={{ padding: 12, borderRadius: 14, backgroundColor: palette.greenSoft }}><Text style={{ color: palette.greenText, fontSize: 12.5, fontWeight: '800' }}>Total {formatMoney(total)}</Text></View> : null}
    <ToggleRow label="Price includes GST" value={form.gstIncluded} onChange={v => set('gstIncluded', v)} />
    <FormField label="GST %" value={form.gstPercentage} onChangeText={v => set('gstPercentage', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" error={errors.gstPercentage} />
    <FormField label="Delivery charges (optional)" prefix="₹" value={form.deliveryCharges} onChangeText={money('deliveryCharges')} keyboardType="decimal-pad" error={errors.deliveryCharges} />
    <FormField label="Delivery time (days)" value={form.deliveryDays} onChangeText={v => set('deliveryDays', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={3} error={errors.deliveryDays} />
    <DatePickerField label="Quote valid until" value={form.validUntil} onChange={v => set('validUntil', v)} placeholder="Select a date" minimumDate={tomorrow()} error={errors.validUntil} />
    <FormField label="Payment terms" value={form.paymentTerms} onChangeText={v => set('paymentTerms', v)} maxLength={LIMITS.quotePaymentTerms} error={errors.paymentTerms} placeholder="e.g. 50% advance, 50% on delivery" />
    <FormField label="Notes to buyer" value={form.notes} onChangeText={v => set('notes', v)} multiline maxLength={LIMITS.quoteNotes} error={errors.notes} />
    </View>
  </BottomSheet>;
}

/** Send (or revise) a quotation. The total is calculated from unit price × quantity as the server does. */
export function QuotationFormSheet(props: SheetProps) {
  // A new session each time the sheet opens clears the form; it stays mounted while closing so the sheet can slide away.
  const [session, setSession] = useState(0);
  const [wasVisible, setWasVisible] = useState(props.visible);
  if (props.visible !== wasVisible) { setWasVisible(props.visible); if (props.visible) setSession(session + 1); }
  return <QuotationSheetSession key={session} {...props} />;
}
