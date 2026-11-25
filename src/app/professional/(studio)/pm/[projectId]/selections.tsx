import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Actions, FormSheet, FieldLabel, Title, RowBetween, confirmAction, labelOf, rupees, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, Tone, inr, isoFromField, pm, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi, type Selection } from '../../../../../lib/pm/records';

const STATUS: Record<Selection['status'], { label: string; tone: Tone }> = {
  draft: { label: 'Draft, hidden from client', tone: 'gray' }, shown: { label: 'Waiting for client', tone: 'warn' }, chosen: { label: 'Client chose', tone: 'blue' }, locked: { label: 'Locked', tone: 'ok' },
};

// Selections: finishes and materials the client has to choose (laminate, tiles, paint) before the work can order them.
export default function SelectionsScreen() {
  const m = usePmModule(id => recordsApi.selections(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [adding, setAdding] = useState(false);
  const manage = can(m.role, 'selection.manage');
  const selections = m.payload?.selections || [];

  return (
    <PmScreen title="Selections" subtitle={selections.length ? `${selections.filter(s => s.status === 'shown').length} waiting for the client` : undefined}
      right={manage ? <HeaderAction icon="plus" label="New selection" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {m.payload && selections.length === 0 && <Empty title="No selections" text="Create a choice with two or more options, then show it to the client to decide." />}
      {selections.map(selection => (
        <Card key={selection._id}>
          <RowBetween><View style={{ flex: 1 }}><Title>{selection.title}</Title><Muted>{[selection.room, selection.category && labelOf(selection.category), selection.deadline ? `decide by ${shortDate(selection.deadline)}` : ''].filter(Boolean).join(' · ')}</Muted></View>
            <Pill text={STATUS[selection.status]?.label || selection.status} tone={STATUS[selection.status]?.tone} /></RowBetween>
          {selection.options.map(option => {
            const chosen = selection.chosenOptionId === option._id;
            const canChoose = can(m.role, 'selection.choose') && selection.status === 'shown';
            return (
              <Pressable key={option._id} disabled={!canChoose || !!busyId} style={[s.option, chosen && s.optionOn]} accessibilityRole={canChoose ? 'button' : undefined}
                onPress={() => confirmAction('Choose this option?', `${option.label}${option.pricePaise ? ` (${inr(option.pricePaise)})` : ''}. The studio is told straight away.`, 'Choose', () => void run(option._id, () => recordsApi.chooseSelection(m.id, selection._id, option._id), 'Could not save this choice.'), false)}>
                <View style={[s.radio, chosen && s.radioOn]} />
                <View style={{ flex: 1 }}><Text style={s.optionLabel}>{option.label}</Text>{!!option.note && <Muted>{option.note}</Muted>}</View>
                {!!option.pricePaise && <Text style={s.price}>{inr(option.pricePaise)}</Text>}
              </Pressable>
            );
          })}
          {manage && (
            <Actions>
              {selection.status === 'draft' && <View style={{ flex: 1 }}><Btn small label="Show to client" busy={busyId === selection._id} onPress={() => void run(selection._id, () => recordsApi.showSelection(m.id, selection._id), 'Could not show this to the client.')} /></View>}
              {selection.status === 'chosen' && <View style={{ flex: 1 }}><Btn small kind="green" label="Lock choice" busy={busyId === selection._id} onPress={() => void run(selection._id, () => recordsApi.lockSelection(m.id, selection._id), 'Could not lock this choice.')} /></View>}
              {(selection.status === 'draft' || selection.status === 'shown') && <View style={{ flex: 1 }}><Btn small kind="danger" label="Delete" disabled={!!busyId} onPress={() => confirmAction('Delete this selection?', selection.title, 'Delete', () => void run(selection._id, () => recordsApi.deleteSelection(m.id, selection._id), 'Could not delete this selection.'))} /></View>}
            </Actions>
          )}
        </Card>
      ))}
      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addSelection(m.id, body); setAdding(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

interface OptionDraft { label: string; note: string; price: string }
function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { room?: string; category: string; title: string; options: { label: string; note?: string; price?: number }[]; deadline?: string }) => Promise<void> }) {
  const [title, setTitle] = useState(''); const [category, setCategory] = useState(''); const [room, setRoom] = useState(''); const [deadline, setDeadline] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([{ label: '', note: '', price: '' }, { label: '', note: '', price: '' }]);
  const patch = (index: number, change: Partial<OptionDraft>) => setOptions(prev => prev.map((o, i) => (i === index ? { ...o, ...change } : o)));
  return (
    <FormSheet visible={visible} title="New selection" eyebrow="SELECTIONS" submitLabel="Save as draft" onClose={onClose} submit={async () => {
      const filled = options.filter(o => o.label.trim());
      if (!title.trim()) return 'Say what the client is choosing.';
      if (!category.trim()) return 'Add a category, for example laminate or tiles.';
      if (filled.length < 2) return 'Add at least two options to choose between.';
      const parsed: { label: string; note?: string; price?: number }[] = [];
      for (const o of filled) {
        const price = o.price.trim() ? rupees(o.price) : undefined;
        if (o.price.trim() && (price === undefined || price < 0)) return `Enter a valid price for ${o.label.trim()}.`;
        parsed.push({ label: o.label.trim(), ...(o.note.trim() ? { note: o.note.trim() } : {}), ...(price !== undefined ? { price } : {}) });
      }
      await submit({ title: title.trim(), category: category.trim().toLowerCase().replace(/\s+/g, '_'), ...(room.trim() ? { room: room.trim() } : {}), options: parsed, ...(isoFromField(deadline) ? { deadline: isoFromField(deadline) } : {}) });
      setTitle(''); setCategory(''); setRoom(''); setDeadline(''); setOptions([{ label: '', note: '', price: '' }, { label: '', note: '', price: '' }]);
    }}>
      <Field label="What is being chosen" value={title} onChangeText={setTitle} placeholder="Living wall laminate" maxLength={160} />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Laminate" maxLength={60} />
      <Field label="Room (optional)" value={room} onChangeText={setRoom} maxLength={60} />
      <DateField label="Decide by (optional)" value={deadline} onChange={setDeadline} minDate={LONG_AGO} placeholder="Optional" />
      <FieldLabel>Options</FieldLabel>
      {options.map((option, index) => (
        <View key={index} style={s.draft}>
          <Field value={option.label} onChangeText={value => patch(index, { label: value })} placeholder={`Option ${index + 1} name`} maxLength={120} />
          <Field value={option.note} onChangeText={value => patch(index, { note: value })} placeholder="Note (optional)" maxLength={200} />
          <Field value={option.price} onChangeText={value => patch(index, { price: value })} placeholder="Extra price in ₹ (optional)" keyboardType="decimal-pad" />
        </View>
      ))}
      {options.length < 12 && <Btn small kind="ghost" label="Add another option" onPress={() => setOptions(prev => [...prev, { label: '', note: '', price: '' }])} />}
      <Muted>Saved as a draft: the client sees it only after you show it.</Muted>
    </FormSheet>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: pm.line },
  optionOn: { borderColor: pm.ok, backgroundColor: pm.okBg },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: pm.soft },
  radioOn: { borderColor: pm.ok, backgroundColor: pm.ok },
  optionLabel: { color: pm.ink, fontSize: 12.5, fontWeight: '700' },
  price: { color: pm.ink, fontSize: 12.5, fontWeight: '800' },
  draft: { gap: 4, padding: 8, borderRadius: 11, borderWidth: 1, borderColor: pm.line },
});
