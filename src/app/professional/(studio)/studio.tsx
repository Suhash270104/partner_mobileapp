import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { router } from 'expo-router';
import { partnerApi, ProfessionalProfileRecord } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';
import { STUDIO_SECTIONS } from '../../../components/studio/studioNav';

// Same split as the Clients screen: the balance is the total, of which the free welcome unlocks are
// counted separately and the rest comes from the plan or bought packs.
function creditSummary(record: Pick<ProfessionalProfileRecord, 'leadCredits' | 'bonusLeadCredits'>) {
  const total = typeof record.leadCredits === 'number' ? record.leadCredits : null;
  const free = typeof record.bonusLeadCredits === 'number' ? record.bonusLeadCredits : null;
  return { total, free, paid: total === null ? null : Math.max(0, total - (free ?? 0)) };
}

const sinceText = (iso?: string | null) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};

export default function StudioHubScreen() {
  const { profile, studioName } = useStudio();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  // The studio loaded when the app opened may be out of date after buying credits, so ask again.
  const [account, setAccount] = useState<ProfessionalProfileRecord>(profile);

  const loadAccount = useCallback(async () => {
    try { setAccount(await partnerApi.professionalProfile()); } catch { /* keeps the figures from sign-in */ }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void loadAccount(); }, 0);
    return () => clearTimeout(timer);
  }, [loadAccount]);

  const credits = creditSummary(account);
  const plan = account.subscriptionTier || 'Free';
  const since = sinceText(account.subscriptionStartDate);

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await partnerApi.logout();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <View style={s.heroAvatar}><Text style={s.heroAvatarText}>{(studioName.trim()[0] || 'K').toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroName} numberOfLines={2}>{studioName || 'Your studio'}</Text>
          <Text style={s.heroSub}>{profile.isApproved === false ? 'Pending approval' : 'Verified professional'}{profile.city ? ` · ${profile.city}` : ''}</Text>
        </View>
      </View>

      <View style={[s.card, s.planCard]}>
        <View style={s.planTop}>
          <View style={s.glyphBox}><Icon name="zap" size={19} color={c.green} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{credits.total === null ? '—' : credits.total} Credits Left</Text>
            <Text style={s.hint}>
              {credits.total === null ? 'Lead credits unlock client projects.' : `${credits.free ?? 0} free unlock${credits.free === 1 ? '' : 's'} · ${credits.paid ?? 0} plan or pack credit${credits.paid === 1 ? '' : 's'}`}
            </Text>
          </View>
          <View style={s.planBadge}><Text style={s.planBadgeText}>{plan.toUpperCase()}</Text></View>
        </View>
        <Text style={s.planLine}>
          {plan === 'Free' ? 'You are on the Free plan.' : `${plan} plan${account.billingInterval ? ` · billed ${account.billingInterval}` : ''}${since ? ` · since ${since}` : ''}`}
        </Text>
        <View style={s.planActions}>
          <Pressable style={[s.planBtn, s.planBtnSolid]} onPress={() => router.navigate('/professional/credits' as never)} accessibilityRole="button"><Text style={s.planBtnSolidText}>{plan === 'Free' ? 'Upgrade / buy credits' : 'Manage plan & credits'}</Text></Pressable>
          <Pressable style={s.planBtn} onPress={() => router.navigate('/professional/credit-history' as never)} accessibilityRole="button"><Text style={s.planBtnText}>History</Text></Pressable>
        </View>
      </View>

      <Pressable style={[s.card, s.row, { marginTop: 12 }]} onPress={() => router.navigate('/professional/profile' as never)} accessibilityRole="button">
        <View style={s.glyphBox}><Icon name="edit" size={19} color={c.green} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Edit profile</Text>
          <Text style={s.hint}>Update your studio details and portfolio</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>

      {STUDIO_SECTIONS.map(group => (
        <View key={group.group}>
          <Text style={s.group}>{group.group.toUpperCase()}</Text>
          <View style={s.card}>
            {group.items.map((item, index) => (
              <Pressable
                key={item.key}
                disabled={!item.built}
                style={[s.row, index > 0 && s.rowBorder, !item.built && { opacity: 0.45 }]}
                onPress={() => router.navigate(item.path as never)}
              >
                <View style={s.glyphBox}><Icon name={item.glyph} size={19} color={c.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{item.label}</Text>
                  <Text style={s.hint}>{item.hint}</Text>
                </View>
                <Text style={s.chevron}>{item.built ? '›' : 'Soon'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {!!error && <ErrorText>{error}</ErrorText>}
      <Pressable style={s.signOut} onPress={() => void signOut()} disabled={signingOut}>
        <Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.green, borderRadius: 20, padding: 16 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroSub: { color: '#bfe0cf', fontSize: 12.5, marginTop: 2 },
  group: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  glyphBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  glyph: { color: c.green, fontSize: 17, fontWeight: '800' },
  planCard: { marginTop: 12, padding: 14, gap: 10 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBadge: { backgroundColor: c.amberSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  planBadgeText: { color: c.amber, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  planLine: { color: c.body, fontSize: 12.5 },
  planActions: { flexDirection: 'row', gap: 8 },
  planBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  planBtnSolid: { flex: 2, backgroundColor: c.green, borderColor: c.green },
  planBtnText: { color: c.ink, fontSize: 12.5, fontWeight: '800' },
  planBtnSolidText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  label: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  hint: { color: c.muted, fontSize: 11.5, marginTop: 1 },
  chevron: { color: c.muted, fontSize: 13, fontWeight: '700' },
  signOut: { marginTop: 26, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#e6c3bf', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  signOutText: { color: c.red, fontSize: 13.5, fontWeight: '800' },
});
