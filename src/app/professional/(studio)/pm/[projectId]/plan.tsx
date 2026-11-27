import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField, parseDate } from '../../../../../components/studio/DateTimeFields';
import { Sheet } from '../../../../../components/studio/Sheet';
import {
  Alert, Bar, Btn, Card, Chips, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, SectionTitle, Tone, VisibilityToggle, errorText, isoFromField, pm, shortDate, usePmLoad,
} from '../../../../../components/pm/PmUi';
import { canEditPlan, pmApi, type ActivityStatus, type PlanActivity, type PlanScope } from '../../../../../lib/pm/api';

const STATUS: Record<ActivityStatus, { label: string; tone: Tone }> = {
  not_started: { label: 'Not started', tone: 'gray' }, in_progress: { label: 'In progress', tone: 'blue' }, blocked: { label: 'Blocked', tone: 'bad' }, done: { label: 'Done', tone: 'ok' },
};
const STATUS_OPTIONS = (Object.keys(STATUS) as ActivityStatus[]).map(key => ({ key, label: STATUS[key].label }));

// Plan: scopes and their activities with progress. Tap an activity to update it; the switch controls what the client sees.
export default function PlanScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = String(projectId || '');
  const { data, error, loading, refreshing, reload, silentReload } = usePmLoad(async () => {
    const [plan, overview] = await Promise.all([pmApi.plan(id), pmApi.overview(id)]);
    return { plan, role: overview.role };
  }, [id]);
  const [editing, setEditing] = useState<PlanActivity | null>(null);
  const [adding, setAdding] = useState(false);
  // What a tapped switch shows before the reloaded plan arrives. `plan` here is the data on screen when it was tapped:
  // once a newer plan loads, the server's value takes over again.
  const [switches, setSwitches] = useState<Record<string, { value: boolean; saving: boolean; loaded: unknown }>>({});
  const savingSwitches = useRef(new Set<string>());
  const [toggleError, setToggleError] = useState('');

  const plan = data?.plan;
  const canEdit = canEditPlan(data?.role);
  const grouped = useMemo(() => (plan?.scopes || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(scope => ({
    scope, activities: (plan?.activities || []).filter(activity => activity.scopeId === scope._id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  })), [plan]);

  const isVisible = (activity: PlanActivity) => {
    const tapped = switches[activity._id];
    return tapped && (tapped.saving || tapped.loaded === data) ? tapped.value : activity.clientVisible !== false;
  };

  // The switch moves as soon as it is tapped, and moves back only if the change could not be saved.
  async function toggleVisible(activity: PlanActivity, next: boolean) {
    const key = activity._id;
    if (savingSwitches.current.has(key)) return; // one save at a time for each switch
    savingSwitches.current.add(key);
    setToggleError('');
    setSwitches(current => ({ ...current, [key]: { value: next, saving: true, loaded: data } }));
    try {
      await pmApi.setVisibility(id, 'activity', key, next);
    } catch (e) {
      setSwitches(current => { const rest = { ...current }; delete rest[key]; return rest; });
      setToggleError(errorText(e, 'Could not change what the client sees.'));
      return;
    } finally {
      savingSwitches.current.delete(key);
    }
    setSwitches(current => ({ ...current, [key]: { value: next, saving: false, loaded: data } }));
    await silentReload();
  }

  return (
    <PmScreen title="Plan" subtitle={plan ? `${plan.activities.length} activities${plan.projectedEnd ? ` · ends ${shortDate(plan.projectedEnd)}` : ''}` : undefined}
      right={canEdit ? <HeaderAction icon="plus" label="Add activity" onPress={() => setAdding(true)} /> : undefined}
      loading={loading} error={error} refreshing={refreshing} onRefresh={() => void reload()}>
      {!!toggleError && <Alert tone="bad" text={toggleError} />}
      {!!plan?.criticalCount && <Alert tone="warn" text={`${plan.criticalCount} activit${plan.criticalCount === 1 ? 'y is' : 'ies are'} on the critical path: a delay there moves the handover date.`} />}
      {plan && grouped.length === 0 && <Empty title="No activities yet" text="Add a scope and its activities to start tracking progress." />}

      {grouped.map(({ scope, activities }) => {
        const delayed = activities.some(a => a.isOverdue && a.status !== 'done');
        return (
          <Card key={scope._id}>
            <View style={s.scopeRow}>
              <Text style={s.scope} numberOfLines={1}>▾ {scope.name}</Text>
              {delayed ? <Pill text="Delayed" tone="bad" /> : activities.length > 0 && activities.every(a => a.status === 'done') ? <Pill text="Done" tone="ok" /> : null}
            </View>
            {activities.length === 0 && <Muted>No activities in this scope yet.</Muted>}
            {activities.map(activity => (
              <View key={activity._id} style={s.activity}>
                <Pressable style={{ flex: 1, gap: 3 }} onPress={() => canEdit && setEditing(activity)} accessibilityRole={canEdit ? 'button' : undefined} accessibilityLabel={`${activity.name}, ${Math.round(activity.progressPct)}%`}>
                  <Text style={s.name}>{activity.name}</Text>
                  <Muted>{[activity.ownerName, activity.plannedEnd ? `due ${shortDate(activity.plannedEnd)}` : '', activity.isOverdue && activity.status !== 'done' ? 'overdue' : ''].filter(Boolean).join(' · ') || STATUS[activity.status]?.label}</Muted>
                  <Bar pct={activity.progressPct} tone={activity.isOverdue && activity.status !== 'done' ? 'bad' : activity.status === 'blocked' ? 'warn' : 'ok'} />
                </Pressable>
                {canEdit && <VisibilityToggle value={isVisible(activity)} onChange={next => void toggleVisible(activity, next)} />}
              </View>
            ))}
          </Card>
        );
      })}
      {canEdit && grouped.length > 0 && <Muted style={{ textAlign: 'center' }}>Switch on = the client can see it</Muted>}

      <ProgressSheet id={id} activity={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void silentReload(); }} />
      <AddSheet id={id} visible={adding} scopes={plan?.scopes || []} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void silentReload(); }} />
    </PmScreen>
  );
}

