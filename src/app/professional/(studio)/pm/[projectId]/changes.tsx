import { useState } from 'react';
import { Alert as NativeAlert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Sheet } from '../../../../../components/studio/Sheet';
import { Alert, Btn, Card, Chips, Empty, HeaderAction, Muted, Pill, PmScreen, Tone, errorText, inr, pm, shortDate, usePmLoad } from '../../../../../components/pm/PmUi';
import { canSeeMoney, pmApi, type ChangeRequest, type ChangeStatus } from '../../../../../lib/pm/api';

const STATUS: Record<ChangeStatus, { label: string; tone: Tone }> = {
  requested: { label: 'Needs your price', tone: 'warn' }, submitted: { label: 'Waiting for client', tone: 'blue' }, approved: { label: 'Approved', tone: 'ok' }, rejected: { label: 'Rejected', tone: 'bad' }, withdrawn: { label: 'Withdrawn', tone: 'gray' },
};
type Filter = 'open' | 'all';

// Change requests: anything that changes scope, cost or time after the contract. Nothing is billed until the client approves.
export default function ChangesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = String(projectId || '');
  const { data, error, loading, refreshing, reload, silentReload } = usePmLoad(async () => {
    const [list, overview] = await Promise.all([pmApi.changes(id), pmApi.overview(id)]);
    return { changes: list.changes || [], role: overview.role };
  }, [id]);
  const [filter, setFilter] = useState<Filter>('open');
  const [raising, setRaising] = useState(false);
  const [pricing, setPricing] = useState<ChangeRequest | null>(null);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');

  const money = canSeeMoney(data?.role);
  const all = (data?.changes || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const shown = all.filter(change => filter === 'all' || change.status === 'requested' || change.status === 'submitted');

  async function run(key: string, work: () => Promise<unknown>, fallback: string) {
    setBusyId(key); setActionError('');
    try { await work(); await silentReload(); } catch (e) { setActionError(errorText(e, fallback)); } finally { setBusyId(''); }
  }
  const confirmAction = (title: string, message: string, label: string, work: () => void) =>
    NativeAlert.alert(title, message, [{ text: 'Back', style: 'cancel' }, { text: label, style: 'destructive', onPress: work }]);

  return (
    <PmScreen title="Changes" subtitle="Scope, cost and time changes" right={<HeaderAction icon="plus" label="Raise a change" onPress={() => setRaising(true)} />}
      loading={loading} error={error} refreshing={refreshing} onRefresh={() => void reload()}>
      {!!actionError && <Alert tone="bad" text={actionError} />}
      {all.length > 0 && <Chips<Filter> value={filter} onChange={setFilter} options={[{ key: 'open', label: 'Open' }, { key: 'all', label: `All ${all.length}` }]} />}
      {data && all.length === 0 && <Empty title="No change requests" text="When the client or you want something changed after the contract, raise it here so the price and time impact are agreed first." />}
      {data && all.length > 0 && shown.length === 0 && <Empty title="Nothing waiting" text="Every change has been decided." />}

      {shown.map(change => (
        <Card key={change._id}>
          <View style={s.row}>
            <View style={{ flex: 1 }}><Text style={s.name}>{change.number ? `#${change.number} · ` : ''}{change.title}</Text>
              <Muted>{[change.raisedByRole === 'client' ? 'Raised by client' : 'Raised by studio', change.createdAt ? shortDate(change.createdAt) : ''].filter(Boolean).join(' · ')}</Muted></View>
            <Pill text={STATUS[change.status]?.label || change.status} tone={STATUS[change.status]?.tone} />
          </View>
          {!!change.description && <Text style={s.body}>{change.description}</Text>}
          {(change.costDeltaPaise != null || change.timeDeltaDays != null) && (
            <View style={s.impact}>
              {money && change.costDeltaPaise != null && <Text style={s.impactText}>Cost {change.costDeltaPaise >= 0 ? '+' : ''}{inr(change.costDeltaPaise)}</Text>}
              {change.timeDeltaDays != null && <Text style={s.impactText}>Time {change.timeDeltaDays >= 0 ? '+' : ''}{change.timeDeltaDays} day{Math.abs(change.timeDeltaDays) === 1 ? '' : 's'}</Text>}
            </View>
          )}
          {!!change.decisionNote && <Muted>Note: {change.decisionNote}</Muted>}

          {change.status === 'requested' && (
            <View style={s.actions}>
              <View style={{ flex: 1 }}><Btn small label="Add price & time" disabled={!!busyId} onPress={() => setPricing(change)} /></View>
              <View style={{ flex: 1 }}><Btn small label="Decline" kind="danger" busy={busyId === change._id} onPress={() => confirmAction('Decline this request?', 'The client is told it was declined.', 'Decline', () => void run(change._id, () => pmApi.decideChange(id, change._id, 'reject'), 'Could not decline this request.'))} /></View>
            </View>
          )}
          {change.status === 'submitted' && change.raisedByRole !== 'client' && (
            <Btn small label="Withdraw" kind="ghost" busy={busyId === change._id} onPress={() => confirmAction('Withdraw this change?', 'The client will no longer be asked to decide on it.', 'Withdraw', () => void run(change._id, () => pmApi.withdrawChange(id, change._id), 'Could not withdraw this change.'))} />
          )}
          {change.status === 'submitted' && <Muted>The client confirms the price and time impact. Billing starts only after they approve.</Muted>}
        </Card>
      ))}

      <RaiseSheet id={id} visible={raising} showCost={money} onClose={() => setRaising(false)} onSaved={() => { setRaising(false); void silentReload(); }} />
      <PriceSheet id={id} change={pricing} onClose={() => setPricing(null)} onSaved={() => { setPricing(null); void silentReload(); }} />
    </PmScreen>
  );
}

