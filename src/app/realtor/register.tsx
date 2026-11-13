import { useState } from 'react';
import { router } from 'expo-router';
import { Field, PageHeading, Panel, PrimaryButton, StatePanel, VerticalFrame, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { realtorApi } from '../../lib/partnerVerticalApi';
import { PartnerApiError } from '../../lib/partnerApi';
import { Pressable, StyleSheet, View } from 'react-native';

const TABS = [{ key: 'dashboard', label: 'Overview', icon: '⌂' }, { key: 'properties', label: 'Properties', icon: '▦' }, { key: 'projects', label: 'Projects', icon: '⌂' }, { key: 'leads', label: 'Leads', icon: '♧' }, { key: 'more', label: 'More', icon: '•••' }];
const ROLES = [
  { key: 'individual_owner', title: 'Individual owner', copy: 'List your own property for sale or rent.' },
  { key: 'agent', title: 'Real estate agent', copy: 'Manage buyer leads and property listings.' },
  { key: 'builder', title: 'Builder', copy: 'Publish projects and residential developments.' },
  { key: 'developer', title: 'Developer', copy: 'Manage developments, projects and authorized agents.' },
];

export default function RealtorRegisterScreen() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', companyName: '', city: '', reraNumber: '', otp: '', phoneVerificationToken: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  async function sendOtp() {
    setBusy(true); setError('');
    try { await realtorApi.registerOtp({ email: form.email.trim(), phone: form.phone.trim() }); setSent(true); setStep(2); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send verification code.'); }
    finally { setBusy(false); }
  }

  async function submitAccount() {
    setBusy(true); setError('');
    try {
      if (loginMode) {
        await realtorApi.login({ email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, password: form.password });
        router.replace('/realtor/onboarding');
      } else {
        const verified = await realtorApi.verifyOtp({ phone: form.phone.trim(), otp: form.otp.trim() });
        if (!verified.phoneVerificationToken) throw new Error('The server did not return a phone verification token.');
        setForm(current => ({ ...current, phoneVerificationToken: verified.phoneVerificationToken }));
        await realtorApi.register({ fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password, accountType: role, companyName: form.companyName.trim(), city: form.city.trim(), reraNumber: form.reraNumber.trim(), phoneVerificationToken: verified.phoneVerificationToken });
        router.replace('/realtor/onboarding');
      }
    } catch (cause) {
      setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not create your realtor account.');
    } finally { setBusy(false); }
  }

  return <VerticalFrame title="Kraftnex Realty" subtitle="REAL ESTATE PARTNER" tabs={TABS} activeTab="more" onTab={key => key === 'dashboard' && router.push('/realtor/dashboard')} onBack={() => router.back()}>
    <PageHeading eyebrow={`STEP ${Math.min(step + 1, 3)} OF 3`} title={loginMode ? 'Sign in to Realty' : step === 0 ? 'Choose your seller role' : step === 1 ? 'Account & contact details' : 'Verify your mobile number'} subtitle={step === 0 ? 'Select the role that best describes your real estate business.' : 'Your information is used to verify and manage your realtor workspace.'} />
    {error ? <StatePanel title="Couldn’t continue" message={error} /> : null}
    {step === 0 && !loginMode ? <>
      {ROLES.map(item => <Pressable key={item.key} style={[s.roleCard, role === item.key && s.roleSelected]} onPress={() => setRole(item.key)}>
        <View style={[s.radio, role === item.key && s.radioOn]}><Text style={s.radioMark}>{role === item.key ? '✓' : ''}</Text></View>
        <View style={s.roleText}><Text style={s.roleTitle}>{item.title}</Text><Text style={s.roleCopy}>{item.copy}</Text></View>
      </Pressable>)}
      <PrimaryButton title="Continue" onPress={() => { setError(role ? '' : 'Choose your seller role to continue.'); if (role) setStep(1); }} disabled={!role} />
    </> : null}
    {(step === 1 || loginMode) ? <>
      <Panel>
        {!loginMode ? <Field label="Full name" value={form.fullName} onChangeText={set('fullName')} /> : null}
        <Field label="Email address" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
        <Field label="Mobile number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry helper="Use at least 8 characters." />
        {!loginMode && ['builder', 'developer'].includes(role) ? <>
          <Field label="Company name" value={form.companyName} onChangeText={set('companyName')} />
          <Field label="City" value={form.city} onChangeText={set('city')} />
          <Field label="RERA registration number" value={form.reraNumber} onChangeText={set('reraNumber')} />
        </> : null}
      </Panel>
      {loginMode ? <PrimaryButton title="Sign in" onPress={() => void submitAccount()} loading={busy} disabled={!form.password || (!form.email && !form.phone)} /> : <PrimaryButton title="Send verification code" onPress={() => void sendOtp()} loading={busy} disabled={!form.fullName || !form.email || !form.phone || form.password.length < 8} />}
    </> : null}
    {step === 2 && !loginMode ? <Panel>
      <Text style={s.verifyCopy}>{sent ? 'Enter the one-time code sent to your mobile number.' : 'Send a verification code to continue.'}</Text>
      <Field label="One-time code" value={form.otp} onChangeText={set('otp')} keyboardType="numeric" />
      <PrimaryButton title="Verify and create account" onPress={() => void submitAccount()} loading={busy} disabled={!form.otp.trim()} />
      <Pressable onPress={() => void sendOtp()}><Text style={s.resend}>Resend code</Text></Pressable>
    </Panel> : null}
    <Panel tint><Text style={s.policyTitle}>Account verification</Text><Text style={s.policyCopy}>Your approval status is set by Kraftnex review. Submitting onboarding does not bypass the verification process.</Text></Panel>
    <Pressable onPress={() => { setLoginMode(value => !value); setError(''); setStep(1); }}><Text style={s.loginLink}>{loginMode ? 'Create a new realtor account' : 'Already have a realtor account? Sign in'}</Text></Pressable>
  </VerticalFrame>;
}

const s = StyleSheet.create({
  roleCard: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: palette.line, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  roleSelected: { borderColor: palette.green, backgroundColor: palette.greenSoft }, radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#aebbb4', alignItems: 'center', justifyContent: 'center' }, radioOn: { backgroundColor: palette.green, borderColor: palette.green }, radioMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  roleText: { flex: 1, gap: 4 }, roleTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, roleCopy: { color: palette.body, fontSize: 12, lineHeight: 17 }, verifyCopy: { color: palette.body, fontSize: 13, lineHeight: 18 }, resend: { color: palette.greenText, fontSize: 12, fontWeight: '800', textAlign: 'center', paddingVertical: 8 },
  policyTitle: { color: palette.greenText, fontSize: 12, fontWeight: '800' }, policyCopy: { color: palette.body, fontSize: 11, lineHeight: 16 }, loginLink: { color: palette.greenText, fontSize: 12, fontWeight: '800', textAlign: 'center', paddingVertical: 12 },
});
