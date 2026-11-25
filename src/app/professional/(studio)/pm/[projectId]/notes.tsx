import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Actions, Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Chips, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, isoFromField, pm, shortDate, todayField } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi, type ActionItem } from '../../../../../lib/pm/records';

// Notes and meeting minutes. Action items can become tasks; a note is shown to the client only when it is shared.
export default function NotesScreen() {
  const m = usePmModule(id => recordsApi.notes(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [adding, setAdding] = useState(false);
  const manage = can(m.role, 'note.manage');
  const notes = m.payload?.notes || [];

  return (
    <PmScreen title="Notes & minutes" subtitle={notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : undefined}
      right={manage ? <HeaderAction icon="plus" label="New note" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {m.payload && notes.length === 0 && <Empty title="No notes yet" text="Record meeting minutes and decisions. Action items turn into tasks with one tap." />}
      {notes.map(note => (
        <Card key={note._id}>
          <RowBetween><Title>{note.title}</Title><Pill text={note.type === 'mom' ? 'Minutes' : 'Note'} tone="blue" /></RowBetween>
          <Muted>{[note.heldOn ? shortDate(note.heldOn) : '', note.attendees?.length ? note.attendees.join(', ') : '', note.sharedWithClient ? 'Shared with client' : ''].filter(Boolean).join(' · ')}</Muted>
          {!!note.body && <Body>{note.body}</Body>}
          {(note.actionItems || []).map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: item.done ? pm.ok : pm.soft, fontSize: 15 }}>{item.done ? '☑' : '☐'}</Text>
              <View style={{ flex: 1 }}><Body>{item.text}</Body>{!!item.assignee && <Muted>{item.assignee}</Muted>}</View>
              {manage && !item.done && <Btn small kind="ghost" label="Make task" busy={busyId === `${note._id}${index}`} onPress={() => void run(`${note._id}${index}`, () => recordsApi.noteTask(m.id, note._id, index), 'Could not create the task.')} />}
            </View>
          ))}
          {manage && <Actions><View style={{ flex: 1 }}><Btn small kind="danger" label="Delete" busy={busyId === note._id} onPress={() => confirmAction('Delete this note?', note.title, 'Delete', () => void run(note._id, () => recordsApi.deleteNote(m.id, note._id), 'Could not delete this note.'))} /></View></Actions>}
        </Card>
      ))}
      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addNote(m.id, body); setAdding(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { title: string; type: 'note' | 'mom'; body?: string; heldOn?: string; attendees?: string[]; actionItems?: ActionItem[]; sharedWithClient?: boolean }) => Promise<void> }) {
  const [type, setType] = useState<'note' | 'mom'>('mom'); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [held, setHeld] = useState(todayField());
  const [attendees, setAttendees] = useState(''); const [actions, setActions] = useState<string[]>(['']); const [shared, setShared] = useState(false);
  return (
    <FormSheet visible={visible} title={type === 'mom' ? 'Meeting minutes' : 'New note'} eyebrow="NOTES" submitLabel="Save" onClose={onClose} submit={async () => {
      if (!title.trim()) return 'Give it a title.';
      const items = actions.map(text => text.trim()).filter(Boolean).map(text => ({ text }));
      await submit({ title: title.trim(), type, sharedWithClient: shared, ...(body.trim() ? { body: body.trim() } : {}), ...(type === 'mom' && isoFromField(held) ? { heldOn: isoFromField(held) } : {}),
        ...(attendees.trim() ? { attendees: attendees.split(',').map(a => a.trim()).filter(Boolean) } : {}), ...(items.length ? { actionItems: items } : {}) });
      setTitle(''); setBody(''); setAttendees(''); setActions(['']); setShared(false);
    }}>
      <Chips value={type} onChange={setType} options={[{ key: 'mom', label: 'Meeting minutes' }, { key: 'note', label: 'Note' }]} />
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Kitchen finalisation" maxLength={160} />
      {type === 'mom' && <DateField label="Held on" value={held} onChange={setHeld} minDate={LONG_AGO} />}
      {type === 'mom' && <Field label="Attendees (comma separated)" value={attendees} onChangeText={setAttendees} />}
      <Field label={type === 'mom' ? 'Discussion and decisions' : 'Note'} value={body} onChangeText={setBody} multiline maxLength={4000} />
      <FieldLabel>Action items</FieldLabel>
      {actions.map((text, index) => <Field key={index} value={text} onChangeText={value => setActions(prev => prev.map((a, i) => (i === index ? value : a)))} placeholder="Order quartz sample" maxLength={200} />)}
      <Btn small kind="ghost" label="Add action item" onPress={() => setActions(prev => [...prev, ''])} />
      <RowBetween><Text style={{ color: pm.ink, fontSize: 12.5, fontWeight: '700', flex: 1 }}>Share with the client</Text><Switch value={shared} onValueChange={setShared} trackColor={{ false: '#CFC9B8', true: pm.ok }} thumbColor="#fff" /></RowBetween>
    </FormSheet>
  );
}
