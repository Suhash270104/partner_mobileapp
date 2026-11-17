import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import * as typeScale from '../../theme/typeScale';
import { fullNameOf, PartnerUser } from '../../lib/partnerApi';

const type = typeScale.type;

/** Who is signed in: avatar, name, email and phone. Workspaces are not listed here; the home screen already shows them. */
export function AccountSummary({ user }: { user: PartnerUser }) {
  const name = fullNameOf(user) || user.email || user.phone || 'Partner account';
  const initial = name.trim().slice(0, 1).toUpperCase();
  const contacts = [user.email, user.phone].filter((value): value is string => !!value && value !== name);
  return <View style={s.top}>
    <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
    <View style={s.who}>
      <Text style={s.name} numberOfLines={1}>{name}</Text>
      {contacts.map((value, index) => <Text key={`${index}:${value}`} style={s.contact} numberOfLines={1}>{value}</Text>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: type.stat, fontWeight: '800' },
  who: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: '#123b30', fontSize: type.title, fontWeight: '800' }, contact: { color: '#687a73', fontSize: type.body },
});
