import { useMemo, useState } from 'react';
import { Alert as NativeAlert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Sheet } from '../../../../../components/studio/Sheet';
import {
  Alert, Bar, Btn, Card, Chips, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, SectionTitle, Tone, errorText, inr, isoFromField, pm, shortDate, todayField, usePmLoad,
} from '../../../../../components/pm/PmUi';
import { canSeeMoney, pmApi, type Milestone, type Payment } from '../../../../../lib/pm/api';

const MILESTONE: Record<string, { label: string; tone: Tone }> = {
  planned: { label: 'Planned', tone: 'gray' }, due: { label: 'Due', tone: 'warn' }, confirmed: { label: 'Paid', tone: 'ok' }, cancelled: { label: 'Cancelled', tone: 'gray' },
};
const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  client_marked: { label: 'Awaiting your confirmation', tone: 'warn' }, confirmed: { label: 'Confirmed', tone: 'ok' }, disputed: { label: 'Disputed', tone: 'bad' }, rejected: { label: 'Rejected', tone: 'gray' },
};
const METHODS = [{ key: 'bank_transfer', label: 'Bank transfer' }, { key: 'upi', label: 'UPI' }, { key: 'cheque', label: 'Cheque' }, { key: 'cash', label: 'Cash' }];
const newKey = () => `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Payments: milestones, what has been received and what still needs confirming. Payments stay record-only:
// the client marks "I paid", the studio confirms; nothing here moves money.
export default function MoneyScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = String(projectId || '');
  const { data, error, loading, refreshing, reload, silentReload } = usePmLoad(async () => {
    const overview = await pmApi.overview(id);
    return { role: overview.role, money: canSeeMoney(overview.role) ? await pmApi.money(id) : null };
  }, [id]);
  const [receiptFor, setReceiptFor] = useState<Milestone | null>(null);
  const [adding, setAdding] = useState(false);
  const [disputeFor, setDisputeFor] = useState<Payment | null>(null);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');

  const money = data?.money;
  const mayManage = data?.role === 'owner' || data?.role === 'manager' || data?.role === 'accounts';
  const waiting = useMemo(() => (money?.payments || []).filter(p => p.status === 'client_marked' || p.status === 'disputed'), [money]);
  const nameOf = (milestoneId: string) => money?.milestones.find(m => m._id === milestoneId)?.name || 'Milestone';

  async function run(key: string, work: () => Promise<unknown>, fallback: string) {
    setBusyId(key); setActionError('');
    try { await work(); await silentReload(); } catch (e) { setActionError(errorText(e, fallback)); } finally { setBusyId(''); }
  }
  const cancelMilestone = (m: Milestone) => NativeAlert.alert('Cancel this milestone?', `${m.name} (${inr(m.amountPaise)}) will be removed from the payment plan.`, [
    { text: 'Keep it', style: 'cancel' }, { text: 'Cancel milestone', style: 'destructive', onPress: () => void run(m._id, () => pmApi.cancelMilestone(id, m._id), 'Could not cancel this milestone.') },
  ]);

  const unscheduled = money ? money.contractValuePaise - money.summary.scheduledPaise : 0;

  return (
    <PmScreen title="Payments" subtitle="Milestones and receipts" right={mayManage ? <HeaderAction icon="plus" label="Add milestone" onPress={() => setAdding(true)} /> : undefined}
      loading={loading} error={error} refreshing={refreshing} onRefresh={() => void reload()}>
      {data && !money && <Alert tone="info" text="Your role on this project does not include payments." />}
      {!!actionError && <Alert tone="bad" text={actionError} />}

      {money && (
        <>
          <Card>
            <View style={s.grid}>
              <Stat label="Contract" value={inr(money.contractValuePaise)} />
              <Stat label="Received" value={inr(money.summary.receivedPaise)} color={pm.ok} />
              <Stat label="Due now" value={inr(money.summary.dueNowPaise)} color={money.summary.dueNowPaise ? pm.warn : undefined} />
              <Stat label="Overdue" value={inr(money.summary.overduePaise)} color={money.summary.overduePaise ? pm.bad : undefined} />
            </View>
            <Bar pct={money.contractValuePaise ? (money.summary.receivedPaise / money.contractValuePaise) * 100 : 0} />
            {money.summary.awaitingConfirmationPaise > 0 && <Muted>{inr(money.summary.awaitingConfirmationPaise)} marked as paid by the client, waiting for you to confirm.</Muted>}
            {money.contractValuePaise > 0 && unscheduled > 0 && <Muted>{inr(unscheduled)} of the contract is not scheduled in a milestone yet.</Muted>}
          </Card>

          {waiting.length > 0 && (
            <>
              <SectionTitle>Needs your attention</SectionTitle>
              {waiting.map(payment => (
                <Card key={payment._id}>
                  <View style={s.row}><Text style={s.name}>{nameOf(payment.milestoneId)}</Text><Text style={s.amount}>{inr(payment.amountPaise)}</Text></View>
                  <Muted>{[payment.method.replace(/_/g, ' '), payment.reference, payment.paidOn ? shortDate(payment.paidOn) : ''].filter(Boolean).join(' · ')}</Muted>
                  <Pill text={PAYMENT[payment.status]?.label || payment.status} tone={PAYMENT[payment.status]?.tone} />
                  {payment.status === 'disputed' && !!payment.disputeReason && <Muted>Reason: {payment.disputeReason}</Muted>}
                  {mayManage && (
                    <View style={s.actions}>
                      {payment.status === 'client_marked' && <><View style={{ flex: 1 }}><Btn small label="Confirm received" kind="green" busy={busyId === payment._id} onPress={() => void run(payment._id, () => pmApi.confirmPayment(id, payment._id), 'Could not confirm this payment.')} /></View>
                        <View style={{ flex: 1 }}><Btn small label="Dispute" kind="ghost" disabled={!!busyId} onPress={() => setDisputeFor(payment)} /></View></>}
                      {payment.status === 'disputed' && <><View style={{ flex: 1 }}><Btn small label="Confirm anyway" kind="green" busy={busyId === payment._id} onPress={() => void run(payment._id, () => pmApi.confirmPayment(id, payment._id), 'Could not confirm this payment.')} /></View>
                        <View style={{ flex: 1 }}><Btn small label="Reject" kind="danger" disabled={!!busyId} onPress={() => setDisputeFor(payment)} /></View></>}
                    </View>
                  )}
                </Card>
              ))}
            </>
          )}

          <SectionTitle>Milestones</SectionTitle>
          {money.milestones.length === 0 && <Empty title="No milestones yet" text="Add the payment milestones agreed with the client." />}
          {money.milestones.filter(m => m.status !== 'cancelled').map(m => (
            <Card key={m._id}>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Text style={s.name}>{m.name}</Text><Muted>{[m.percent ? `${m.percent}%` : '', m.dueDate ? `due ${shortDate(m.dueDate)}` : ''].filter(Boolean).join(' · ') || 'No due date'}</Muted></View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={s.amount}>{inr(m.amountPaise)}</Text>
                  <Pill text={m.isOverdue && m.status !== 'confirmed' ? 'Overdue' : MILESTONE[m.status]?.label || m.status} tone={m.isOverdue && m.status !== 'confirmed' ? 'bad' : MILESTONE[m.status]?.tone} /></View>
              </View>
              {m.status !== 'confirmed' && (m.receivedPaise > 0 || m.awaitingConfirmationPaise > 0) && (
                <Muted>Received {inr(m.receivedPaise)}{m.awaitingConfirmationPaise ? ` · ${inr(m.awaitingConfirmationPaise)} awaiting confirmation` : ''} · balance {inr(m.balancePaise)}</Muted>
              )}
              {mayManage && m.status !== 'confirmed' && (
                <View style={s.actions}>
                  <View style={{ flex: 1 }}><Btn small label="Record receipt" kind="ghost" disabled={!!busyId} onPress={() => setReceiptFor(m)} /></View>
                  {m.receivedPaise === 0 && m.awaitingConfirmationPaise === 0 && <View style={{ flex: 1 }}><Btn small label="Cancel" kind="danger" busy={busyId === m._id} onPress={() => cancelMilestone(m)} /></View>}
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      <ReceiptSheet id={id} milestone={receiptFor} onClose={() => setReceiptFor(null)} onSaved={() => { setReceiptFor(null); void silentReload(); }} />
      <MilestoneSheet id={id} visible={adding} unscheduledPaise={unscheduled} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void silentReload(); }} />
      <DisputeSheet id={id} payment={disputeFor} onClose={() => setDisputeFor(null)} onSaved={() => { setDisputeFor(null); void silentReload(); }} />
    </PmScreen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <View style={s.stat}><Muted>{label}</Muted><Text style={[s.statValue, color ? { color } : null]}>{value}</Text></View>;
}

function ReceiptSheet({ id, milestone, onClose, onSaved }: { id: string; milestone: Milestone | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(todayField());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seen, setSeen] = useState('');
  const [key, setKey] = useState(newKey); // one key per receipt: a retry after a bad connection must not record it twice

  if (milestone && milestone._id !== seen) { setSeen(milestone._id); setAmount(String(Math.max(0, milestone.balancePaise) / 100 || '')); setMethod('bank_transfer'); setReference(''); setPaidOn(todayField()); setNote(''); setError(''); setKey(newKey()); }
  if (!milestone && seen) setSeen('');

  async function save() {
    if (!milestone) return;
    const rupees = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(rupees) || rupees <= 0) { setError('Enter the amount received in rupees.'); return; }
    setBusy(true); setError('');
    try {
      await pmApi.recordPayment(id, milestone._id, key, { amount: rupees, method, ...(reference.trim() ? { reference: reference.trim() } : {}), ...(isoFromField(paidOn) ? { paidOn: isoFromField(paidOn) } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      onSaved();
    } catch (e) { setError(errorText(e, 'Could not record this receipt.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={!!milestone} title={milestone?.name || ''} eyebrow="RECORD RECEIPT" onClose={onClose} locked={busy}>
      <View style={{ gap: 10 }}>
        <Muted>Balance on this milestone: {inr(milestone?.balancePaise)}</Muted>
        <Field label="Amount received (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Text style={s.label}>How was it paid</Text>
        <Chips value={method} onChange={setMethod} options={METHODS} />
        <Field label="Reference / UTR (optional)" value={reference} onChangeText={setReference} maxLength={80} />
        <DateField label="Paid on" value={paidOn} onChange={setPaidOn} minDate={LONG_AGO} />
        <Field label="Note (optional)" value={note} onChangeText={setNote} maxLength={500} />
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label="Record receipt" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

function MilestoneSheet({ id, visible, unscheduledPaise, onClose, onSaved }: { id: string; visible: boolean; unscheduledPaise: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const rupees = Number(amount.replace(/,/g, ''));
    if (!name.trim()) { setError('Enter the milestone name.'); return; }
    if (!Number.isFinite(rupees) || rupees <= 0) { setError('Enter the milestone amount in rupees.'); return; }
    setBusy(true); setError('');
    try {
      await pmApi.addMilestone(id, { name: name.trim(), amount: rupees, ...(isoFromField(due) ? { dueDate: isoFromField(due) } : {}) });
      setName(''); setAmount(''); setDue('');
      onSaved();
    } catch (e) { setError(errorText(e, 'Could not add this milestone.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={visible} title="New milestone" eyebrow="PAYMENT PLAN" onClose={onClose} locked={busy}>
      <View style={{ gap: 10 }}>
        {unscheduledPaise > 0 && <Muted>{inr(unscheduledPaise)} of the contract is still unscheduled.</Muted>}
        <Field label="Name" value={name} onChangeText={setName} placeholder="Carpentry complete" maxLength={120} />
        <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <DateField label="Due date (optional)" value={due} onChange={setDue} minDate={LONG_AGO} placeholder="Optional" />
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label="Add milestone" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

// Disputing a client's "I paid" (or rejecting an already disputed one) always needs a reason the client can read.
function DisputeSheet({ id, payment, onClose, onSaved }: { id: string; payment: Payment | null; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rejecting = payment?.status === 'disputed';

  async function save() {
    if (!payment) return;
    if (!reason.trim()) { setError('Tell the client why.'); return; }
    setBusy(true); setError('');
    try {
      if (rejecting) await pmApi.rejectPayment(id, payment._id, reason.trim()); else await pmApi.disputePayment(id, payment._id, reason.trim());
      setReason('');
      onSaved();
    } catch (e) { setError(errorText(e, 'Could not update this payment.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={!!payment} title={rejecting ? 'Reject this payment' : 'Dispute this payment'} eyebrow={payment ? inr(payment.amountPaise) : ''} onClose={onClose} locked={busy}>
      <View style={{ gap: 10 }}>
        <Muted>{rejecting ? 'The payment will not count towards the milestone.' : 'Use this when the money has not reached you or the amount is wrong. The client sees your reason.'}</Muted>
        <Field label="Reason" value={reason} onChangeText={setReason} multiline maxLength={500} />
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label={rejecting ? 'Reject payment' : 'Dispute payment'} kind="danger" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  stat: { width: '50%', gap: 1 },
  statValue: { color: pm.ink, fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { color: pm.ink, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  amount: { color: pm.ink, fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  label: { color: pm.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
});
