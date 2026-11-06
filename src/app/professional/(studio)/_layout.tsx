import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Slot, usePathname } from 'expo-router';
import { partnerApi, PartnerApiError } from '../../../lib/partnerApi';
import { isProfileComplete } from '../../../lib/professionalOnboarding';
import { c } from '../../../components/professional/onboardingUi';
import { StudioContext, StudioProfile } from '../../../components/studio/StudioContext';
import { activeTabKey, TAB_BAR } from '../../../components/studio/studioNav';

type Phase = 'loading' | 'ready' | 'error';

// Shell for every studio dashboard section: signs the studio in, then keeps the same header and
// bottom bar on every page. Studios that have not finished onboarding are sent back to it.
export default function StudioLayout() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<StudioProfile | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setPhase('loading');
    try {
      const session = await partnerApi.session();
      if (!session.user) {
        router.replace('/');
        return;
      }
      const record = await partnerApi.professionalProfile();
      if (!isProfileComplete(record)) {
        router.replace('/professional/onboarding');
        return;
      }
      setProfile(record as StudioProfile);
      setPhase('ready');
    } catch (e) {
      if (e instanceof PartnerApiError && e.status === 401) {
        router.replace('/');
        return;
      }
      if (e instanceof PartnerApiError && e.status === 404) {
        router.replace('/professional/onboarding');
        return;
      }
      if (silent) return;
      setError(e instanceof Error ? e.message : 'Could not load your studio.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const value = useMemo(() => {
    if (!profile) return null;
    const onboarding = (profile.onboardingData || {}) as { businessName?: string };
    const studioName = onboarding.businessName || profile.businessName || profile.companyName || profile.name || '';
    return {
      profile,
      studioName,
      ownerName: profile.name || '',
      refresh: () => load(true),
      patchProfile: (fields: Partial<StudioProfile>) => setProfile(previous => (previous ? { ...previous, ...fields } : previous)),
    };
  }, [profile, load]);

  if (phase !== 'ready' || !value) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          {phase === 'loading' ? <ActivityIndicator color={c.green} size="large" /> : (
            <>
              <Text style={s.errorTitle}>Couldn&apos;t load your studio</Text>
              <Text style={s.errorCopy}>{error}</Text>
              <Pressable style={s.retry} onPress={() => void load()}><Text style={s.retryText}>Try again</Text></Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const activeKey = activeTabKey(pathname);
  const initial = (value.studioName.trim()[0] || 'K').toUpperCase();

  return (
    <StudioContext.Provider value={value}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <View style={s.brand}>
            <Image source={require('../../../../assets/kraftnex-logo-transparent.png')} style={s.logo} resizeMode="contain" />
            <View style={s.pill}><Text style={s.pillText}>STUDIO PRO</Text></View>
          </View>
          <Pressable style={s.avatar} onPress={() => router.navigate('/professional/studio' as never)} accessibilityLabel="Open studio menu">
            <Text style={s.avatarText}>{initial}</Text>
          </Pressable>
        </View>

        <View style={s.body}><Slot /></View>

        <View style={s.bar}>
          {TAB_BAR.map(tab => {
            const active = tab.key === activeKey;
            return (
              <Pressable key={tab.key} style={s.tab} onPress={() => router.navigate(tab.path as never)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Text style={[s.glyph, active && s.glyphOn]}>{tab.glyph}</Text>
                <Text style={[s.tabLabel, active && s.tabLabelOn]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </StudioContext.Provider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errorTitle: { color: c.ink, fontSize: 18, fontWeight: '800' },
  errorCopy: { color: c.body, fontSize: 13.5, textAlign: 'center' },
  retry: { marginTop: 8, height: 46, paddingHorizontal: 26, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  header: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 92, height: 27 },
  pill: { backgroundColor: c.amberSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  pillText: { color: c.amber, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  body: { flex: 1 },
  bar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  glyph: { fontSize: 19, color: '#9aa8a1' },
  glyphOn: { color: c.green },
  tabLabel: { fontSize: 10.5, fontWeight: '700', color: '#9aa8a1' },
  tabLabelOn: { color: c.green },
});
