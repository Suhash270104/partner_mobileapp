import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PhoneOtpFlow } from '../components/auth/PhoneOtpFlow';
import { ChipGroup, FormField, Icon, PillButton, Screen, Text, palette } from '../components/ui';
import { AuthApiError, AuthIntent, MobileVerifyResult, RealtorAccountType, authApi } from '../lib/auth';
import { compact, firstError, lengthBetween, optionalEmail, required } from '../lib/marketplace/validation';

const INTENTS: AuthIntent[] = ['customer', 'designer', 'technician', 'realtor'];
const ACCOUNT_TYPES: { value: RealtorAccountType; label: string }[] = [
  { value: 'individual_owner', label: 'Individual owner' }, { value: 'agent', label: 'Real estate agent' }, { value: 'builder', label: 'Builder' }, { value: 'developer', label: 'Developer' },
];
const COPY: Record<AuthIntent, string> = {
  customer: 'Sign in or create your Kraftnex account with your mobile number.',
  designer: 'Sign in or create your professional account with your mobile number.',
  technician: 'Sign in or create your technician account with your mobile number.',
  realtor: 'Sign in or create your realtor account with your mobile number.',
};

/** Only same-app paths are followed after sign-in, so a crafted link cannot send the person elsewhere. */
const safeNext = (value: unknown) => (typeof value === 'string' && /^\/[\w\-/()[\]?=&%.]*$/.test(value) ? value : '/');

/**
 * Mobile OTP: one screen for returning and new people. `intent` says which workspace they came for (e.g. realtor);
 * `next` is where to go afterwards. Returning users are signed in right after the code; new users add name and email first.
 */
export default function MobileSignInScreen() {
  const params = useLocalSearchParams<{ intent?: string; accountType?: string; next?: string }>();
  const intent: AuthIntent = INTENTS.includes(params.intent as AuthIntent) ? params.intent as AuthIntent : 'customer';
  const next = safeNext(params.next);

  const [stage, setStage] = useState<'otp' | 'details'>('otp');
  const [proof, setProof] = useState<{ phone: string; token?: string; existing: boolean; hasRole: boolean }>({ phone: '', existing: false, hasRole: true });
  const [form, setForm] = useState({ name: '', email: '', city: '' });
  const [accountType, setAccountType] = useState<string>(ACCOUNT_TYPES.some(t => t.value === params.accountType) ? String(params.accountType) : '');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** A returning customer opening a realtor account gets the realtor workspace added to the same identity. */
  const addRealtorRole = async () => {
    if (!accountType) throw new AuthApiError('Choose your seller role to continue.', 400);
    await authApi.addProfile('realtor', { accountType });
  };
  const holdsRole = (result: MobileVerifyResult) => intent !== 'realtor' || !!result.user?.roles?.some(role => role.type === 'realtor') || result.activeRole === 'realtor';

  const verify = async (phone: string, otp: string) => {
    const result = await authApi.mobileVerify(phone, otp, intent);
    if (result.isNewUser) {
      if (!result.phoneVerificationToken) throw new AuthApiError('The server did not return a verification token. Request a new code.', 400);
      setProof({ phone, token: result.phoneVerificationToken, existing: false, hasRole: true });
      setStage('details');
      return;
    }
    // Returning person: the session already exists. Fill in missing basics first if the account has none.
    if (result.needsDetails) { setProof({ phone, existing: true, hasRole: holdsRole(result) }); setStage('details'); return; }
    if (!holdsRole(result)) await addRealtorRole();
    router.replace(next as never);
  };

  const submit = async () => {
    const found = compact({
      name: lengthBetween(form.name, 'Name', 2, 120), email: required(form.email, 'Email') || optionalEmail(form.email),
      accountType: intent === 'realtor' && !proof.existing && !accountType ? 'Choose your seller role.' : undefined,
      agreed: proof.existing || agreed ? undefined : 'Please accept the terms to continue.',
    });
    setErrors(found);
    if (Object.keys(found).length) { setError(firstError(found) ?? ''); return; }
    setBusy(true); setError('');
    try {
      if (proof.existing) {
        await authApi.mobileUpdateBasics({ name: form.name.trim(), email: form.email.trim(), ...(form.city.trim() ? { city: form.city.trim() } : {}) });
        if (!proof.hasRole) await addRealtorRole();
      } else {
        await authApi.mobileComplete({
          phone: proof.phone, phoneVerificationToken: proof.token!, name: form.name.trim(), email: form.email.trim(), ...(form.city.trim() ? { city: form.city.trim() } : {}),
          intent, ...(intent === 'realtor' ? { accountType: accountType as RealtorAccountType } : {}),
        });
        // Proof of agreement; a failed audit write must never undo the sign-up.
        await authApi.recordLegalConsent(`${intent}_signup`).catch(() => undefined);
      }
      router.replace(next as never);
    } catch (cause) {
      setError(cause instanceof AuthApiError && cause.status === 409 ? 'An account already exists for this email or number. Please sign in instead.' : cause instanceof Error ? cause.message : 'Could not finish. Please try again.');
    } finally { setBusy(false); }
  };

  const goBack = () => (stage === 'details' ? setStage('otp') : router.canGoBack() ? router.back() : router.replace('/login' as never));

  return <Screen standalone title={stage === 'otp' ? 'Continue with mobile' : 'Tell us about you'} subtitle={stage === 'otp' ? COPY[intent] : 'We need your name and email to finish setting up your account.'} onBack={goBack}>
    {stage === 'otp' ? <>
      {intent === 'realtor' ? <ChipGroup label="I am a" required value={accountType} options={ACCOUNT_TYPES} onChange={value => setAccountType(value)} /> : null}
      <PhoneOtpFlow onSend={phone => authApi.mobileSend(phone)} onVerify={verify} />
      <PillButton variant="ghost" title="Use email and password instead" onPress={() => router.replace('/login' as never)} />
    </> : <View style={{ gap: 14 }}>
      <FormField label="Full name" required value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))} autoCapitalize="words" error={errors.name} />
      <FormField label="Email" required value={form.email} onChangeText={email => setForm(f => ({ ...f, email }))} keyboardType="email-address" error={errors.email} />
      <FormField label="City (optional)" value={form.city} onChangeText={city => setForm(f => ({ ...f, city }))} />
      {intent === 'realtor' && !proof.existing ? <ChipGroup label="I am a" required value={accountType} options={ACCOUNT_TYPES} onChange={value => setAccountType(value)} /> : null}
      {!proof.existing ? <Pressable onPress={() => setAgreed(!agreed)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} style={[s.consent, !!errors.agreed && { borderColor: palette.red }]}>
        <View style={[s.box, agreed && s.boxOn]}>{agreed ? <Icon name="check" size={16} color="#fff" /> : null}</View>
        <Text style={s.consentText}>I agree to the Terms of Service and Privacy Policy.</Text>
      </Pressable> : null}
      {error ? <Text style={{ color: palette.red, fontSize: 13, fontWeight: '700' }}>{error}</Text> : null}
      <PillButton title={proof.existing ? 'Save and continue' : 'Create my account'} icon="check" loading={busy} onPress={() => void submit()} />
    </View>}
  </Screen>;
}

const s = StyleSheet.create({
  consent: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#9aa8a1', alignItems: 'center', justifyContent: 'center' }, boxOn: { backgroundColor: '#0d4a38', borderColor: '#0d4a38' },
  consentText: { flex: 1, color: '#33463f', fontSize: 14, lineHeight: 20 },
});
