import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { router } from 'expo-router';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';

interface Prefs { notifLeads: boolean; notifMessages: boolean; autoAcceptBookings: boolean }

export default function SettingsScreen() {
  const { profile, studioName, ownerName } = useStudio();
  const record = profile as { approvalStatus?: string; email?: string; createdAt?: string; tier?: string; membershipLevel?: string; notificationPreferences?: Partial<Prefs> };
  const approval = record.approvalStatus || (profile.isApproved ? 'approved' : 'pending');
  const stored = record.notificationPreferences;
  const [prefs, setPrefs] = useState<Prefs>({ notifLeads: stored?.notifLeads ?? true, notifMessages: stored?.notifMessages ?? true, autoAcceptBookings: stored?.autoAcceptBookings ?? false });
  const [error, setError] = useState('');
  const [hasTechnician, setHasTechnician] = useState(false);

  useEffect(() => {
    let cancelled = false;
    partnerApi.session().then(
      session => { if (!cancelled) setHasTechnician(Boolean(session.user?.roles?.some(role => role.type === 'technician'))); },
      () => undefined,
    );
    return () => { cancelled = true; };
  }, []);

  async function change(key: keyof Prefs, value: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setError('');
    try {
      await partnerApi.updateStudioProfile({ notificationPreferences: next });
    } catch (e) {
      setPrefs(previous);
      setError(e instanceof Error ? e.message : 'Unable to save preference');
    }
  }

  const since = record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—';
  const rows: [string, string][] = [['Owner', ownerName || '—'], ['Email', record.email || '—'], ['Studio Since', since], ['Plan', record.tier || record.membershipLevel || 'Standard']];
  const toggles: [keyof Prefs, string, string][] = [
    ['notifLeads', 'New Leads', 'Email & push when a matching lead appears'],
    ['notifMessages', 'Messages', 'Notify on new client messages'],
    ['autoAcceptBookings', 'Auto-Accept Bookings', 'Confirm meeting requests automatically'],
  ];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <Text style={s.title}>Settings</Text>
      <Text style={s.sub}>Studio preferences and account controls for {studioName || 'your studio'}.</Text>

      {approval !== 'approved' && (
        <View style={[s.banner, approval === 'rejected' && { backgroundColor: c.redSoft, borderColor: '#ecd3d3' }]}>
          <Text style={[s.bannerTitle, approval === 'rejected' && { color: c.red }]}>{approval === 'rejected' ? 'Studio Application Not Approved' : 'Studio Verification: Pending Review'}</Text>
          <Text style={[s.bannerCopy, approval === 'rejected' && { color: c.red }]}>
            {approval === 'rejected' ? 'Your studio application was not approved. Contact support for details.' : 'Your studio is already visible to clients while our team completes admin review — this usually finishes within 24-48 hours.'}
          </Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>Notifications</Text>
        {!!error && <ErrorText>{error}</ErrorText>}
        {toggles.map(([key, label, hint]) => (
          <View key={key} style={s.toggleRow}>
            <View style={{ flex: 1 }}><Text style={s.rowTitle}>{label}</Text><Text style={s.hint}>{hint}</Text></View>
            <Switch value={prefs[key]} onValueChange={value => void change(key, value)} trackColor={{ true: c.green, false: '#cfd8d3' }} thumbColor="#fff" />
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>9-Stage Profile DNA</Text>
        <Text style={s.hint}>Re-run your studio&apos;s onboarding to refresh how KAI matches you to new briefs — style, budget range, team size, and more.</Text>
        <Pressable style={s.solid} onPress={() => router.push({ pathname: '/professional/onboarding', params: { edit: 'true' } } as never)}><Text style={s.solidText}>Edit Profile DNA  →</Text></Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Account</Text>
        {rows.map(([label, value]) => <View key={label} style={s.accountRow}><Text style={s.hint}>{label}</Text><Text style={s.rowTitle}>{value}</Text></View>)}
      </View>

      {hasTechnician && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Workspace Switcher</Text>
          <Text style={s.hint}>Switch to your Technician workspace without signing out.</Text>
          <Pressable style={s.solid} onPress={() => router.push('/technician/setup')}><Text style={s.solidText}>Switch to Technician Workspace  →</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13, lineHeight: 19 },
  banner: { backgroundColor: c.amberSoft, borderRadius: 16, borderWidth: 1, borderColor: '#efd9a3', padding: 14, gap: 4 },
  bannerTitle: { color: c.amber, fontSize: 13, fontWeight: '800' },
  bannerCopy: { color: '#7a652a', fontSize: 12.5, lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  hint: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  solid: { height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
