import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AlertBanner, Icon, PillButton, Screen, Text, palette } from '../../components/ui';
import { AuthApiError, RealtorAccountType, authApi } from '../../lib/auth';
import { PartnerSession, partnerApi } from '../../lib/partnerApi';

const ROLES: { key: RealtorAccountType; title: string; copy: string }[] = [
  { key: 'individual_owner', title: 'Individual owner', copy: 'List your own property for sale or rent.' },
  { key: 'agent', title: 'Real estate agent', copy: 'Manage buyer leads and property listings.' },
  { key: 'builder', title: 'Builder', copy: 'Publish projects and residential developments.' },
  { key: 'developer', title: 'Developer', copy: 'Manage developments, projects and authorized agents.' },
];

const nameOf = (session: PartnerSession | null) => Object.values(session?.user?.profiles ?? {}).find(profile => profile?.name)?.name;

/**
 * Opens the realtor workspace on the person's one Kraftnex identity (no second account, no separate password).
 * Signed in → the realtor role is added to that identity. Signed out → mobile OTP with the realtor intent, which creates
 * the identity and the realtor role together (hand-off §3). Either way the next stop is realtor onboarding.
 */
export default function RealtorRegisterScreen() {
  const [role, setRole] = useState<RealtorAccountType | ''>('');
  const [session, setSession] = useState<PartnerSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const current = await partnerApi.session();
      setSession(current);
      // Already a realtor: nothing to register.
      if (current.user?.roles?.some(entry => entry.type === 'realtor')) router.replace('/realtor/dashboard' as never);
    } catch { setSession(null); }
    finally { setChecking(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void check(); }, [check]);

  const createRole = async () => {
    if (!role) { setError('Choose your seller role to continue.'); return; }
    setBusy(true); setError('');
    try {
      await authApi.addProfile('realtor', { accountType: role, ...(nameOf(session) ? { name: nameOf(session) } : {}) });
      router.replace('/realtor/onboarding' as never);
    } catch (cause) {
      // 409: this account already has a realtor profile, so just open it.
      if (cause instanceof AuthApiError && cause.status === 409) { router.replace('/realtor/dashboard' as never); return; }
      setError(cause instanceof Error ? cause.message : 'Could not create your realtor account.');
    } finally { setBusy(false); }
  };

  const signedIn = !!session?.user;
  return <Screen standalone title="Kraftnex Realty" subtitle="Choose how you will sell, then continue." onBack={() => router.back()}>
    {checking ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={palette.green} /></View> : <>
      <View style={{ gap: 12 }}>{ROLES.map(item => {
        const on = role === item.key;
        return <Pressable key={item.key} onPress={() => { setRole(item.key); setError(''); }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[s.card, on && s.cardOn]}>
          <View style={[s.radio, on && s.radioOn]}>{on ? <Icon name="check" size={14} color="#fff" /> : null}</View>
          <View style={{ flex: 1, gap: 4 }}><Text style={s.title}>{item.title}</Text><Text style={s.copy}>{item.copy}</Text></View>
        </Pressable>;
      })}</View>

      {error ? <AlertBanner tone="red" icon="shield" title="Could not continue" message={error} /> : null}

      {signedIn ? <>
        <PillButton title="Create my realtor account" icon="arrowRight" loading={busy} disabled={!role} onPress={() => void createRole()} />
        <Text style={s.note}>Added to your existing Kraftnex account. No new password or verification needed.</Text>
      </> : <>
        <PillButton title="Continue with mobile number" icon="phone" disabled={!role}
          onPress={() => router.push({ pathname: '/mobile-signin', params: { intent: 'realtor', accountType: role, next: '/realtor/onboarding' } } as never)} />
        <PillButton variant="soft" title="I already have a Kraftnex account" onPress={() => router.push('/login' as never)} />
      </>}
      <View style={s.policy}><Text style={s.policyTitle}>Account verification</Text><Text style={s.copy}>Your approval status is set by Kraftnex review. Submitting onboarding does not bypass the verification process.</Text></View>
    </>}
  </Screen>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: palette.line, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  cardOn: { borderColor: palette.green, backgroundColor: palette.greenSoft },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#aebbb4', alignItems: 'center', justifyContent: 'center' }, radioOn: { backgroundColor: palette.green, borderColor: palette.green },
  title: { color: palette.ink, fontSize: 14.5, fontWeight: '800' }, copy: { color: palette.body, fontSize: 12.5, lineHeight: 18 }, note: { color: palette.muted, fontSize: 11.5, textAlign: 'center' },
  policy: { padding: 14, borderRadius: 16, backgroundColor: palette.greenSoft, gap: 4 }, policyTitle: { color: palette.greenText, fontSize: 12.5, fontWeight: '800' },
});
