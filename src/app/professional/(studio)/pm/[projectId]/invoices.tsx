import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Actions, Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, rupees, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Chips, Empty, HeaderAction, Muted, Pill, PmScreen, Tone, inr, pm, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi, type Invoice, type InvoiceInput, type Party } from '../../../../../lib/pm/records';

const STATUS: Record<Invoice['status'], { label: string; tone: Tone }> = { draft: { label: 'Draft', tone: 'gray' }, issued: { label: 'Issued', tone: 'blue' }, paid: { label: 'Paid', tone: 'ok' }, cancelled: { label: 'Cancelled', tone: 'bad' } };
const TAX_MODES = [{ key: 'intra', label: 'CGST + SGST' }, { key: 'inter', label: 'IGST' }, { key: 'none', label: 'No GST' }] as const;

// GST invoices. The server works out every tax figure; this screen only collects the lines. Issued invoices are locked:
// fix a mistake by cancelling and copying it into a new draft.
export default function InvoicesScreen() {
  const m = usePmModule(id => recordsApi.invoices(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);
  const manage = can(m.role, 'invoice.manage');
  const data = m.payload;
  const invoices = data?.invoices || [];

  return (
    <PmScreen title="Invoices" subtitle="GST invoices" right={manage ? <HeaderAction icon="plus" label="New invoice" onPress={() => setCreating(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {data && (
        <Card><View style={s.stats}>
          <Stat label="Issued" value={inr(data.summary.issuedPaise + data.summary.paidPaise)} />
          <Stat label="Paid" value={inr(data.summary.paidPaise)} color={pm.ok} />
          <Stat label="Outstanding" value={inr(data.summary.outstandingPaise)} color={data.summary.outstandingPaise ? pm.warn : undefined} />
        </View></Card>
      )}
      {data && invoices.length === 0 && <Empty title="No invoices yet" text={manage ? 'Create an invoice for a milestone or any work billed to the client.' : 'Invoices your studio issues appear here.'} />}
      {invoices.map(invoice => (
        <Card key={invoice._id}>
          <RowBetween><View style={{ flex: 1 }}><Title>{invoice.number}</Title><Muted>{[invoice.recipient?.name, invoice.issueDate ? shortDate(invoice.issueDate) : '', invoice.dueDate ? `due ${shortDate(invoice.dueDate)}` : ''].filter(Boolean).join(' · ')}</Muted></View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}><Title>{inr(invoice.totals.totalPaise)}</Title><Pill text={STATUS[invoice.status]?.label || invoice.status} tone={STATUS[invoice.status]?.tone} /></View></RowBetween>
          {invoice.lines.slice(0, 3).map((line, index) => <Muted key={index}>{line.description} · {line.quantity} × {inr(line.ratePaise)} · GST {line.gstRate}%</Muted>)}
          {invoice.lines.length > 3 && <Muted>+ {invoice.lines.length - 3} more line{invoice.lines.length - 3 === 1 ? '' : 's'}</Muted>}
          {!!invoice.totals.taxPaise && <Muted>Includes tax of {inr(invoice.totals.taxPaise)}</Muted>}
          {invoice.status === 'cancelled' && !!invoice.cancelReason && <Body>Cancelled: {invoice.cancelReason}</Body>}
          {manage && (
            <Actions>
              {invoice.status === 'draft' && <View style={{ flex: 1 }}><Btn small kind="green" label="Issue" busy={busyId === invoice._id} onPress={() => confirmAction('Issue this invoice?', 'It is numbered and locked. Corrections need a cancellation and a new invoice.', 'Issue', () => void run(invoice._id, () => recordsApi.issueInvoice(m.id, invoice._id), 'Could not issue this invoice.'), false)} /></View>}
              {invoice.status === 'issued' && <View style={{ flex: 1 }}><Btn small kind="green" label="Mark paid" busy={busyId === invoice._id} onPress={() => void run(invoice._id, () => recordsApi.payInvoice(m.id, invoice._id), 'Could not mark this invoice paid.')} /></View>}
              {invoice.status === 'issued' && <View style={{ flex: 1 }}><Btn small kind="danger" label="Cancel" disabled={!!busyId} onPress={() => setCancelling(invoice)} /></View>}
              {invoice.status === 'draft' && <View style={{ flex: 1 }}><Btn small kind="danger" label="Delete" busy={busyId === `d${invoice._id}`} onPress={() => confirmAction('Delete this draft?', invoice.number, 'Delete', () => void run(`d${invoice._id}`, () => recordsApi.deleteInvoice(m.id, invoice._id), 'Could not delete this draft.'))} /></View>}
              {(invoice.status === 'cancelled' || invoice.status === 'paid' || invoice.status === 'issued') && <View style={{ flex: 1 }}><Btn small kind="ghost" label="Copy as new" busy={busyId === `c${invoice._id}`} onPress={() => void run(`c${invoice._id}`, () => recordsApi.duplicateInvoice(m.id, invoice._id), 'Could not copy this invoice.')} /></View>}
            </Actions>
          )}
        </Card>
      ))}
      <CreateSheet visible={creating} defaults={data?.defaults} onClose={() => setCreating(false)} submit={async body => { await recordsApi.addInvoice(m.id, body); setCreating(false); await m.silentReload(); }} />
      <CancelSheet invoice={cancelling} onClose={() => setCancelling(null)} submit={async reason => { await recordsApi.cancelInvoice(m.id, cancelling!._id, reason); setCancelling(null); await m.silentReload(); }} />
    </PmScreen>
  );
}

function CancelSheet({ invoice, onClose, submit }: { invoice: Invoice | null; onClose: () => void; submit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  return (
    <FormSheet visible={!!invoice} title={invoice?.number || ''} eyebrow="CANCEL INVOICE" submitLabel="Cancel invoice" kind="danger" onClose={onClose} submit={async () => {
      if (reason.trim().length < 3) return 'Give a reason for the cancellation.';
      await submit(reason.trim()); setReason('');
    }}>
      <Field label="Reason" value={reason} onChangeText={setReason} multiline maxLength={300} />
    </FormSheet>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <View style={{ flex: 1, gap: 1 }}><Muted>{label}</Muted><Title>{value}</Title>{color ? <View style={{ height: 2, backgroundColor: color, borderRadius: 1, width: 24 }} /> : null}</View>;
}

interface LineDraft { description: string; hsnSac: string; quantity: string; rate: string; gstRate: string }
const emptyLine = (): LineDraft => ({ description: '', hsnSac: '', quantity: '1', rate: '', gstRate: '18' });

function CreateSheet({ visible, defaults, onClose, submit }: { visible: boolean; defaults?: { number: string; supplier: Party; recipient: Party }; onClose: () => void; submit: (b: InvoiceInput) => Promise<void> }) {
  const [number, setNumber] = useState(''); const [supplierName, setSupplierName] = useState(''); const [supplierGstin, setSupplierGstin] = useState('');
  const [recipientName, setRecipientName] = useState(''); const [recipientGstin, setRecipientGstin] = useState(''); const [taxMode, setTaxMode] = useState<'intra' | 'inter' | 'none'>('intra');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]); const [discount, setDiscount] = useState(''); const [notes, setNotes] = useState('');
  const [seeded, setSeeded] = useState(false);

  // Start from what the server knows: next invoice number, the studio's billing details and the client.
  if (visible && !seeded) {
    setSeeded(true); setNumber(defaults?.number || ''); setSupplierName(defaults?.supplier?.name || ''); setSupplierGstin(defaults?.supplier?.gstin || '');
    setRecipientName(defaults?.recipient?.name || ''); setRecipientGstin(defaults?.recipient?.gstin || ''); setLines([emptyLine()]); setDiscount(''); setNotes('');
  }
  if (!visible && seeded) setSeeded(false);
  const patch = (index: number, change: Partial<LineDraft>) => setLines(prev => prev.map((line, i) => (i === index ? { ...line, ...change } : line)));

  return (
    <FormSheet visible={visible} title="New invoice" eyebrow="GST INVOICE" submitLabel="Save as draft" onClose={onClose} submit={async () => {
      if (!recipientName.trim()) return 'Enter who the invoice is for.';
      const parsed: InvoiceInput['lines'] = [];
      for (const [index, line] of lines.entries()) {
        if (!line.description.trim() && !line.rate.trim()) continue;
        const quantity = Number(line.quantity); const rate = rupees(line.rate); const gst = Number(line.gstRate);
        if (!line.description.trim()) return `Describe line ${index + 1}.`;
        if (!Number.isFinite(quantity) || quantity <= 0) return `Line ${index + 1}: quantity must be more than zero.`;
        if (rate === undefined || rate < 0) return `Line ${index + 1}: enter the rate in rupees.`;
        if (!Number.isFinite(gst) || gst < 0 || gst > 100) return `Line ${index + 1}: GST must be between 0 and 100.`;
        parsed.push({ description: line.description.trim(), quantity, rate, gstRate: taxMode === 'none' ? 0 : gst, ...(line.hsnSac.trim() ? { hsnSac: line.hsnSac.trim() } : {}) });
      }
      if (parsed.length === 0) return 'Add at least one line.';
      const off = discount.trim() ? rupees(discount) : undefined;
      if (discount.trim() && (off === undefined || off < 0)) return 'Enter the discount in rupees.';
      await submit({ ...(number.trim() ? { number: number.trim() } : {}), taxMode, lines: parsed, ...(off ? { discount: off } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
        supplier: { name: supplierName.trim(), gstin: supplierGstin.trim() }, recipient: { name: recipientName.trim(), gstin: recipientGstin.trim() } });
    }}>
      <Field label="Invoice number" value={number} onChangeText={setNumber} maxLength={40} />
      <FieldLabel>Billed by</FieldLabel>
      <Field value={supplierName} onChangeText={setSupplierName} placeholder="Your studio's legal name" maxLength={160} />
      <Field value={supplierGstin} onChangeText={setSupplierGstin} placeholder="Your GSTIN (optional)" autoCapitalize="characters" maxLength={15} />
      <FieldLabel>Billed to</FieldLabel>
      <Field value={recipientName} onChangeText={setRecipientName} placeholder="Client name" maxLength={160} />
      <Field value={recipientGstin} onChangeText={setRecipientGstin} placeholder="Client GSTIN (optional)" autoCapitalize="characters" maxLength={15} />
      <FieldLabel>Tax</FieldLabel>
      <Chips value={taxMode} onChange={setTaxMode} options={TAX_MODES.map(mode => ({ key: mode.key, label: mode.label }))} />
      <FieldLabel>Lines</FieldLabel>
      {lines.map((line, index) => (
        <View key={index} style={s.line}>
          <Field value={line.description} onChangeText={value => patch(index, { description: value })} placeholder="Description" maxLength={300} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field value={line.quantity} onChangeText={value => patch(index, { quantity: value })} placeholder="Qty" keyboardType="decimal-pad" /></View>
            <View style={{ flex: 2 }}><Field value={line.rate} onChangeText={value => patch(index, { rate: value })} placeholder="Rate (₹)" keyboardType="decimal-pad" /></View>
            {taxMode !== 'none' && <View style={{ flex: 1 }}><Field value={line.gstRate} onChangeText={value => patch(index, { gstRate: value })} placeholder="GST %" keyboardType="decimal-pad" /></View>}
          </View>
          <Field value={line.hsnSac} onChangeText={value => patch(index, { hsnSac: value })} placeholder="HSN / SAC (optional)" maxLength={12} />
        </View>
      ))}
      <Btn small kind="ghost" label="Add another line" onPress={() => setLines(prev => [...prev, emptyLine()])} />
      <Field label="Discount in ₹ (optional)" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <Muted>Tax and totals are worked out by the server when you save.</Muted>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10 },
  line: { gap: 4, padding: 8, borderRadius: 11, borderWidth: 1, borderColor: pm.line },
});
