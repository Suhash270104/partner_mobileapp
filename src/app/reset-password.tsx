import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { authApi } from '../lib/auth';

const GREEN = '#0b382c';
const PASSWORD_RULES = [
  { label: 'At least 8 chars', test: (value: string) => value.length >= 8 },
  { label: 'Upper & lower case', test: (value: string) => /[A-Z]/.test(value) && /[a-z]/.test(value) },
  { label: 'At least one number', test: (value: string) => /[0-9]/.test(value) },
  { label: 'One special symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] ?? '' : params.token ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rules = useMemo(() => PASSWORD_RULES.map((rule) => rule.test(password)), [password]);
  const ruleCount = rules.filter(Boolean).length;
  const matches = confirmation.length > 0 && password === confirmation;
  const strength = ruleCount === 4 ? 'STRONG' : ruleCount >= 2 ? 'MEDIUM' : 'WEAK';
  const canSubmit = Boolean(token) && rules.every(Boolean) && password.length <= 128 && matches && !busy;

  async function submit() {
    setError('');
    if (!token) { setError('This reset link is missing its token. Request a new password reset link.'); return; }
    if (password.length > 128) { setError('Password must be 128 characters or fewer.'); return; }
    if (!rules.every(Boolean)) { setError('Meet all password requirements before continuing.'); return; }
    if (!matches) { setError('The passwords do not match.'); return; }

    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      router.replace('/password-updated' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset your password. Request a new link and try again.');
    } finally {
      setBusy(false);
    }
  }

  function backToLogin() {
    router.replace('/login' as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.screen, Platform.OS === 'web' && styles.webScreen]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={backToLogin}>
            <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M19 12H5m7 7-7-7 7-7" fill="none" stroke="#17212b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Pressable>
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={styles.profile}><View style={styles.profileHead} /><View style={styles.profileBody} /></View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {
              <View style={styles.form}>
                <View style={styles.securityIcon}>
                  <Svg width={21} height={21} viewBox="0 0 24 24">
                    <Path d="M12 3 5.5 5.5v5.3c0 4.3 2.7 8 6.5 10.2 3.8-2.2 6.5-5.9 6.5-10.2V5.5L12 3Z" fill="none" stroke="#07513e" strokeWidth={1.8} strokeLinejoin="round" />
                    <Path d="m9.2 12 1.8 1.8 3.8-4" fill="none" stroke="#07513e" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View style={styles.protocol}><View style={styles.protocolDot} /><Text style={styles.protocolText}>SECURITY PROTOCOL</Text></View>
                <Text style={styles.title}>Create a new password</Text>
                <Text style={styles.description}>Set a strong, unique password to secure your{`\n`}architectural workspace.</Text>

                <View style={styles.fieldHeading}>
                  <Text style={styles.label}>New password</Text>
                  <Text style={[styles.strength, ruleCount === 4 && styles.strong]}>{`STRENGTH: ${strength}`}</Text>
                </View>
                <View style={styles.inputBox}>
                  <View style={styles.lockIcon}><View style={styles.lockShackle} /><View style={styles.lockBody} /></View>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={(value) => { setPassword(value); setError(''); }}
                    placeholder="Enter new password"
                    placeholderTextColor="#78889a"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    accessibilityLabel="New password"
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide passwords' : 'Show passwords'} onPress={() => setShowPassword((value) => !value)}>
                    <Svg width={17} height={17} viewBox="0 0 24 24">
                      <Path d="M3 3 21 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.8 10.8 0 0 1 12 5c5.3 0 9 5.1 9 7a8.7 8.7 0 0 1-2.5 3.7M6.2 6.3C4.2 7.6 3 9.7 3 12c0 1.9 3.7 7 9 7 1.2 0 2.3-.3 3.3-.8" fill="none" stroke="#647780" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </View>

                <View style={styles.strengthBars}>
                  {PASSWORD_RULES.map((rule, index) => <View key={rule.label} style={[styles.strengthBar, rules[index] && styles.strengthBarActive]} />)}
                </View>

                <View style={styles.fieldHeading}>
                  <Text style={styles.label}>Confirm new password</Text>
                  <Text style={[styles.match, matches && styles.matchSuccess]}>{confirmation ? (matches ? '✓ Matching' : '— Not matching') : ''}</Text>
                </View>
                <View style={styles.inputBox}>
                  <View style={styles.lockIcon}><View style={styles.lockShackle} /><View style={styles.lockBody} /></View>
                  <TextInput
                    style={styles.input}
                    value={confirmation}
                    onChangeText={(value) => { setConfirmation(value); setError(''); }}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#78889a"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    accessibilityLabel="Confirm new password"
                    returnKeyType="done"
                    onSubmitEditing={() => void submit()}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide passwords' : 'Show passwords'} onPress={() => setShowPassword((value) => !value)}>
                    <Svg width={17} height={17} viewBox="0 0 24 24">
                      <Path d="M3 3 21 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.8 10.8 0 0 1 12 5c5.3 0 9 5.1 9 7a8.7 8.7 0 0 1-2.5 3.7M6.2 6.3C4.2 7.6 3 9.7 3 12c0 1.9 3.7 7 9 7 1.2 0 2.3-.3 3.3-.8" fill="none" stroke="#647780" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </Pressable>
                </View>

                <View style={styles.standards}>
                  <View style={styles.standardsHeading}>
                    <Svg width={13} height={13} viewBox="0 0 24 24"><Path d="M12 3 5 6v5.5c0 4.6 3 7.7 7 9.5 4-1.8 7-4.9 7-9.5V6l-7-3Z" fill="none" stroke="#07513e" strokeWidth={1.8} strokeLinejoin="round" /><Path d="m9 12 2 2 4-4" fill="none" stroke="#07513e" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                    <Text style={styles.standardsTitle}>ARCHITECTURAL SECURITY STANDARDS</Text>
                  </View>
                  <View style={styles.ruleGrid}>
                    {PASSWORD_RULES.map((rule, index) => (
                      <View key={rule.label} style={styles.ruleChip}>
                        <View style={[styles.ruleCheck, rules[index] && styles.ruleCheckActive]}><Text style={[styles.ruleCheckText, rules[index] && styles.ruleCheckTextActive]}>{rules[index] ? '✓' : '·'}</Text></View>
                        <Text style={styles.ruleText}>{rule.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
                <Pressable style={[styles.submitButton, !canSubmit && styles.submitDisabled]} disabled={!canSubmit} onPress={() => void submit()}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Reset password  →</Text>}
                </Pressable>
                <Pressable style={styles.cancelLink} onPress={backToLogin}>
                  <Svg width={14} height={14} viewBox="0 0 24 24"><Path d="M19 12H5m7 7-7-7 7-7" fill="none" stroke="#315b51" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                  <Text style={styles.cancelText}>Cancel and back to sign in</Text>
                </Pressable>
              </View>
            }
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
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0edf5', backgroundColor: '#fbf9ff' },
  backButton: { width: 35, height: 42, justifyContent: 'center' },
  headerTitle: { color: '#0b3025', fontSize: 13, fontWeight: '600' },
  profile: { width: 29, height: 29, borderRadius: 16, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  profileHead: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#fff', marginBottom: 2 },
  profileBody: { width: 11, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#fff' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 12 },
  form: { width: '100%', alignItems: 'stretch' },
  securityIcon: { width: 41, height: 41, borderRadius: 13, backgroundColor: '#e0f3ec', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  protocol: { height: 18, borderRadius: 10, paddingHorizontal: 9, backgroundColor: '#edf0fc', flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 5, marginTop: 10 },
  protocolDot: { width: 4, height: 4, borderRadius: 3, backgroundColor: '#d5a23e' },
  protocolText: { color: '#315179', fontSize: 7, fontWeight: '700', letterSpacing: 0.7 },
  title: { color: '#101b2b', fontSize: 21, lineHeight: 27, fontWeight: '500', textAlign: 'center', marginTop: 8 },
  description: { color: '#64768a', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 3, marginBottom: 17 },
  fieldHeading: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  label: { color: '#13242c', fontSize: 10, fontWeight: '600' },
  strength: { color: '#536579', fontSize: 7, fontWeight: '500', letterSpacing: 0.25 },
  strong: { color: '#08734f' },
  inputBox: { minHeight: 42, borderRadius: 10, backgroundColor: '#f8f9fc', borderWidth: 1, borderColor: '#f0f1f6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  input: { flex: 1, color: '#17212b', fontSize: 10, paddingVertical: 9 },
  lockIcon: { width: 14, height: 17, justifyContent: 'flex-end', alignItems: 'center', marginRight: 7 },
  lockShackle: { width: 7, height: 8, borderWidth: 1.3, borderColor: '#547078', borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4, marginBottom: -1 },
  lockBody: { width: 12, height: 9, borderRadius: 2, backgroundColor: '#547078' },
  strengthBars: { flexDirection: 'row', gap: 4, marginTop: 6, marginBottom: 13 },
  strengthBar: { height: 3, flex: 1, borderRadius: 3, backgroundColor: '#e7eaf4' },
  strengthBarActive: { backgroundColor: '#d9ab52' },
  match: { color: '#6e7f91', fontSize: 8 },
  matchSuccess: { color: '#08734f' },
  standards: { backgroundColor: '#f5f4ff', borderRadius: 10, padding: 9, marginTop: 12 },
  standardsHeading: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  standardsTitle: { color: '#14352d', fontSize: 7, fontWeight: '700', letterSpacing: 0.25 },
  ruleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  ruleChip: { width: '48.8%', minHeight: 23, borderRadius: 7, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, gap: 5 },
  ruleCheck: { width: 14, height: 14, borderRadius: 8, backgroundColor: '#eef0fb', alignItems: 'center', justifyContent: 'center' },
  ruleCheckActive: { backgroundColor: '#dce4ff' },
  ruleCheckText: { color: '#8b9ab0', fontSize: 11, fontWeight: '700', lineHeight: 14 },
  ruleCheckTextActive: { color: '#7189c9' },
  ruleText: { color: '#66778b', fontSize: 8 },
  error: { color: '#b42318', fontSize: 9, lineHeight: 13, marginTop: 8 },
  submitButton: { height: 40, borderRadius: 9, backgroundColor: '#104537', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cancelLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 13 },
  cancelText: { color: '#526274', fontSize: 9 },
});
