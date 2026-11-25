import { useState } from 'react';
import { View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Actions, Body, FormSheet, Title, RowBetween, confirmAction, labelOf, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Bar, Btn, Card, Empty, HEALTH, HeaderAction, Muted, Pill, PmScreen, SectionTitle, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi, type WeeklyReport } from '../../../../../lib/pm/records';

// Weekly progress report: built from the plan, shared decisions and delays. It never contains money. Review, add a note, then send.
export default function WeeklyReportsScreen() {
  const m = usePmModule(id => recordsApi.weekly(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [noting, setNoting] = useState<WeeklyReport | null>(null);
  const manage = can(m.role, 'weekly.manage');
  const reports = (m.payload?.reports || []).slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return (
    <PmScreen title="Weekly reports" subtitle={reports.length ? `${reports.length} report${reports.length === 1 ? '' : 's'}` : undefined}
      right={manage ? <HeaderAction icon="plus" label="Generate this week's report" onPress={() => void run('gen', () => recordsApi.generateWeekly(m.id), 'Could not generate the report.')} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {m.payload && reports.length === 0 && <Empty title="No reports yet" text={manage ? 'Generate this week\'s report from the plan, then review it and send it to the client.' : 'Reports your studio sends appear here.'} />}
      {reports.map(report => {
        const snap = report.snapshot;
        const health = HEALTH[snap.health];
        return (
          <Card key={report._id}>
            <RowBetween><Title>{shortDate(report.weekStart)} to {shortDate(report.weekEnd)}</Title>
              {manage ? <Pill text={report.status === 'sent' ? 'Sent' : 'Draft'} tone={report.status === 'sent' ? 'ok' : 'blue'} /> : health ? <Pill text={health.label} tone={health.tone} /> : null}</RowBetween>
            <RowBetween><Muted>Progress {Math.round(snap.progressPct)}% · planned {Math.round(snap.plannedPct)}%</Muted>{manage && health ? <Pill text={health.label} tone={health.tone} /> : null}</RowBetween>
            <Bar pct={snap.progressPct} tone="terra" />
            <List title="Completed this week" rows={snap.completed} />
            <List title="In progress" rows={snap.inProgress.map(a => `${a.name} (${Math.round(a.progressPct)}%)`)} />
            <List title="Coming up" rows={snap.next} />
            <List title="Decisions" rows={snap.decisions} />
            <List title="Delays" rows={snap.delays.map(d => `${labelOf(d.reason)}, ${d.days} day${d.days === 1 ? '' : 's'}${d.description ? `: ${d.description}` : ''}`)} />
            {!!report.note && <Body>Note: {report.note}</Body>}
            {manage && report.status !== 'sent' && (
              <Actions>
                <View style={{ flex: 1 }}><Btn small kind="ghost" label={report.note ? 'Edit note' : 'Add note'} disabled={!!busyId} onPress={() => setNoting(report)} /></View>
                <View style={{ flex: 1 }}><Btn small kind="green" label="Send to client" busy={busyId === report._id} onPress={() => confirmAction('Send this report?', 'The client sees it straight away. It contains no money details.', 'Send', () => void run(report._id, () => recordsApi.sendWeekly(m.id, report._id), 'Could not send the report.'), false)} /></View>
              </Actions>
            )}
            {manage && report.status !== 'sent' && <Btn small kind="danger" label="Delete draft" busy={busyId === `d${report._id}`} onPress={() => confirmAction('Delete this draft?', 'You can generate it again.', 'Delete', () => void run(`d${report._id}`, () => recordsApi.deleteWeekly(m.id, report._id), 'Could not delete the draft.'))} />}
            {report.sentAt && <Muted>Sent {shortDate(report.sentAt)}</Muted>}
          </Card>
        );
      })}
      <NoteSheet report={noting} onClose={() => setNoting(null)} submit={async note => { await recordsApi.noteWeekly(m.id, noting!._id, note); setNoting(null); await m.silentReload(); }} />
    </PmScreen>
  );
}

function List({ title, rows }: { title: string; rows: string[] }) {
  if (!rows.length) return null;
  return <View style={{ gap: 2 }}><SectionTitle>{title}</SectionTitle>{rows.map((row, index) => <Body key={`${row}-${index}`}>• {row}</Body>)}</View>;
}

function NoteSheet({ report, onClose, submit }: { report: WeeklyReport | null; onClose: () => void; submit: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [seen, setSeen] = useState('');
  if (report && report._id !== seen) { setSeen(report._id); setNote(report.note || ''); }
  if (!report && seen) setSeen('');
  return (
    <FormSheet visible={!!report} title="Note for the client" eyebrow="WEEKLY REPORT" submitLabel="Save note" onClose={onClose} submit={async () => { await submit(note.trim()); }}>
      <Field label="Note" value={note} onChangeText={setNote} multiline maxLength={1000} />
    </FormSheet>
  );
}
