import { useState } from 'react';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Body, FormSheet, Title, RowBetween, labelOf, usePmModule } from '../../../../../components/pm/PmKit';
import { Card, Empty, HeaderAction, Muted, PmScreen, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi } from '../../../../../lib/pm/records';

// Decision log: every approval, choice and change is written here automatically, so nobody has to remember who agreed to what.
export default function DecisionsScreen() {
  const m = usePmModule(id => recordsApi.decisions(id));
  const [adding, setAdding] = useState(false);
  const decisions = m.payload?.decisions || [];

  return (
    <PmScreen title="Decision log" subtitle={decisions.length ? `${decisions.length} entr${decisions.length === 1 ? 'y' : 'ies'}` : undefined}
      right={can(m.role, 'decision.add') ? <HeaderAction icon="plus" label="Add a decision" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {m.payload && decisions.length === 0 && <Empty title="Nothing recorded yet" text="Approvals, selections and changes appear here as they happen. You can also add a decision yourself." />}
      {decisions.map(decision => (
        <Card key={decision._id}>
          <RowBetween><Title>{decision.title}</Title><Muted>{decision.at ? shortDate(decision.at) : ''}</Muted></RowBetween>
          {!!decision.note && <Body>{decision.note}</Body>}
          <Muted>{[decision.decidedByName, decision.decidedByRole && labelOf(decision.decidedByRole)].filter(Boolean).join(' · ')}</Muted>
        </Card>
      ))}
      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addDecision(m.id, body); setAdding(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { title: string; note?: string }) => Promise<void> }) {
  const [title, setTitle] = useState(''); const [note, setNote] = useState('');
  return (
    <FormSheet visible={visible} title="Add a decision" eyebrow="DECISION LOG" submitLabel="Add to log" onClose={onClose} submit={async () => {
      if (!title.trim()) return 'Write the decision in one line.';
      await submit({ title: title.trim(), ...(note.trim() ? { note: note.trim() } : {}) });
      setTitle(''); setNote('');
    }}>
      <Field label="Decision" value={title} onChangeText={setTitle} placeholder="Quartz counter chosen for the kitchen" maxLength={200} />
      <Field label="Details (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
    </FormSheet>
  );
}
