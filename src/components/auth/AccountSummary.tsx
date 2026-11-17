import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import * as typeScale from '../../theme/typeScale';
import { fullNameOf, PartnerRoleType, PartnerUser } from '../../lib/partnerApi';

const type = typeScale.type;

const STATUS_LABEL: Record<string, string> = { active: 'Active', pending: 'Pending approval', suspended: 'Suspended', rejected: 'Not approved' };
const NEUTRAL_TONE = { fg: '#4b5d56', bg: '#eef2f0' };
const STATUS_TONE: Record<string, { fg: string; bg: string }> = {
  active: { fg: '#0d6b4f', bg: '#e1f5ec' }, pending: { fg: '#8a6410', bg: '#fff2cb' },
  suspended: { fg: '#a7403c', bg: '#fff0ef' }, rejected: { fg: '#a7403c', bg: '#fff0ef' },
};

/** An unrecognised backend status still renders: "under_review" becomes "Under review". */
function statusText(status: unknown): string {
  const text = typeof status === 'string' ? status.replace(/[_-]+/g, ' ').trim() : '';
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

/** Who is signed in: avatar, name, email and phone, plus each workspace on the account with its status. */
export function AccountSummary({ user, roleTitles }: { user: PartnerUser; roleTitles: Partial<Record<PartnerRoleType, string>> }) {
  const name = fullNameOf(user) || user.email || user.phone || 'Partner account';
  const initial = name.trim().slice(0, 1).toUpperCase();
  const workspaces = (user.roles || []).filter(role => role.type !== 'customer' && roleTitles[role.type]);
  const contacts = [user.email, user.phone].filter((value): value is string => !!value && value !== name);
  return <View>
    <View style={s.top}>
      <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
      <View style={s.who}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        {contacts.map(value => <Text key={value} style={s.contact} numberOfLines={1}>{value}</Text>)}
      </View>
    </View>
    {workspaces.length ? <View style={s.list}>
      <Text style={s.heading}>Your workspaces</Text>
      {workspaces.map(role => {
        const tone = STATUS_TONE[role.status] ?? NEUTRAL_TONE;
        return <View key={role.type} style={s.row}>
          <Text style={s.roleTitle} numberOfLines={1}>{roleTitles[role.type]}</Text>
          <View style={[s.pill, { backgroundColor: tone.bg }]}><Text style={[s.pillText, { color: tone.fg }]}>{STATUS_LABEL[role.status] ?? statusText(role.status)}</Text></View>
        </View>;
      })}
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: type.stat, fontWeight: '800' },
  who: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: '#123b30', fontSize: type.title, fontWeight: '800' }, contact: { color: '#687a73', fontSize: type.body },
  list: { marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8ecea', gap: 10 },
  heading: { color: '#89948f', fontSize: type.caption, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  roleTitle: { flex: 1, color: '#183c31', fontSize: type.label, fontWeight: '700' },
  pill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }, pillText: { fontSize: type.caption, fontWeight: '800' },
});
