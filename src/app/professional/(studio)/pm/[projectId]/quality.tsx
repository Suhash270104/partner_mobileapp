import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Actions, Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, labelOf, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Empty, HeaderAction, Muted, Pill, PmScreen, Tone, pm, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi, type QcCheck, type QcItem } from '../../../../../lib/pm/records';

type Result = QcItem['result'];
const NEXT: Record<Result, Result> = { pending: 'pass', pass: 'fail', fail: 'pending' };
const MARK: Record<Result, { glyph: string; color: string; bg: string; label: string }> = {
  pending: { glyph: '○', color: pm.soft, bg: '#fff', label: 'Not checked' }, pass: { glyph: '✓', color: pm.ok, bg: pm.okBg, label: 'Passed' }, fail: { glyph: '✕', color: pm.bad, bg: pm.badBg, label: 'Failed' },
};
const STATUS_TONE: Record<string, Tone> = { open: 'gray', in_progress: 'blue', passed: 'ok', failed: 'bad', signed: 'ok' };

// Quality checks: a checklist per activity. Tap an item to cycle not checked -> pass -> fail. Signing a failed required item raises a snag.
export default function QualityScreen() {
  const m = usePmModule(id => recordsApi.qc(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<string, Record<string, Result>>>({});
  const manage = can(m.role, 'qc.manage');
  const checks = m.payload?.checks || [];

  const resultOf = (check: QcCheck, item: QcItem): Result => draft[check._id]?.[item._id] ?? item.result;
  const setResult = (check: QcCheck, item: QcItem) => setDraft(prev => ({ ...prev, [check._id]: { ...(prev[check._id] || {}), [item._id]: NEXT[resultOf(check, item)] } }));
  const dirty = (check: QcCheck) => Object.keys(draft[check._id] || {}).length > 0;

  async function save(check: QcCheck) {
    const results = Object.entries(draft[check._id] || {}).map(([itemId, result]) => ({ itemId, result }));
    const ok = await run(check._id, () => recordsApi.qcResults(m.id, check._id, results), 'Could not save these results.');
    if (ok) setDraft(prev => { const next = { ...prev }; delete next[check._id]; return next; });
  }

  return (
    <PmScreen title="Quality checks" subtitle={checks.length ? `${checks.length} checklist${checks.length === 1 ? '' : 's'}` : undefined}
      right={manage ? <HeaderAction icon="plus" label="New checklist" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {m.payload && checks.length === 0 && <Empty title="No quality checks" text="Create a checklist for an activity, then pass or fail each item on site." />}
      {checks.map(check => {
        const failed = check.items.some(item => resultOf(check, item) === 'fail');
        return (
          <Card key={check._id}>
            <RowBetween><Title>{check.title}</Title><Pill text={check.signedAt ? `Signed ${shortDate(check.signedAt)}` : labelOf(check.status)} tone={failed ? 'bad' : STATUS_TONE[check.status] || 'gray'} /></RowBetween>
            {failed && <Alert tone="bad" text="A failed item raises a snag when you sign this checklist." />}
            {check.items.map(item => {
              const result = resultOf(check, item);
              const mark = MARK[result];
              return (
                <Pressable key={item._id} style={s.item} disabled={!manage || !!check.signedAt} onPress={() => setResult(check, item)} accessibilityRole="button" accessibilityLabel={`${item.text}: ${mark.label}`}>
                  <View style={[s.mark, { backgroundColor: mark.bg, borderColor: mark.color }]}><Text style={[s.markText, { color: mark.color }]}>{mark.glyph}</Text></View>
                  <View style={{ flex: 1 }}><Body>{item.text}</Body>{!!item.remark && <Muted>{item.remark}</Muted>}</View>
                  {item.required !== false && <Muted>Required</Muted>}
                </Pressable>
              );
            })}
            {manage && !check.signedAt && (
              <Actions>
                {dirty(check) && <View style={{ flex: 1 }}><Btn small label="Save results" busy={busyId === check._id} onPress={() => void save(check)} /></View>}
                {!dirty(check) && <View style={{ flex: 1 }}><Btn small kind="green" label="Sign off" busy={busyId === check._id} onPress={() => void run(check._id, () => recordsApi.signQc(m.id, check._id), 'Mark every required item pass or fail before signing.')} /></View>}
                <View style={{ flex: 1 }}><Btn small kind="danger" label="Delete" disabled={!!busyId} onPress={() => confirmAction('Delete this checklist?', check.title, 'Delete', () => void run(check._id, () => recordsApi.deleteQc(m.id, check._id), 'Could not delete this checklist.'))} /></View>
              </Actions>
            )}
            {manage && (
              <View style={s.share}><Text style={s.shareText}>Share result with the client</Text>
                <Switch value={!!check.clientVisible} disabled={!!busyId} onValueChange={value => void run(`s${check._id}`, () => recordsApi.shareQc(m.id, check._id, value), 'Could not change sharing.')} trackColor={{ false: '#CFC9B8', true: pm.ok }} thumbColor="#fff" /></View>
            )}
          </Card>
        );
      })}
      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addQc(m.id, body); setAdding(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { title: string; items: { text: string; required: boolean }[] }) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<string[]>(['', '']);
  return (
    <FormSheet visible={visible} title="New checklist" eyebrow="QUALITY" submitLabel="Create checklist" onClose={onClose} submit={async () => {
      const filled = items.map(text => text.trim()).filter(Boolean);
      if (!title.trim()) return 'Name the checklist, for example the activity it belongs to.';
      if (filled.length === 0) return 'Add at least one item to check.';
      await submit({ title: title.trim(), items: filled.map(text => ({ text, required: true })) });
      setTitle(''); setItems(['', '']);
    }}>
      <Field label="Checklist" value={title} onChangeText={setTitle} placeholder="Waterproofing — bathroom 2" maxLength={160} />
      <FieldLabel>Items</FieldLabel>
      {items.map((text, index) => <Field key={index} value={text} onChangeText={value => setItems(prev => prev.map((entry, i) => (i === index ? value : entry)))} placeholder={`Item ${index + 1}`} maxLength={200} />)}
      <Btn small kind="ghost" label="Add another item" onPress={() => setItems(prev => [...prev, ''])} />
    </FormSheet>
  );
}

const s = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: pm.line },
  mark: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 14, fontWeight: '800' },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  shareText: { color: pm.muted, fontSize: 12, fontWeight: '700' },
});
