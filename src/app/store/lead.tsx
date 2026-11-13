import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BooleanField, DataRow, Field, PageHeading, Panel, PrimaryButton, SectionTitle, SelectChips, StatePanel, StatusPill, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { InfoLine, Row, SellerFrame, fmtDate, humanize, money } from '../../components/vertical/SellerParts';
import { merchantApi } from '../../lib/partnerVerticalApi';

const empty = { unitPrice: '', priceUnit: '', quantity: '', gstPercentage: '', deliveryCharges: '', deliveryDays: '', validUntil: '', paymentTerms: '', notes: '' };
const num = (v: string) => (v.trim() === '' ? null : Number(v));
const qTone = (s: string) => (s === 'accepted' ? 'green' : s === 'declined' ? 'red' : s === 'superseded' ? 'amber' : 'blue') as 'green' | 'red' | 'amber' | 'blue';

export default function LeadDetail() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const initial = useMemo<Row | null>(() => { try { return data ? JSON.parse(String(data)) : null; } catch { return null; } }, [data]);
  const [lead, setLead] = useState<Row | null>(initial);
  const [form, setForm] = useState({ ...empty, quantity: initial?.quantity ? String(initial.quantity) : '' });
  const [gstIncluded, setGstIncluded] = useState(false);
  const [note, setNote] = useState(String(initial?.merchantNote || ''));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k: keyof typeof empty) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  if (!lead) return <SellerFrame title="Enquiry" activeTab="leads"><StatePanel title="Enquiry unavailable" message="Open this enquiry again from the Enquiries list." /></SellerFrame>;
  const id = String(lead._id || lead.id);
  const quotes: Row[] = Array.isArray(lead.quotations) ? [...lead.quotations].reverse() : [];

  const run = async (key: string, action: () => Promise<Record<string, any>>, ok?: string) => {
    setBusy(key); setError('');
    try { const res = await action(); if (res.lead) setLead(res.lead as Row); if (ok) setStatus(ok); }
    catch (e) { setError(e instanceof Error ? e.message : 'The server rejected this change.'); }
    finally { setBusy(''); }
  };
  const send = () => {
    const unitPrice = Number(form.unitPrice);
    if (!form.unitPrice.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) { Alert.alert('Unit price required', 'Enter a valid unit price.'); return; }
    const quantity = num(form.quantity);
    const validUntil = form.validUntil.trim() ? new Date(form.validUntil.trim()) : null;
    if (validUntil && Number.isNaN(validUntil.getTime())) { Alert.alert('Invalid date', 'Use a date like 2026-12-31 or 2026-12-31T18:00:00Z.'); return; }
    void run('quote', () => merchantApi.sendQuotation(id, {
      unitPrice, priceUnit: form.priceUnit.trim(), quantity, totalAmount: quantity != null ? Math.round(unitPrice * quantity * 100) / 100 : null,
      gstIncluded, gstPercentage: num(form.gstPercentage), deliveryCharges: num(form.deliveryCharges), deliveryDays: num(form.deliveryDays),
      validUntil: validUntil ? validUntil.toISOString() : null, paymentTerms: form.paymentTerms.trim(), notes: form.notes.trim(),
    }), 'Quotation sent to the buyer.');
  };
  const answers: Row[] = Array.isArray(lead.answers) ? lead.answers : [];
  return <SellerFrame title={String(lead.buyerName || 'Enquiry')} subtitle="Enquiry details" activeTab="leads">
    <PageHeading eyebrow="ENQUIRY" title={String(lead.productId?.title || lead.requirementTitle || 'Buyer enquiry')} subtitle={`Received ${fmtDate(lead.createdAt)}`} action={<StatusPill label={String(lead.status || 'new')} tone={lead.status === 'lost' ? 'red' : lead.status === 'new' ? 'amber' : 'green'} />} />
    {error ? <StatePanel title="Could not save" message={error} /> : null}
    {status ? <Panel tint><Text style={{ color: palette.green, fontWeight: '800' }}>{status}</Text></Panel> : null}
    <Panel tint>
      <Text style={{ color: palette.green, fontWeight: '800', fontSize: 15 }}>Buyer request</Text>
      <InfoLine label="Buyer" value={lead.buyerName} /><InfoLine label="Phone" value={lead.buyerPhone} /><InfoLine label="Email" value={lead.buyerEmail} />
      <InfoLine label="Quantity" value={lead.quantity ? `${lead.quantity}${lead.unit ? ` ${lead.unit}` : ''}` : ''} />
      <InfoLine label="Deliver to" value={lead.deliveryLocation} /><InfoLine label="Required by" value={lead.requiredBy ? fmtDate(lead.requiredBy) : ''} />
      {lead.requirements ? <Text style={{ color: palette.body, fontSize: 13, lineHeight: 19 }}>{lead.requirements}</Text> : null}
      {lead.message ? <Text style={{ color: palette.body, fontSize: 13, lineHeight: 19 }}>“{lead.message}”</Text> : null}
    </Panel>
    {answers.length ? <><SectionTitle title="Buyer answers" /><Panel>{answers.map((a, i) => <View key={i} style={{ gap: 2 }}><Text style={{ color: palette.muted, fontSize: 11 }}>{a.question}</Text><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 13 }}>{a.answer || '—'}</Text></View>)}</Panel></> : null}
    <SectionTitle title="Send a quotation" />
    <Panel>
      <Field label="Unit price (₹)" value={form.unitPrice} onChangeText={set('unitPrice')} keyboardType="decimal-pad" />
      <Field label="Price unit (e.g. per sq.ft, per bag)" value={form.priceUnit} onChangeText={set('priceUnit')} />
      <Field label="Quantity" value={form.quantity} onChangeText={set('quantity')} keyboardType="decimal-pad" helper="Total is calculated as unit price × quantity." />
      <BooleanField label="Price includes GST" value={gstIncluded} onChange={setGstIncluded} />
      <Field label="GST percentage" value={form.gstPercentage} onChangeText={set('gstPercentage')} keyboardType="decimal-pad" />
      <Field label="Delivery charges (₹, blank = included)" value={form.deliveryCharges} onChangeText={set('deliveryCharges')} keyboardType="decimal-pad" />
      <Field label="Delivery time (days)" value={form.deliveryDays} onChangeText={set('deliveryDays')} keyboardType="numeric" />
      <Field label="Quote valid until" value={form.validUntil} onChangeText={set('validUntil')} placeholder="2026-12-31" />
      <Field label="Payment terms" value={form.paymentTerms} onChangeText={set('paymentTerms')} />
      <Field label="Notes to buyer" value={form.notes} onChangeText={set('notes')} multiline />
      <PrimaryButton title={quotes.length ? 'Send revised quotation' : 'Send quotation'} loading={busy === 'quote'} onPress={send} />
    </Panel>
    <SectionTitle title={`Past quotations · ${quotes.length}`} />
    {quotes.length === 0 ? <Panel><Text style={{ color: palette.muted }}>No quotation sent yet.</Text></Panel> : quotes.map((q, i) => <Panel key={String(q._id || i)}>
      <DataRow title={`${money(q.unitPrice)}${q.priceUnit ? ` ${q.priceUnit}` : ''}`} detail={`Sent ${fmtDate(q.createdAt || q.sentAt)}`} trailing={<StatusPill label={String(q.status || 'sent')} tone={qTone(String(q.status))} />} />
      <InfoLine label="Quantity" value={q.quantity ?? ''} /><InfoLine label="Total" value={q.totalAmount != null ? money(q.totalAmount) : ''} />
      <InfoLine label="GST" value={q.gstPercentage != null ? `${q.gstPercentage}%${q.gstIncluded ? ' (included)' : ''}` : ''} />
      <InfoLine label="Delivery" value={[q.deliveryCharges != null ? money(q.deliveryCharges) : '', q.deliveryDays != null ? `${q.deliveryDays} days` : ''].filter(Boolean).join(' · ')} />
      <InfoLine label="Valid until" value={q.validUntil ? fmtDate(q.validUntil) : ''} /><InfoLine label="Payment terms" value={q.paymentTerms} />
      {q.notes ? <Text style={{ color: palette.body, fontSize: 12 }}>{q.notes}</Text> : null}
      {q.buyerResponseNote ? <Text style={{ color: palette.muted, fontSize: 12 }}>Buyer: {q.buyerResponseNote}</Text> : null}
    </Panel>)}
    <SectionTitle title="Status & private note" />
    <Panel>
      <SelectChips label="Enquiry status" values={['new', 'responded', 'quoted', 'won', 'lost', 'closed']} selected={String(lead.status || 'new')} onChange={v => void run('status', () => merchantApi.updateLead(id, { status: String(v) }), `Status set to ${humanize(String(v))}.`)} />
      <Field label="Private note (not shown to buyer)" value={note} onChangeText={setNote} multiline />
      <PrimaryButton title="Save note" loading={busy === 'note'} onPress={() => void run('note', () => merchantApi.updateLead(id, { merchantNote: note }), 'Note saved.')} />
    </Panel>
  </SellerFrame>;
}
