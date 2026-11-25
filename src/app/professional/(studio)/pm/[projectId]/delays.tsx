import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Text } from '../../../../../components/AppText';
import { Actions, Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, labelOf, optionsOf, useRunner, usePmModule, wholeNumber } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Chips, Empty, HeaderAction, Muted, Pill, PmScreen, SectionTitle, Tone, pm, shortDate } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { DELAY_REASONS, LEVELS, recordsApi, type Risk } from '../../../../../lib/pm/records';

type Tab = 'delays' | 'risks';
const RISK_TONE: Record<Risk['status'], Tone> = { open: 'warn', mitigated: 'blue', closed: 'ok' };

// Delays and risks: why dates slipped, and what could slip next. Delays can be shared with the client for acknowledgement.
export default function DelaysScreen() {
  const m = usePmModule(async id => {
    const delays = await recordsApi.delays(id);
    const risks = await recordsApi.risks(id).catch(() => ({ risks: [] as Risk[] })); // risks are internal: clients get 403
    return { delays, risks: risks.risks };
  });
  const { run, busyId, error } = useRunner(m.silentReload);
  const [tab, setTab] = useState<Tab>('delays');
  const [addingDelay, setAddingDelay] = useState(false);
  const [addingRisk, setAddingRisk] = useState(false);
  const manage = can(m.role, 'delay.manage');
  const canRisk = can(m.role, 'risk.manage');
  const delays = m.payload?.delays.delays || [];
  const risks = m.payload?.risks || [];

  return (
    <PmScreen title="Delays & risks" subtitle={m.payload ? `${m.payload.delays.totalDays} day${m.payload.delays.totalDays === 1 ? '' : 's'} lost so far` : undefined}
      right={(tab === 'delays' ? manage : canRisk) ? <HeaderAction icon="plus" label={tab === 'delays' ? 'Log a delay' : 'Add a risk'} onPress={() => (tab === 'delays' ? setAddingDelay(true) : setAddingRisk(true))} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {canRisk && <Chips<Tab> value={tab} onChange={setTab} options={[{ key: 'delays', label: `Delays ${delays.length}` }, { key: 'risks', label: `Risks ${risks.length}` }]} />}

      {tab === 'delays' && (
        <>
          {m.payload && delays.length === 0 && <Empty title="No delays logged" text="When something pushes the schedule, log the reason and days so the new date is explained." />}
          {delays.map(delay => (
            <Card key={delay._id}>
              <RowBetween><Title>{labelOf(delay.reason)} · {delay.days} day{delay.days === 1 ? '' : 's'}</Title>{delay.onCriticalPath ? <Pill text="Critical path" tone="bad" /> : null}</RowBetween>
              {!!delay.description && <Body>{delay.description}</Body>}
              <Muted>{[delay.createdAt ? shortDate(delay.createdAt) : '', delay.clientVisible ? 'Shared with client' : ''].filter(Boolean).join(' · ')}</Muted>
              {delay.ackRequested && (delay.ackAt ? <Pill text={`Client acknowledged ${shortDate(delay.ackAt)}`} tone="ok" /> : can(m.role, 'delay.ack')
                ? <Btn small kind="green" label="Acknowledge" busy={busyId === delay._id} onPress={() => void run(delay._id, () => recordsApi.ackDelay(m.id, delay._id), 'Could not acknowledge this delay.')} />
                : <Pill text="Waiting for client to acknowledge" tone="warn" />)}
              {manage && <Btn small kind="ghost" label="Delete" busy={busyId === `x${delay._id}`} onPress={() => confirmAction('Delete this delay?', 'It is removed from the log.', 'Delete', () => void run(`x${delay._id}`, () => recordsApi.deleteDelay(m.id, delay._id), 'Could not delete this delay.'))} />}
            </Card>
          ))}
        </>
      )}

      {tab === 'risks' && canRisk && (
        <>
          {m.payload && risks.length === 0 && <Empty title="No risks logged" text="Note what could go wrong and how you plan to deal with it." />}
          {risks.map(risk => (
            <Card key={risk._id}>
              <RowBetween><Title>{risk.title}</Title><Pill text={labelOf(risk.status)} tone={RISK_TONE[risk.status]} /></RowBetween>
              <Muted>{[risk.likelihood ? `Likelihood ${risk.likelihood}` : '', risk.impact ? `Impact ${risk.impact}` : ''].filter(Boolean).join(' · ')}</Muted>
              {!!risk.mitigation && <Body>{risk.mitigation}</Body>}
              <Actions>
                {risk.status !== 'mitigated' && risk.status !== 'closed' && <View style={{ flex: 1 }}><Btn small kind="ghost" label="Mark mitigated" busy={busyId === risk._id} onPress={() => void run(risk._id, () => recordsApi.setRiskStatus(m.id, risk._id, 'mitigated'), 'Could not update this risk.')} /></View>}
                {risk.status !== 'closed' && <View style={{ flex: 1 }}><Btn small kind="green" label="Close" busy={busyId === risk._id} onPress={() => void run(risk._id, () => recordsApi.setRiskStatus(m.id, risk._id, 'closed'), 'Could not update this risk.')} /></View>}
                {risk.status === 'closed' && <View style={{ flex: 1 }}><Btn small kind="ghost" label="Re-open" busy={busyId === risk._id} onPress={() => void run(risk._id, () => recordsApi.setRiskStatus(m.id, risk._id, 'open'), 'Could not update this risk.')} /></View>}
              </Actions>
            </Card>
          ))}
        </>
      )}
      {tab === 'delays' && delays.length > 0 && <SectionTitle>{' '}</SectionTitle>}

      <DelaySheet visible={addingDelay} onClose={() => setAddingDelay(false)} submit={async body => { await recordsApi.addDelay(m.id, body); setAddingDelay(false); await m.silentReload(); }} />
      <RiskSheet visible={addingRisk} onClose={() => setAddingRisk(false)} submit={async body => { await recordsApi.addRisk(m.id, body); setAddingRisk(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <RowBetween><Text style={{ color: pm.ink, fontSize: 12.5, fontWeight: '700', flex: 1 }}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: '#CFC9B8', true: pm.ok }} thumbColor="#fff" /></RowBetween>;
}

function DelaySheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { reason: string; days: number; description: string; onCriticalPath: boolean; clientVisible: boolean; ackRequested: boolean }) => Promise<void> }) {
  const [reason, setReason] = useState<string>(DELAY_REASONS[0]); const [days, setDays] = useState(''); const [description, setDescription] = useState('');
  const [critical, setCritical] = useState(false); const [shared, setShared] = useState(true); const [ack, setAck] = useState(false);
  return (
    <FormSheet visible={visible} title="Log a delay" eyebrow="DELAYS" submitLabel="Log delay" onClose={onClose} submit={async () => {
      const n = wholeNumber(days);
      if (n === undefined || n < 1 || n > 365) return 'Enter how many days were lost (1 to 365).';
      if (!description.trim()) return 'Say what happened.';
      await submit({ reason, days: n, description: description.trim(), onCriticalPath: critical, clientVisible: shared, ackRequested: shared && ack });
      setDays(''); setDescription('');
    }}>
      <FieldLabel>Reason</FieldLabel>
      <Chips value={reason} onChange={setReason} options={optionsOf(DELAY_REASONS)} />
      <Field label="Days lost" value={days} onChangeText={setDays} keyboardType="number-pad" />
      <Field label="What happened" value={description} onChangeText={setDescription} multiline maxLength={500} />
      <Toggle label="On the critical path (moves the handover date)" value={critical} onChange={setCritical} />
      <Toggle label="Share with the client" value={shared} onChange={setShared} />
      {shared && <Toggle label="Ask the client to acknowledge" value={ack} onChange={setAck} />}
    </FormSheet>
  );
}

function RiskSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { title: string; likelihood: string; impact: string; mitigation?: string }) => Promise<void> }) {
  const [title, setTitle] = useState(''); const [likelihood, setLikelihood] = useState<string>('medium'); const [impact, setImpact] = useState<string>('medium'); const [mitigation, setMitigation] = useState('');
  return (
    <FormSheet visible={visible} title="Add a risk" eyebrow="RISKS" submitLabel="Add risk" onClose={onClose} submit={async () => {
      if (!title.trim()) return 'Describe the risk.';
      await submit({ title: title.trim(), likelihood, impact, ...(mitigation.trim() ? { mitigation: mitigation.trim() } : {}) });
      setTitle(''); setMitigation('');
    }}>
      <Field label="Risk" value={title} onChangeText={setTitle} placeholder="Tile delivery may slip past 25 Nov" maxLength={200} />
      <FieldLabel>Likelihood</FieldLabel>
      <Chips value={likelihood} onChange={setLikelihood} options={optionsOf(LEVELS)} />
      <FieldLabel>Impact</FieldLabel>
      <Chips value={impact} onChange={setImpact} options={optionsOf(LEVELS)} />
      <Field label="What you will do about it (optional)" value={mitigation} onChangeText={setMitigation} multiline maxLength={500} />
    </FormSheet>
  );
}
