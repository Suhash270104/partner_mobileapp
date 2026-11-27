import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '../../../../../components/AppText';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField, parseDate } from '../../../../../components/studio/DateTimeFields';
import {
  Alert, Bar, Btn, Card, Chips, HEALTH, Muted, Pill, PmScreen, SectionTitle, STAGES, errorText, goBack, inr, isoFromField, pm, shortDate, stageLabel, todayField, usePmLoad,
} from '../../../../../components/pm/PmUi';
import { canSeeMoney, pmApi, type PmOverview } from '../../../../../lib/pm/api';
import { can } from '../../../../../lib/pm/permissions';
import { FormSheet } from '../../../../../components/pm/PmKit';
import type { ExecutionStage } from '../../../../../lib/pm/api';

// Project home: stage, health, progress, what needs attention and the way into every part of the workspace.
export default function ProjectHomeScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = String(projectId || '');
  const { data, error, loading, refreshing, reload, silentReload } = usePmLoad(() => pmApi.overview(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [stageOpen, setStageOpen] = useState(false);
  const [stagePick, setStagePick] = useState<ExecutionStage>('planning');
  const [stageReason, setStageReason] = useState('');

  const exec = data?.execution;
  const health = HEALTH[exec?.health || ''];
  const title = data?.project?.title || 'Project';
  const subtitle = [data?.project?.clientName, data?.project?.location].filter(Boolean).join(' · ');
  const money = canSeeMoney(data?.role);

  const open = (path: string) => router.push(`/professional/pm/${id}/${path}` as never);
  const openClassic = (tab: string) => router.push({ pathname: '/professional/pm/classic', params: { projectId: id, tab } } as never);
  // The server says where an attention item points; anything we have no screen for yet stays on this page.
  const goTarget = (target: string) => {
    if (target === 'money' || target === 'payments') open('money');
    else if (target === 'plan' || target === 'activities') open('plan');
    else if (target === 'changes') open('changes');
  };

  async function requestHandover() {
    setBusy(true); setActionError('');
    try { await pmApi.requestHandover(id); await silentReload(); } catch (e) { setActionError(errorText(e, 'Could not request the handover sign-off.')); } finally { setBusy(false); }
  }

  const hero = data?.started && exec ? (
    <View style={s.hero}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle} numberOfLines={2}>{title}</Text>
          {!!subtitle && <Text style={s.heroSub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {health && <Pill text={`● ${health.label}`} tone={health.tone} />}
      </View>
      <View style={s.stepper}>
        {STAGES.map((stage, index) => <View key={stage} style={[s.step, index <= STAGES.indexOf(exec.stage as (typeof STAGES)[number]) && s.stepOn]} />)}
      </View>
      <Text style={s.heroSub}>Stage: {stageLabel(exec.stage)}{exec.baselineEnd ? ` · Handover ${shortDate(exec.projectedEnd || exec.baselineEnd)}` : ''}</Text>
    </View>
  ) : undefined;

  return (
    <PmScreen title={data?.started ? 'Project' : title} subtitle={data?.started ? undefined : subtitle || undefined} hero={hero}
      loading={loading} error={error} refreshing={refreshing} onRefresh={() => void reload()}>
      {!!actionError && <Alert tone="bad" text={actionError} />}
      {data && !data.started && <StartCard id={id} role={data.role} onStarted={() => void silentReload()} />}

      {data?.started && exec && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={s.big}>{Math.round(exec.progressPct ?? 0)}%</Text>
              <Muted>done{typeof exec.plannedPct === 'number' ? ` · planned ${Math.round(exec.plannedPct)}%` : ''}</Muted>
            </View>
            <Bar pct={exec.progressPct ?? 0} tone="terra" />
          </Card>

          {money && data.money && (
            <Card onPress={() => open('money')}>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Muted>Contract value</Muted><Text style={s.value}>{inr(data.money.contractValuePaise)}</Text></View>
                <View style={{ flex: 1 }}><Muted>Received</Muted><Text style={[s.value, { color: pm.ok }]}>{inr(data.money.receivedPaise)}</Text></View>
              </View>
              <Bar pct={data.money.contractValuePaise ? (data.money.receivedPaise / data.money.contractValuePaise) * 100 : 0} />
            </Card>
          )}

          {(data.attention || []).map((item, index) => (
            <Alert key={`${item.type}-${item.entityId || index}`} tone={item.severity === 'high' ? 'bad' : 'warn'} text={item.title}
              action={['money', 'payments', 'plan', 'activities', 'changes'].includes(item.target) ? { label: 'Open', onPress: () => goTarget(item.target) } : undefined} />
          ))}

          {can(data.role, 'stage.edit') && <Btn label={`Stage: ${stageLabel(exec.stage)} · change`} kind="ghost" onPress={() => { setStagePick(exec.stage); setStageReason(''); setStageOpen(true); }} />}
          {exec.stage === 'handover' && !exec.handoverRequestedAt && !exec.handoverAt && ['owner', 'manager'].includes(data.role) && (
            <Btn label="Ask the client to sign off the handover" kind="green" busy={busy} onPress={() => void requestHandover()} />
          )}
          {!!exec.handoverRequestedAt && !exec.handoverAt && <Alert tone="info" text="Handover sign-off requested. Waiting for the client." />}
          {!!exec.handoverAt && <Alert tone="info" text={`Handed over and signed off on ${shortDate(exec.handoverAt)}.`} />}

          <SectionTitle>Plan & site</SectionTitle>
          <View style={s.grid}>
            <Tile glyph="🗓" label="Plan" onPress={() => open('plan')} />
            <Tile glyph="☑" label="Tasks & site" onPress={() => openClassic('tasks')} />
            <Tile glyph="✔" label="Quality" onPress={() => open('quality')} />
            <Tile glyph="👷" label="Manpower" onPress={() => open('manpower')} />
            <Tile glyph="⏱" label="Delays" onPress={() => open('delays')} />
          </View>
          <SectionTitle>Money</SectionTitle>
          <View style={s.grid}>
            {money && <Tile glyph="₹" label="Payments" onPress={() => open('money')} />}
            {can(data.role, 'invoice.view') && <Tile glyph="🧾" label="Invoices" onPress={() => open('invoices')} />}
            <Tile glyph="🔁" label="Changes" onPress={() => open('changes')} />
            {can(data.role, 'expense.add') && <Tile glyph="💳" label="Expenses" onPress={() => open('expenses')} />}
            <Tile glyph="📑" label="Quotations" onPress={() => openClassic('quotations')} />
            <Tile glyph="📦" label="Procurement" onPress={() => openClassic('procurement')} />
          </View>
          <SectionTitle>Design & decisions</SectionTitle>
          <View style={s.grid}>
            <Tile glyph="🎨" label="Selections" onPress={() => open('selections')} />
            <Tile glyph="📝" label="Notes" onPress={() => open('notes')} />
            <Tile glyph="🧭" label="Decisions" onPress={() => open('decisions')} />
          </View>
          <SectionTitle>Handover & reports</SectionTitle>
          <View style={s.grid}>
            <Tile glyph="🏁" label="Snags" onPress={() => open('snags')} />
            <Tile glyph="🛡" label="Warranty" onPress={() => open('warranty')} />
            <Tile glyph="📊" label="Weekly report" onPress={() => open('reports')} />
            <Tile glyph="📈" label="Summary" onPress={() => openClassic('report')} />
          </View>
          <SectionTitle>People</SectionTitle>
          <View style={s.grid}>
            <Tile glyph="👥" label="Team" onPress={() => open('team')} />
            <Tile glyph="💬" label="Client & chat" onPress={() => openClassic('client')} />
          </View>

          {!!data.inProgress?.length && (
            <>
              <SectionTitle right={<Pressable onPress={() => open('plan')}><Text style={s.link}>See plan</Text></Pressable>}>In progress</SectionTitle>
              <Card>
                {data.inProgress.slice(0, 5).map(activity => (
                  <View key={activity._id} style={{ gap: 4, paddingVertical: 4 }}>
                    <View style={s.row}><Text style={s.name} numberOfLines={1}>{activity.name}</Text><Muted>{Math.round(activity.progressPct)}%</Muted></View>
                    <Bar pct={activity.progressPct} />
                  </View>
                ))}
              </Card>
            </>
          )}

          {!!data.latest?.length && (
            <>
              <SectionTitle>Latest updates</SectionTitle>
              <Card>
                {data.latest.slice(0, 5).map((update, index) => (
                  <View key={`${update.at}-${index}`} style={{ paddingVertical: 3 }}>
                    <Text style={s.name}>{update.text}</Text>
                    <Muted>{shortDate(update.at)}</Muted>
                  </View>
                ))}
              </Card>
            </>
          )}

          {!!data.team?.length && (
            <>
              <SectionTitle>Team</SectionTitle>
              <Card>
                {data.team.map((member, index) => (
                  <View key={`${member.name}-${index}`} style={s.row}><Text style={s.name}>{member.name}</Text><Pill text={stageLabel(member.role)} tone="gray" /></View>
                ))}
              </Card>
            </>
          )}
        </>
      )}
      <FormSheet visible={stageOpen} title="Project stage" eyebrow="STAGE" submitLabel="Save stage" onClose={() => setStageOpen(false)} submit={async () => {
        if (stagePick === exec?.stage) return 'Pick a different stage.';
        await pmApi.setStage(id, stagePick, stageReason.trim() || undefined); setStageOpen(false); await silentReload();
      }}>
        <Chips<ExecutionStage> value={stagePick} onChange={setStagePick} options={[...STAGES, 'on_hold', 'cancelled'].map(stage => ({ key: stage as ExecutionStage, label: stageLabel(stage) }))} />
        <Field label="Reason (optional)" value={stageReason} onChangeText={setStageReason} maxLength={300} />
      </FormSheet>
    </PmScreen>
  );
}

function Tile({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.tile} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={s.tileGlyph}>{glyph}</Text>
      <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// Shown until the plan exists: pick a template, dates and the contract value, then the server builds the scopes and activities.
function StartCard({ id, role, onStarted }: { id: string; role: PmOverview['role']; onStarted: () => void }) {
  const { data: templates } = usePmLoad(() => pmApi.templates(), []);
  const [templateKey, setTemplateKey] = useState('');
  const [startDate, setStartDate] = useState(todayField());
  const [handoverDate, setHandoverDate] = useState('');
  const [contract, setContract] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const list = templates?.templates || [];
  useEffect(() => { if (!templateKey && list.length) setTemplateKey(list[0].key); }, [list, templateKey]);

  if (!['owner', 'manager'].includes(role)) {
    return <Card><Text style={s.name}>The plan has not been set up yet</Text><Muted>The studio owner or project manager starts the plan. It will appear here once they do.</Muted></Card>;
  }

  async function start() {
    const start = isoFromField(startDate);
    if (!templateKey) { setError('Choose a template.'); return; }
    if (!start) { setError('Choose the start date.'); return; }
    const end = handoverDate ? isoFromField(handoverDate) : undefined;
    if (end && end < start) { setError('The handover date cannot be before the start date.'); return; }
    const value = contract.trim() ? Number(contract.replace(/,/g, '')) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) { setError('Enter the contract value in rupees, for example 385000.'); return; }
    setBusy(true); setError('');
    try {
      await pmApi.start(id, { templateKey, startDate: start, ...(end ? { handoverDate: end } : {}), ...(value !== undefined ? { contractValue: value } : {}) });
      onStarted();
    } catch (e) {
      setError(errorText(e, 'Could not start the project plan.'));
    } finally { setBusy(false); }
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text style={s.value}>Set up this project</Text>
      <Muted>Pick a template and the plan, activities and dates are created for you. You can edit everything afterwards.</Muted>
      <Chips value={templateKey} onChange={setTemplateKey} options={list.map(t => ({ key: t.key, label: t.label }))} />
      {!!templateKey && <Muted>{list.find(t => t.key === templateKey)?.activities ?? 0} activities in {list.find(t => t.key === templateKey)?.scopes ?? 0} scopes</Muted>}
      <DateField label="Start date" value={startDate} onChange={setStartDate} required />
      <DateField label="Planned handover (optional)" value={handoverDate} onChange={setHandoverDate} minDate={parseDate(startDate) || undefined} />
      <Field label="Contract value in rupees (optional)" value={contract} onChangeText={setContract} keyboardType="number-pad" placeholder="3850000" />
      {!!error && <Alert tone="bad" text={error} />}
      <Btn label="Start project plan" busy={busy} onPress={() => void start()} />
    </Card>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: pm.green2, borderRadius: 16, padding: 14, gap: 10 },
  heroTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroSub: { color: pm.onGreen, fontSize: 11.5 },
  stepper: { flexDirection: 'row', gap: 4 },
  step: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepOn: { backgroundColor: '#7FD1A5' },
  big: { color: pm.ink, fontSize: 26, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  value: { color: pm.ink, fontSize: 15, fontWeight: '800' },
  name: { color: pm.ink, fontSize: 12.5, fontWeight: '700', flex: 1 },
  link: { color: pm.terra, fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '23%', flexGrow: 1, minWidth: 74, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: pm.line, paddingVertical: 12, alignItems: 'center', gap: 4 },
  tileGlyph: { fontSize: 20 },
  tileLabel: { color: pm.ink, fontSize: 11, fontWeight: '700' },
});