function RaiseSheet({ id, visible, showCost, onClose, onSaved }: { id: string; visible: boolean; showCost: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!title.trim()) { setError('Give the change a short title.'); return; }
    const costDelta = cost.trim() ? Number(cost.replace(/,/g, '')) : undefined;
    const timeDeltaDays = days.trim() ? Number(days) : undefined;
    if ((costDelta !== undefined && !Number.isFinite(costDelta)) || (timeDeltaDays !== undefined && !Number.isInteger(timeDeltaDays))) { setError('Cost must be a number in rupees and time a whole number of days.'); return; }
    setBusy(true); setError('');
    try {
      await pmApi.raiseChange(id, { title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}), ...(costDelta !== undefined ? { costDelta } : {}), ...(timeDeltaDays !== undefined ? { timeDeltaDays } : {}) });
      setTitle(''); setDescription(''); setCost(''); setDays('');
      onSaved();
    } catch (e) { setError(errorText(e, 'Could not raise this change.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={visible} title="Raise a change" eyebrow="CHANGE REQUEST" onClose={onClose} locked={busy}>
      <View style={{ gap: 10 }}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Add a loft above the wardrobe" maxLength={160} />
        <Field label="What changes (optional)" value={description} onChangeText={setDescription} multiline maxLength={1000} />
        {showCost && <Field label="Cost impact in ₹ (optional, minus for a saving)" value={cost} onChangeText={setCost} keyboardType="numbers-and-punctuation" />}
        <Field label="Time impact in days (optional)" value={days} onChangeText={setDays} keyboardType="numbers-and-punctuation" />
        <Muted>The client reviews the price and time before anything is billed.</Muted>
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label="Send change request" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

function PriceSheet({ id, change, onClose, onSaved }: { id: string; change: ChangeRequest | null; onClose: () => void; onSaved: () => void }) {
  const [cost, setCost] = useState('');
  const [days, setDays] = useState('0');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seen, setSeen] = useState('');
  if (change && change._id !== seen) { setSeen(change._id); setCost(''); setDays('0'); setNote(''); setError(''); }
  if (!change && seen) setSeen('');

  async function save() {
    if (!change) return;
    const costDelta = Number(cost.replace(/,/g, ''));
    const timeDeltaDays = Number(days);
    if (!cost.trim() || !Number.isFinite(costDelta)) { setError('Enter the cost impact in rupees (0 if there is none).'); return; }
    if (!Number.isInteger(timeDeltaDays)) { setError('Enter the time impact as a whole number of days.'); return; }
    setBusy(true); setError('');
    try { await pmApi.priceChange(id, change._id, { costDelta, timeDeltaDays, ...(note.trim() ? { note: note.trim() } : {}) }); onSaved(); }
    catch (e) { setError(errorText(e, 'Could not send the price.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={!!change} title={change?.title || ''} eyebrow="PRICE THIS CHANGE" onClose={onClose} locked={busy}>
      <View style={{ gap: 10 }}>
        {!!change?.description && <Muted>{change.description}</Muted>}
        <Field label="Cost impact (₹)" value={cost} onChangeText={setCost} keyboardType="numbers-and-punctuation" />
        <Field label="Time impact (days)" value={days} onChangeText={setDays} keyboardType="numbers-and-punctuation" />
        <Field label="Note for the client (optional)" value={note} onChangeText={setNote} multiline maxLength={500} />
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label="Send to client" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: { color: pm.ink, fontSize: 13, fontWeight: '800' },
  body: { color: pm.ink, fontSize: 12.5, lineHeight: 18 },
  impact: { flexDirection: 'row', gap: 14 },
  impactText: { color: pm.ink, fontSize: 12.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
});
