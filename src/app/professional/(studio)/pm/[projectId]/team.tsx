import { useState } from 'react';
import { View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, labelOf, optionsOf, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Chips, Empty, HeaderAction, Muted, Pill, PmScreen, SectionTitle } from '../../../../../components/pm/PmUi';
import { pmApi } from '../../../../../lib/pm/api';
import { TEAM_ROLES, recordsApi } from '../../../../../lib/pm/records';

const ABOUT: Record<string, string> = {
  manager: 'Plan, money, changes, expenses and reports.', designer: 'Documents, selections and notes. No money.', supervisor: 'Site updates, quality, snags and manpower. No money.', accounts: 'Payments, invoices and expenses.',
};

// Project team: who on the studio side can work on this project, and what each role can do. Only the studio owner manages it.
export default function TeamScreen() {
  const m = usePmModule(id => pmApi.overview(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [inviting, setInviting] = useState(false);
  const [changing, setChanging] = useState<{ userId: string; name: string; role: string } | null>(null);
  const isOwner = m.role === 'owner';
  const team = m.payload?.team || [];

  return (
    <PmScreen title="Project team" subtitle={team.length ? `${team.length} member${team.length === 1 ? '' : 's'}` : undefined}
      right={isOwner ? <HeaderAction icon="plus" label="Add a team member" onPress={() => setInviting(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {!isOwner && m.payload && <Alert tone="info" text="Only the studio owner can add or remove team members." />}
      {m.payload && team.length === 0 && <Empty title="Just you for now" text="Add a project manager, designer, site supervisor or accounts person. They must already have a KraftNex professional account." />}
      {team.map((member, index) => (
        <Card key={`${member.userId || member.name}-${index}`}>
          <RowBetween><Title>{member.name}</Title><Pill text={labelOf(member.role)} tone="gray" /></RowBetween>
          {!!ABOUT[member.role] && <Muted>{ABOUT[member.role]}</Muted>}
          {isOwner && member.userId && member.role !== 'owner' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Btn small kind="ghost" label="Change role" disabled={!!busyId} onPress={() => setChanging({ userId: member.userId!, name: member.name, role: member.role })} /></View>
              <View style={{ flex: 1 }}><Btn small kind="danger" label="Remove" busy={busyId === member.userId} onPress={() => confirmAction('Remove from this project?', `${member.name} will no longer see it.`, 'Remove', () => void run(member.userId!, () => recordsApi.setTeamRole(m.id, member.userId!, null), 'Could not remove this person.'))} /></View>
            </View>
          )}
        </Card>
      ))}
      <SectionTitle>Roles</SectionTitle>
      <Card>{TEAM_ROLES.map(role => <View key={role} style={{ paddingVertical: 2 }}><Body>{labelOf(role)}</Body><Muted>{ABOUT[role]}</Muted></View>)}</Card>

      <InviteSheet visible={inviting} onClose={() => setInviting(false)} submit={async (email, role) => { await recordsApi.inviteTeam(m.id, email, role); setInviting(false); await m.silentReload(); }} />
      <FormSheet visible={!!changing} title={changing?.name || ''} eyebrow="CHANGE ROLE" submitLabel="Save role" onClose={() => setChanging(null)} submit={async () => { await recordsApi.setTeamRole(m.id, changing!.userId, changing!.role); setChanging(null); await m.silentReload(); }}>
        <Chips value={changing?.role || ''} onChange={role => setChanging(current => (current ? { ...current, role } : current))} options={optionsOf(TEAM_ROLES)} />
        <Muted>{ABOUT[changing?.role || ''] || ''}</Muted>
      </FormSheet>
    </PmScreen>
  );
}

function InviteSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (email: string, role: string) => Promise<void> }) {
  const [email, setEmail] = useState(''); const [role, setRole] = useState<string>(TEAM_ROLES[0]);
  return (
    <FormSheet visible={visible} title="Add a team member" eyebrow="TEAM" submitLabel="Add to project" onClose={onClose} submit={async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter the email they signed up with on KraftNex.';
      await submit(email.trim().toLowerCase(), role);
      setEmail('');
    }}>
      <Field label="Their KraftNex email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <FieldLabel>Role</FieldLabel>
      <Chips value={role} onChange={setRole} options={optionsOf(TEAM_ROLES)} />
      <Muted>{ABOUT[role]}</Muted>
    </FormSheet>
  );
}
