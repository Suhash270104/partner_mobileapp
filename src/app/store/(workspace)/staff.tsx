import { useState } from 'react';
import { router } from 'expo-router';
import { StaffInviteSheet } from '../../../components/marketplace/staff/StaffInviteSheet';
import { StatusBadge } from '../../../components/marketplace/StatusBadge';
import { Avatar, BottomSheet, EmptyState, ListRow, PillButton, Screen, SectionCard, SelectField, Text, palette } from '../../../components/ui';
import { confirmAction, useAction } from '../../../hooks/useAction';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { merchantApi } from '../../../lib/marketplace/api';
import { ROLE_LABELS, STAFF_ROLE_OPTIONS } from '../../../lib/marketplace/constants';
import type { StaffMember } from '../../../lib/marketplace/types';

const idOf = (member: StaffMember) => String(member.id ?? member._id ?? '');

/** Team & roles — owner only (hand-off §11, §12). Role and status changes take effect on the member's next request. */
export default function StaffScreen() {
  const { run, isBusy } = useAction();
  const { data: store, loading, error, reload, refresh, refreshing } = useAsyncData(() => merchantApi.store(), [], { refetchOnFocus: true });
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const members = (store?.staff ?? []).filter(m => m.role !== 'owner');

  const update = (member: StaffMember, input: Record<string, unknown>) => void run(`u:${idOf(member)}`, async () => { await merchantApi.updateStaff(idOf(member), input); setSelected(null); await refresh(); });
  const remove = async (member: StaffMember) => {
    if (!(await confirmAction('Remove team member?', `${member.fullName ?? member.name ?? 'This person'} will lose access to your store on their next request.`, 'Remove'))) return;
    void run(`r:${idOf(member)}`, async () => { await merchantApi.removeStaff(idOf(member)); setSelected(null); await refresh(); });
  };

  return <Screen title="Team & roles" subtitle="Who can manage your store" onBack={() => router.back()} loading={loading} error={error} onRetry={() => void reload()} refreshing={refreshing} onRefresh={() => void refresh()}
    action={<PillButton compact icon="userPlus" title="Invite" onPress={() => setInviting(true)} />}>
    <SectionCard title={`Members · ${members.length}`}>
      {members.length ? members.map(member => <ListRow key={idOf(member)} title={member.fullName ?? member.name ?? 'Team member'} detail={[ROLE_LABELS[member.role ?? ''] ?? member.role, member.phone].filter(Boolean).join(' · ')}
        trailing={<StatusBadge status={member.status ?? 'active'} />} onPress={() => setSelected(member)} />)
        : <EmptyState icon="users" title="Just you for now" message="Invite a manager, inventory specialist or fulfilment staff by mobile number." actionLabel="Invite team member" onAction={() => setInviting(true)} />}
    </SectionCard>

    <StaffInviteSheet visible={inviting} onClose={() => setInviting(false)} onInvited={() => void refresh()} />
    <BottomSheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.fullName ?? selected?.name ?? 'Team member'}>
      {selected ? <>
        <Avatar label={selected.fullName ?? selected.name ?? 'T'} size={52} dark={false} />
        <Text style={{ color: palette.body, fontSize: 14 }}>{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</Text>
        <SelectField label="Role" value={selected.role ?? 'manager'} options={STAFF_ROLE_OPTIONS} onChange={role => update(selected, { role })} />
        {selected.status === 'suspended'
          ? <PillButton variant="soft" icon="check" title="Reactivate" loading={isBusy(`u:${idOf(selected)}`)} onPress={() => update(selected, { status: 'active' })} />
          : <PillButton variant="soft" icon="lock" title="Suspend access" loading={isBusy(`u:${idOf(selected)}`)} onPress={() => update(selected, { status: 'suspended' })} />}
        <PillButton variant="danger" icon="trash" title="Remove from store" loading={isBusy(`r:${idOf(selected)}`)} onPress={() => void remove(selected)} />
      </> : null}
    </BottomSheet>
  </Screen>;
}
