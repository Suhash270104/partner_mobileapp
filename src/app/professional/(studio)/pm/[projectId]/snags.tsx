import { useState } from 'react';
import { View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Actions, Body, FormSheet, Title, RowBetween, confirmAction, useRunner, usePmModule, labelOf } from '../../../../../components/pm/PmKit';
import { Alert, Bar, Btn, Card, Chips, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, Tone, isoFromField, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi, type Snag } from '../../../../../lib/pm/records';

const STATUS: Record<Snag['status'], { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'warn' }, fixed: { label: 'Fixed, awaiting client', tone: 'blue' }, verified: { label: 'Closed', tone: 'ok' }, reopened: { label: 'Re-opened', tone: 'bad' },
};
type Filter = 'open' | 'all';

// Snag list: defects found at handover. open -> fixed (studio) -> verified (client), or re-opened by the client.
export default function SnagsScreen() {
  const m = usePmModule(id => recordsApi.snags(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [filter, setFilter] = useState<Filter>('open');
  const [adding, setAdding] = useState(false);
  const [fixing, setFixing] = useState<Snag | null>(null);

  const snags = m.payload?.snags || [];
  const closed = snags.filter(snag => snag.status === 'verified').length;
  const manage = can(m.role, 'snag.manage');
  const shown = snags.filter(snag => filter === 'all' || snag.status !== 'verified');

  return (
    <PmScreen title="Snag list" subtitle={snags.length ? `${closed} closed · ${snags.length - closed} open` : undefined}
      right={manage ? <HeaderAction icon="plus" label="Add snag" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {snags.length > 0 && (<><Card><RowBetween><Title>{snags.length} snag{snags.length === 1 ? '' : 's'}</Title><Muted>{Math.round((closed / snags.length) * 100)}% closed</Muted></RowBetween><Bar pct={(closed / snags.length) * 100} /></Card>
        <Chips<Filter> value={filter} onChange={setFilter} options={[{ key: 'open', label: 'Open' }, { key: 'all', label: `All ${snags.length}` }]} /></>)}
      {m.payload && snags.length === 0 && <Empty title="No snags" text="Defects found during the final walk-through are listed here until the client verifies each fix." />}
      {m.payload && snags.length > 0 && shown.length === 0 && <Empty title="All snags are closed" />}

      {shown.map(snag => (
        <Card key={snag._id}>
          <RowBetween><Title>{snag.number ? `#${snag.number} · ` : ''}{snag.title}</Title><Pill text={STATUS[snag.status]?.label || labelOf(snag.status)} tone={STATUS[snag.status]?.tone} /></RowBetween>
          <Muted>{[snag.location, snag.ownerName, snag.dueDate ? `due ${shortDate(snag.dueDate)}` : '', snag.raisedByRole === 'client' ? 'Raised by client' : ''].filter(Boolean).join(' · ')}</Muted>
          {!!snag.fixNote && <Body>Fix note: {snag.fixNote}</Body>}
          {manage && (snag.status === 'open' || snag.status === 'reopened') && (
            <Actions>
              <View style={{ flex: 1 }}><Btn small label="Mark as fixed" kind="green" disabled={!!busyId} onPress={() => setFixing(snag)} /></View>
              {snag.status === 'open' && <View style={{ flex: 1 }}><Btn small label="Delete" kind="danger" busy={busyId === snag._id}
                onPress={() => confirmAction('Delete this snag?', snag.title, 'Delete', () => void run(snag._id, () => recordsApi.deleteSnag(m.id, snag._id), 'Could not delete this snag.'))} /></View>}
            </Actions>
          )}
          {snag.status === 'fixed' && <Muted>Waiting for the client to check the fix.</Muted>}
        </Card>
      ))}

      <FixSheet snag={fixing} onClose={() => setFixing(null)} submit={async note => { await recordsApi.fixSnag(m.id, fixing!._id, note); setFixing(null); await m.silentReload(); }} />
      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addSnag(m.id, body); setAdding(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function FixSheet({ snag, onClose, submit }: { snag: Snag | null; onClose: () => void; submit: (note?: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  return (
    <FormSheet visible={!!snag} title={snag?.title || ''} eyebrow="MARK AS FIXED" submitLabel="Mark as fixed" kind="green" onClose={onClose} submit={async () => { await submit(note.trim() || undefined); setNote(''); }}>
      <Muted>The client is asked to verify the fix. The snag closes only when they do.</Muted>
      <Field label="What was done (optional)" value={note} onChangeText={setNote} multiline maxLength={500} />
    </FormSheet>
  );
}

function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (body: { title: string; location?: string; ownerName?: string; dueDate?: string }) => Promise<void> }) {
  const [title, setTitle] = useState(''); const [location, setLocation] = useState(''); const [owner, setOwner] = useState(''); const [due, setDue] = useState('');
  return (
    <FormSheet visible={visible} title="New snag" eyebrow="SNAG LIST" submitLabel="Add snag" onClose={onClose} submit={async () => {
      if (!title.trim()) return 'Describe the defect.';
      await submit({ title: title.trim(), ...(location.trim() ? { location: location.trim() } : {}), ...(owner.trim() ? { ownerName: owner.trim() } : {}), ...(isoFromField(due) ? { dueDate: isoFromField(due) } : {}) });
      setTitle(''); setLocation(''); setOwner(''); setDue('');
    }}>
      <Field label="Defect" value={title} onChangeText={setTitle} placeholder="Paint patch near the switch board" maxLength={160} />
      <Field label="Location (optional)" value={location} onChangeText={setLocation} maxLength={120} />
      <Field label="Assigned to (optional)" value={owner} onChangeText={setOwner} maxLength={120} />
      <DateField label="Fix by (optional)" value={due} onChange={setDue} minDate={LONG_AGO} placeholder="Optional" />
    </FormSheet>
  );
}