function ProgressSheet({ id, activity, onClose, onSaved }: { id: string; activity: PlanActivity | null; onClose: () => void; onSaved: () => void }) {
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState<ActivityStatus>('not_started');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seenId, setSeenId] = useState('');

  // Reset the form each time a different activity is opened.
  if (activity && activity._id !== seenId) { setSeenId(activity._id); setPct(Math.round(activity.progressPct)); setStatus(activity.status); setRemark(''); setError(''); }
  if (!activity && seenId) setSeenId('');

  const pickPct = (value: number) => { const next = Math.max(0, Math.min(100, value)); setPct(next); setStatus(current => (next === 100 ? 'done' : next > 0 && current !== 'blocked' ? 'in_progress' : next === 0 && current !== 'blocked' ? 'not_started' : current)); };

  async function save() {
    if (!activity) return;
    setBusy(true); setError('');
    try {
      await pmApi.progress(id, activity._id, { progressPct: pct, ...(remark.trim() ? { remark: remark.trim() } : {}) });
      // Blocked is a status, not a percentage: set or clear it separately.
      if (status === 'blocked' || activity.status === 'blocked') {
        await pmApi.patchActivity(id, activity._id, { status, ...(remark.trim() ? { reason: remark.trim() } : {}) });
      }
      onSaved();
    } catch (e) { setError(errorText(e, 'Could not save this update.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={!!activity} title={activity?.name || ''} eyebrow="UPDATE PROGRESS" onClose={onClose} locked={busy}>
      <View style={{ gap: 12 }}>
        <View style={s.stepperRow}>
          <Pressable style={s.stepBtn} onPress={() => pickPct(pct - 10)} accessibilityLabel="Decrease by 10 percent"><Text style={s.stepBtnText}>−10</Text></Pressable>
          <Text style={s.pct}>{pct}%</Text>
          <Pressable style={s.stepBtn} onPress={() => pickPct(pct + 10)} accessibilityLabel="Increase by 10 percent"><Text style={s.stepBtnText}>+10</Text></Pressable>
        </View>
        <Bar pct={pct} tone="terra" />
        <Chips<string> value={String(pct)} onChange={value => pickPct(Number(value))} options={[0, 25, 50, 75, 100].map(v => ({ key: String(v), label: `${v}%` }))} />
        <Text style={s.label}>Status</Text>
        <Chips<ActivityStatus> value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <Field label="Remark (optional)" value={remark} onChangeText={setRemark} placeholder="Bedroom 2 conduit done" maxLength={500} />
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label="Save update" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

function AddSheet({ id, visible, scopes, onClose, onSaved }: { id: string; visible: boolean; scopes: PlanScope[]; onClose: () => void; onSaved: () => void }) {
  const [scopeId, setScopeId] = useState('');
  const [newScope, setNewScope] = useState('');
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [clientVisible, setClientVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosenScope = scopeId || (newScope.trim() ? '' : scopes[0]?._id || '');

  async function save() {
    if (!name.trim()) { setError('Enter the activity name.'); return; }
    const plannedStart = start ? isoFromField(start) : undefined;
    const plannedEnd = end ? isoFromField(end) : undefined;
    if (!!plannedStart !== !!plannedEnd) { setError('Set both the start and end dates, or leave both empty.'); return; }
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) { setError('The end date cannot be before the start date.'); return; }
    if (!chosenScope && !newScope.trim()) { setError('Choose a scope or name a new one.'); return; }
    setBusy(true); setError('');
    try {
      const target = newScope.trim() ? (await pmApi.addScope(id, newScope.trim())).scope._id : chosenScope;
      await pmApi.addActivity(id, { scopeId: target, name: name.trim(), ...(plannedStart ? { plannedStart, plannedEnd } : {}), ...(owner.trim() ? { ownerName: owner.trim() } : {}), clientVisible });
      setName(''); setOwner(''); setStart(''); setEnd(''); setNewScope(''); setScopeId('');
      onSaved();
    } catch (e) { setError(errorText(e, 'Could not add this activity.')); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={visible} title="New activity" eyebrow="PLAN" onClose={onClose} locked={busy}>
      <View style={{ gap: 10 }}>
        {scopes.length > 0 && (
          <>
            <Text style={s.label}>Scope</Text>
            <Chips<string> value={newScope.trim() ? '' : chosenScope} onChange={value => { setScopeId(value); setNewScope(''); }} options={scopes.map(scope => ({ key: scope._id, label: scope.name }))} />
          </>
        )}
        <Field label={scopes.length ? 'Or create a new scope' : 'Scope name'} value={newScope} onChangeText={setNewScope} placeholder="Electrical & plumbing" maxLength={120} />
        <Field label="Activity" value={name} onChangeText={setName} placeholder="Electrical first fix" maxLength={160} />
        <Field label="Owner (optional)" value={owner} onChangeText={setOwner} placeholder="Ravi K." maxLength={120} />
        <DateField label="Planned start" value={start} onChange={setStart} minDate={LONG_AGO} placeholder="Optional" />
        <DateField label="Planned end" value={end} onChange={setEnd} minDate={parseDate(start) || LONG_AGO} placeholder="Optional" />
        <View style={s.visRow}><Text style={s.name}>Client can see this</Text><VisibilityToggle value={clientVisible} onChange={setClientVisible} /></View>
        {!!error && <Alert tone="bad" text={error} />}
        <Btn label="Add activity" busy={busy} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  scopeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scope: { flex: 1, color: pm.ink, fontSize: 13.5, fontWeight: '800' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: pm.line },
  name: { color: pm.ink, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  label: { color: pm.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { minWidth: 64, height: 44, borderRadius: 12, borderWidth: 1, borderColor: pm.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: pm.ink, fontSize: 14, fontWeight: '800' },
  pct: { color: pm.ink, fontSize: 28, fontWeight: '800' },
  visRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
