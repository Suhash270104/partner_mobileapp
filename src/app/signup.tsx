import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { authApi } from '../lib/auth';

const GREEN = '#06291f';
const LOGO = require('../../assets/kraftnex-logo-transparent.png');
const MINIMUM_RULES = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'Upper & lower case', test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: 'At least one number', test: (value: string) => /[0-9]/.test(value) },
  { label: 'One special symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'letmein123', 'admin1234', 'welcome123', 'iloveyou1',
  'abc123456', '11111111', '87654321', 'changeme1', 'passw0rd', 'password!',
]);

export default function SignupScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otp = otpDigits.join('');
  const otpInputs = useRef<(TextInputInstance | null)[]>([]);
  const [focusedOtp, setFocusedOtp] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const googleClientId = Platform.select({
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  const passwordRulesValid = MINIMUM_RULES.every((rule) => rule.test(password))
    && password.length <= 128
    && !COMMON_PASSWORDS.has(password.toLowerCase());

  function passwordProblem(value: string) {
    if (!value) return 'Create a password to continue.';
    if (value.length > 128) return 'Password must be 128 characters or fewer.';
    const unmetRule = MINIMUM_RULES.find((rule) => !rule.test(value));
    if (unmetRule) return `Password requirement: ${unmetRule.label.toLowerCase()}.`;
    if (COMMON_PASSWORDS.has(value.toLowerCase())) return 'This password is too common. Choose a stronger one.';
    return '';
  }

  useEffect(() => {
    if (step !== 'otp' || resendIn <= 0) return undefined;
    const timer = setInterval(() => setResendIn((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn, step]);

  async function requestOtp() {
    setBusy(true);
    setError('');
    try {
      const result = await authApi.registerSendOtp(phone, email.trim());
      setResendIn(result.resendAfterSeconds);
      setOtpDigits(Array(6).fill(''));
      setStep('otp');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function continueRegistration() {
    setError('');
    if (!name.trim()) { setError('Enter your full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    if (!passwordRulesValid) { setError(passwordProblem(password)); return; }
    if (!acceptedTerms) { setError('Agree to the Terms of Service and Privacy Policy to continue.'); return; }
    await requestOtp();
  }

  async function resendOtp() {
    if (resendIn > 0 || busy) return;
    await requestOtp();
  }

  function updateOtpDigit(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }
    const next = [...otpDigits];
    const incoming = digits.slice(0, 6 - index);
    incoming.split('').forEach((digit, offset) => { next[index + offset] = digit; });
    setOtpDigits(next);
    const nextIndex = Math.min(index + incoming.length, 5);
    setFocusedOtp(nextIndex);
    if (index + incoming.length < 6) otpInputs.current[index + incoming.length]?.focus();
  }

  async function verifyAndCreate() {
    setError('');
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code sent to your mobile.'); return; }
    setBusy(true);
    try {
      const verification = await authApi.registerVerifyOtp(phone, otp);
      if (verification.exists) {
        setError('An account already exists for this number. Please sign in.');
        return;
      }
      if (!verification.phoneVerificationToken || !verification.phone) {
        throw new Error('The backend did not return a valid phone verification token. Request a new code.');
      }

      await authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: verification.phone,
        phoneVerificationToken: verification.phoneVerificationToken,
        website: '',
      });

      // The desktop signup records consent after account creation. Keep account creation successful
      // if that audit write is temporarily unavailable, and retry once as the desktop flow does.
      try {
        await authApi.recordLegalConsent('studio_signup');
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await authApi.recordLegalConsent('studio_signup').catch(() => undefined);
      }
      router.replace('/' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify the code and create your account.');
    } finally {
      setBusy(false);
    }
  }

  async function signUpWithGoogle(idToken: string) {
    if (!acceptedTerms) {
      setError('Agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await authApi.google(idToken);
      if (result.isNew) {
        try {
          await authApi.recordLegalConsent('studio_signup');
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await authApi.recordLegalConsent('studio_signup').catch(() => undefined);
        }
      }
      router.replace('/' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign up failed.');
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    if (step === 'otp') {
      setError('');
      setStep('form');
      setOtpDigits(Array(6).fill(''));
      return;
    }
    if (navigation.canGoBack()) router.back();
    else router.replace('/' as never);
  }

  async function openPolicy(page: 'terms' | 'privacy') {
    const baseUrl = process.env.EXPO_PUBLIC_PARTNER_SITE_URL?.trim().replace(/\/+$/, '');
    if (!baseUrl) { setError('Policy links are not configured for this build.'); return; }
    try {
      await Linking.openURL(`${baseUrl}/${page}`);
    } catch {
      setError('Could not open the policy page.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.screen, Platform.OS === 'web' && styles.webScreen]}>
        <View style={styles.header}>
          <Pressable style={styles.back} accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack}>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="#17212b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          {step === 'form' ? <Text style={styles.headerTitle}>Create Account</Text> : <View style={styles.headerTitleSpacer} />}
          <View style={styles.profile}><View style={styles.profileHead} /><View style={styles.profileBody} /></View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={step === 'form' ? styles.content : styles.otpPage}>
            <Image source={LOGO} resizeMode="contain" accessibilityLabel="Kraftnex — Where People & Spaces Connect" style={[styles.logo, step === 'otp' && styles.otpLogo]} />

            {step === 'form' ? (
              <>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.label}>Full name</Text>
                <View style={styles.field}><View style={styles.nameIcon}><View style={styles.nameHead} /><View style={styles.nameBody} /></View><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your full name" placeholderTextColor="#9aa6b4" autoCapitalize="words" returnKeyType="next" accessibilityLabel="Full name" /></View>

                <Text style={styles.label}>Email address</Text>
                <View style={styles.field}><Text style={styles.fieldIcon}>✉</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#9aa6b4" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" accessibilityLabel="Email address" /></View>

                <Text style={styles.label}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}><Text style={styles.countryText}>IN   +91</Text></View>
                  <View style={[styles.field, styles.phoneField]}><Text style={styles.fieldIcon}>☎</Text><TextInput style={styles.input} value={phone} onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" placeholderTextColor="#9aa6b4" keyboardType="number-pad" maxLength={10} accessibilityLabel="10-digit mobile number" /></View>
                </View>
                <View style={styles.hintRow}><View style={styles.hintShield}><Text style={styles.hintShieldText}>✓</Text></View><Text style={styles.hint}>We will send a 6-digit OTP code to verify this mobile.</Text></View>

                <View style={styles.passwordHeading}><Text style={styles.label}>Create password</Text><Text style={styles.security}>SECURITY: MINIMUM</Text></View>
                <View style={styles.field}><View style={styles.lock}><View style={styles.lockShackle} /><View style={styles.lockBody}><View style={styles.lockKey} /></View></View><TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Create a strong password" placeholderTextColor="#9aa6b4" secureTextEntry={!showPassword} autoCapitalize="none" maxLength={128} accessibilityLabel="Create password" /><Pressable onPress={() => setShowPassword(!showPassword)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}><Text style={styles.eye}>{showPassword ? '◉' : '◎'}</Text></Pressable></View>
                <View style={styles.rules}>
                  {MINIMUM_RULES.map((rule) => {
                    const satisfied = rule.test(password);
                    return (
                      <View key={rule.label} style={styles.rule}>
                        <View style={[styles.ruleCircle, satisfied && styles.ruleValid]}>{satisfied ? <Text style={styles.ruleCheck}>✓</Text> : null}</View>
                        <Text style={[styles.ruleText, satisfied && styles.ruleTextValid]}>{rule.label}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.termsRow}>
                  <Pressable style={styles.checkboxHit} onPress={() => setAcceptedTerms(!acceptedTerms)} accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }}>
                    <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>{acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}</View>
                  </Pressable>
                  <Text style={styles.termsText}>I agree to the </Text>
                  <Text style={styles.policyLink} onPress={() => void openPolicy('terms')}>Terms of Service</Text>
                  <Text style={styles.termsText}> and </Text>
                  <Text style={styles.policyLink} onPress={() => void openPolicy('privacy')}>Privacy Policy</Text>
                  <Text style={styles.termsText}>.</Text>
                </View>

                {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
                <Pressable style={[styles.continue, (busy || !acceptedTerms) && styles.disabled]} disabled={busy || !acceptedTerms} onPress={() => void continueRegistration()}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueText}>Continue  →</Text>}
                </Pressable>

                <View style={styles.separator}><View style={styles.ruleLine} /><Text style={styles.or}>OR SIGN UP WITH</Text><View style={styles.ruleLine} /></View>
                <GoogleSignInButton clientId={googleClientId} disabled={busy} onIdToken={signUpWithGoogle} onError={setError} />
                <View style={styles.signinRow}><Text style={styles.signinPrompt}>Already have an account? </Text><Pressable onPress={() => router.replace('/login' as never)}><Text style={styles.signinLink}>Sign in  ›</Text></Pressable></View>
              </>
            ) : (
              <View style={styles.otpContent}>
                <View style={styles.verifyBadgeHalo}>
                  <View style={styles.verifyBadge}><Svg width={26} height={26} viewBox="0 0 24 24"><Path d="M12 2.8 19 5.5v5.6c0 4.8-3 8.3-7 10.1-4-1.8-7-5.3-7-10.1V5.5l7-2.7Z" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" /><Path d="m9 11.8 2 2 4-4" fill="none" stroke="#d8ad5f" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg></View>
                  <View style={styles.verifyBadgeAccent} />
                </View>
                <Text style={styles.verifyTitle}>Verify your mobile number</Text>
                <Text style={styles.otpInfo}>We’ve sent a 6-digit verification code to{`\n`}your mobile</Text>
                <View style={styles.phonePill}>
                  <Text style={styles.phonePillDot}>●</Text>
                  <Text style={styles.phonePillText}>+91  {phone.replace(/\d(?=\d{4})/g, '•')}</Text>
                  <View style={styles.phonePillDivider} />
                  <Pressable onPress={() => { setError(''); setStep('form'); }}><Text style={styles.changePhone}>CHANGE  ✎</Text></Pressable>
                </View>
                <View style={styles.otpBoxes}>
                  {otpDigits.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(input) => { otpInputs.current[index] = input; }}
                      style={[styles.otpBox, focusedOtp === index && styles.otpBoxFocused, digit && styles.otpBoxFilled]}
                      value={digit}
                      onChangeText={(value) => updateOtpDigit(index, value)}
                      onFocus={() => setFocusedOtp(index)}
                      onKeyPress={({ nativeEvent }) => {
                        if (nativeEvent.key === 'Backspace' && !digit && index > 0) otpInputs.current[index - 1]?.focus();
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                      accessibilityLabel={`Verification digit ${index + 1}`}
                    />
                  ))}
                </View>
                {!!error && <Text accessibilityLiveRegion="polite" style={styles.otpError}>{error}</Text>}
                <View style={styles.resendRow}>
                  <Text style={styles.resendPrompt}>◷  Didn’t receive the code?</Text>
                  <Pressable disabled={resendIn > 0 || busy} onPress={() => void resendOtp()}>
                    <Text style={[styles.resend, (resendIn > 0 || busy) && styles.resendDisabled]}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend now'}</Text>
                  </Pressable>
                </View>
                <Pressable style={[styles.verifyButton, (busy || otp.length !== 6) && styles.disabled]} disabled={busy || otp.length !== 6} onPress={() => void verifyAndCreate()}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyButtonText}>Verify & Continue  →</Text>}
                </Pressable>
                {error.includes('account already exists') ? <Pressable style={styles.existingAccount} onPress={() => router.replace('/login' as never)}><Text style={styles.signinLink}>Go to sign in  ›</Text></Pressable> : null}
                <View style={styles.securityNote}><View style={styles.securityLock}><View style={styles.securityShackle} /><View style={styles.securityLockBody}><View style={styles.securityLockKey} /></View></View><Text style={styles.securityNoteText}>Never share this verification code with anyone.</Text></View>
              </View>
            )}
            {step === 'form' ? <Text style={styles.footer}>Where People & Spaces Connect.</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#ebe9f0' : '#fbf9ff' },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: '#fbf9ff', overflow: 'hidden' },
  webScreen: { shadowColor: '#1a1722', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  flex: { flex: 1 },
  header: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#fbf9ff', borderBottomWidth: 1, borderBottomColor: '#f0edf5', shadowColor: '#21212c', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3, zIndex: 1 },
  back: { width: 35, height: 40, justifyContent: 'center' },
  headerTitle: { color: '#222c34', fontSize: 12, fontWeight: '500' },
  headerTitleSpacer: { width: 35 },
  profile: { width: 29, height: 29, borderRadius: 16, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  profileHead: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#fff', marginBottom: 2 },
  profileBody: { width: 11, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#fff' },
  content: { width: '100%', paddingHorizontal: 11, paddingBottom: 4, justifyContent: 'flex-start', alignItems: 'stretch' },
  otpPage: { width: '100%', flexGrow: 1, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 8 },
  logo: { width: '54%', height: undefined, aspectRatio: 1600 / 519, alignSelf: 'center', marginTop: 14, marginBottom: 24 },
  otpLogo: { width: '39%', marginTop: 9, marginBottom: 18 },
  title: { color: '#002a20', fontSize: 23, lineHeight: 29, fontWeight: '500', marginBottom: 14 },
  label: { color: '#0c211d', fontSize: 11, fontWeight: '500', marginBottom: 5 },
  field: { height: 42, borderRadius: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 11, shadowColor: '#4b3a63', shadowOpacity: 0.035, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  fieldIcon: { width: 23, fontSize: 14, color: '#547077' },
  nameIcon: { width: 23, alignItems: 'flex-start', justifyContent: 'center' },
  nameHead: { width: 6, height: 6, borderRadius: 4, borderWidth: 1, borderColor: '#547077', marginLeft: 3 },
  nameBody: { width: 11, height: 6, borderWidth: 1, borderColor: '#547077', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomWidth: 0, marginTop: 1 },
  input: { flex: 1, color: '#17212b', fontSize: 12, paddingVertical: 0 },
  phoneRow: { flexDirection: 'row', gap: 7 },
  countryCode: { width: 66, height: 42, borderRadius: 9, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  countryText: { color: '#12231e', fontSize: 10, fontWeight: '500' },
  phoneField: { flex: 1, marginBottom: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 13 },
  hintShield: { width: 11, height: 12, borderColor: '#c58d36', borderWidth: 1, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  hintShieldText: { color: '#c58d36', fontSize: 7, lineHeight: 9, fontWeight: '700' },
  hint: { color: '#73869a', fontSize: 10 },
  passwordHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  security: { color: '#42566b', fontSize: 8, marginBottom: 5 },
  lock: { width: 20, alignItems: 'center', justifyContent: 'center' },
  lockShackle: { width: 8, height: 7, borderWidth: 1.2, borderColor: '#647780', borderBottomWidth: 0, borderTopLeftRadius: 5, borderTopRightRadius: 5, marginBottom: -1 },
  lockBody: { width: 11, height: 9, borderRadius: 2, backgroundColor: '#647780', alignItems: 'center', justifyContent: 'center' },
  lockKey: { width: 2, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  eye: { color: '#647780', fontSize: 17, paddingLeft: 8 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: -4, marginBottom: 12 },
  rule: { width: '50%', flexDirection: 'row', alignItems: 'center', height: 20 },
  ruleCircle: { width: 12, height: 12, borderRadius: 8, borderWidth: 1, borderColor: '#4f6477', marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  ruleValid: { borderColor: '#16845d', backgroundColor: '#16845d' },
  ruleCheck: { color: '#fff', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  ruleText: { color: '#62758a', fontSize: 9 },
  ruleTextValid: { color: '#276a4b' },
  termsRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  checkbox: { width: 15, height: 15, borderRadius: 4, borderWidth: 1, borderColor: '#e8e8ef', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkboxHit: { justifyContent: 'center', paddingRight: 9 },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 },
  termsText: { color: '#344251', fontSize: 9 },
  policyLink: { color: '#0d1f1c', fontSize: 9, textDecorationLine: 'underline' },
  error: { color: '#b42318', fontSize: 11, marginBottom: 8 },
  continue: { height: 39, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  continueText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.62 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 13 },
  ruleLine: { height: 1, flex: 1, backgroundColor: '#ece8f5' },
  or: { color: '#586876', fontSize: 9, fontWeight: '500' },
  signinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 19, marginBottom: 12 },
  signinPrompt: { color: '#667487', fontSize: 10 },
  signinLink: { color: '#071e19', fontSize: 11, fontWeight: '700' },
  footer: { color: '#9aa4b3', textAlign: 'center', fontSize: 9, marginTop: 8 },
  otpContent: { alignItems: 'center', paddingTop: 1 },
  verifyBadgeHalo: { width: 53, height: 53, borderRadius: 27, backgroundColor: '#e2f0eb', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 13 },
  verifyBadge: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#07513e', alignItems: 'center', justifyContent: 'center' },
  verifyBadgeAccent: { position: 'absolute', width: 10, height: 10, borderRadius: 2, backgroundColor: '#d9ae5e', borderWidth: 2, borderColor: '#fff', right: 2, bottom: 3 },
  verifyTitle: { color: '#06291f', fontSize: 18, lineHeight: 24, fontWeight: '500', textAlign: 'center' },
  otpInfo: { color: '#53657a', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 2 },
  phonePill: { height: 30, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#f1f0f8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 13, gap: 7 },
  phonePillDot: { color: '#07513e', fontSize: 8 },
  phonePillText: { color: '#09291f', fontSize: 10, fontWeight: '600' },
  phonePillDivider: { width: 1, height: 14, backgroundColor: '#d8d5e1', marginHorizontal: 2 },
  changePhone: { color: '#526274', fontSize: 8, fontWeight: '600' },
  otpBoxes: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 23 },
  otpBox: { flex: 1, maxWidth: 42, height: 46, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0edf5', textAlign: 'center', color: '#0b2d23', fontSize: 18, fontWeight: '600', padding: 0 },
  otpBoxFocused: { borderColor: '#d8ad5f', borderBottomWidth: 2 },
  otpBoxFilled: { color: '#052b20' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  resendPrompt: { color: '#53657a', fontSize: 9 },
  resend: { color: '#0d4837', fontSize: 9, fontWeight: '600', textDecorationLine: 'underline' },
  resendDisabled: { color: '#8995a3', textDecorationLine: 'none' },
  otpError: { color: '#b42318', fontSize: 10, textAlign: 'center', marginTop: 8 },
  verifyButton: { width: '100%', height: 44, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  verifyButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  existingAccount: { marginTop: 10 },
  securityNote: { marginTop: 10, width: '100%', minHeight: 34, borderRadius: 8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  securityNoteText: { color: '#344251', fontSize: 8 },
  securityLock: { width: 11, alignItems: 'center', justifyContent: 'center' },
  securityShackle: { width: 6, height: 5, borderWidth: 1, borderColor: '#547077', borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4, marginBottom: -1 },
  securityLockBody: { width: 9, height: 7, borderRadius: 1, backgroundColor: '#547077', alignItems: 'center', justifyContent: 'center' },
  securityLockKey: { width: 1, height: 3, backgroundColor: '#fff' },
});
