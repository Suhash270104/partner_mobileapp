import { useState } from 'react';
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
import Svg, { Path, Circle } from 'react-native-svg';
import { authApi } from '../lib/auth';

const GREEN = '#06291f';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const [email, setEmail] = useState(initialEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function sendReset() {
    const value = email.trim();
    setError('');
    setSuccess('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      const result = await authApi.forgotPassword(value);
      setSuccess(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request a password reset. Try again.');
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
          <Pressable style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back" onPress={backToLogin}>
            <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="#17212b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Pressable>
          <Text style={styles.headerTitle}>Forgot Password</Text>
          <View style={styles.profile}><View style={styles.profileHead} /><View style={styles.profileBody} /></View>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.recoveryIcon}>
              <Svg width={21} height={21} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={8.5} fill="none" stroke="#07513e" strokeWidth={1.8} />
                <Path d="M8.5 11.5a3.5 3.5 0 1 1 1 2.5M8.5 8.5v3h3M12 9v3l2 1.5" fill="none" stroke="#07513e" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.description}>Enter the email address associated with{`\n`}your Kraftnex account to continue.</Text>

            <View style={styles.formCard}>
              <View style={styles.emailLabel}><Text style={styles.envelope}>✉</Text><Text style={styles.label}>Email address</Text></View>
              <TextInput
                style={styles.emailInput}
                value={email}
                onChangeText={(value) => { setEmail(value); setError(''); setSuccess(''); }}
                placeholder="you@example.com"
                placeholderTextColor="#78889a"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                accessibilityLabel="Email address"
                returnKeyType="send"
                onSubmitEditing={() => void sendReset()}
              />
              {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
              {!!success && <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text>}
              <Pressable style={[styles.continueButton, busy && styles.disabled]} disabled={busy} onPress={() => void sendReset()}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueText}>{success ? 'Send again' : 'Continue  →'}</Text>}
              </Pressable>
            </View>

            <Pressable style={styles.signInLink} onPress={backToLogin}>
              <Svg width={15} height={15} viewBox="0 0 24 24"><Path d="M19 12H5m7 7-7-7 7-7" fill="none" stroke="#315b51" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              <Text style={styles.signInText}>Back to sign in</Text>
            </Pressable>
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
  header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0edf5' },
  backButton: { width: 35, height: 42, justifyContent: 'center' },
  headerTitle: { color: '#0b3025', fontSize: 13, fontWeight: '600' },
  profile: { width: 29, height: 29, borderRadius: 16, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  profileHead: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#fff', marginBottom: 2 },
  profileBody: { width: 11, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#fff' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 16 },
  recoveryIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#d3eee3', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#315b51', fontSize: 8, fontWeight: '600', letterSpacing: 1.2, marginTop: 12 },
  title: { color: '#101b2b', fontSize: 21, lineHeight: 27, fontWeight: '500', textAlign: 'center', marginTop: 5 },
  description: { color: '#64768a', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  formCard: { width: '100%', borderRadius: 12, backgroundColor: '#fff', padding: 12, marginTop: 19 },
  emailLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  envelope: { color: '#456c72', fontSize: 12 },
  label: { color: '#13242c', fontSize: 10, fontWeight: '500' },
  emailInput: { height: 42, borderRadius: 9, backgroundColor: '#f5f7fa', paddingHorizontal: 12, color: '#17212b', fontSize: 10 },
  error: { color: '#b42318', fontSize: 10, marginTop: 8 },
  success: { color: '#315b51', fontSize: 10, lineHeight: 14, marginTop: 8 },
  continueButton: { height: 39, borderRadius: 9, backgroundColor: '#104537', alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  continueText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  disabled: { opacity: 0.62 },
  signInLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28 },
  signInText: { color: '#526274', fontSize: 10 },
});
