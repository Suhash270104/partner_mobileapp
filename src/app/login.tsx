import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router, useNavigation } from 'expo-router';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { authApi } from '../lib/auth';
import { hasCompletedLaunchSplash, markLaunchSplashComplete } from '../lib/splashState';

const logo = require('../../assets/kraftnex-logo-transparent.png');
const ASPECT = 1600 / 519;
const GREEN = '#06291f';
const SAVED_IDENTIFIER_KEY = 'kraftnex.savedLoginIdentifier';

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation();
  const [ready, setReady] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playInitialSplash] = useState(() => !hasCompletedLaunchSplash());
  const googleClientId = Platform.select({
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  const afterLogin = () => {
    router.replace('/' as never);
  };

  const [logoProgress] = useState(() => new Animated.Value(playInitialSplash ? 0 : 1));
  const [revealProgress] = useState(() => new Animated.Value(playInitialSplash ? 0 : 1));
  const [shineProgress] = useState(() => new Animated.Value(playInitialSplash ? 0 : 1));
  const [contentProgress] = useState(() => new Animated.Value(playInitialSplash ? 0 : 1));
  const [headerProgress] = useState(() => new Animated.Value(playInitialSplash ? 0 : 1));
  const initialLogoWidth = Math.min(width * 0.84, 360);
  const initialLogoHeight = initialLogoWidth / ASPECT;
  const initialLogoTop = (height - initialLogoHeight) / 2;
  const finalLogoWidth = Math.min(width * 0.46, 190);
  const finalLogoTop = 78;
  const logoScale = logoProgress.interpolate({ inputRange: [0, 1], outputRange: [1, finalLogoWidth / initialLogoWidth] });
  const finalLogoHeight = finalLogoWidth / ASPECT;
  const logoRise = logoProgress.interpolate({ inputRange: [0, 1], outputRange: [0, finalLogoTop - initialLogoTop - (initialLogoHeight - finalLogoHeight) / 2] });
  const revealWidth = revealProgress.interpolate({ inputRange: [0, 1], outputRange: [0, initialLogoWidth] });
  const shineLeft = shineProgress.interpolate({ inputRange: [0, 1], outputRange: [-36, initialLogoWidth + 36] });
  const pageOpacity = contentProgress;
  const pageTranslate = contentProgress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const headerOpacity = headerProgress;
  const canGoBack = ready && navigation.canGoBack();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const autofillStyle = document.createElement('style');
    autofillStyle.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
        box-shadow: 0 0 0 1000px #ffffff inset !important;
        -webkit-text-fill-color: #17212b !important;
        caret-color: #17212b !important;
        transition: background-color 99999s ease-out 0s !important;
      }
    `;
    document.head.appendChild(autofillStyle);
    return () => { autofillStyle.remove(); };
  }, []);

  // Someone who is still signed in (the session cookie outlives the app) goes straight to the workspaces.
  useEffect(() => {
    let active = true;
    authApi.session().then(
      result => { if (active && result.user) router.replace('/' as never); },
      () => undefined,
    );
    return () => { active = false; };
  }, []);

  async function completeGoogleLogin(idToken: string) {
    setBusy(true); setError('');
    try {
      if (!idToken) throw new Error('Google did not return an ID token. Check the Google OAuth client configuration.');
      await authApi.google(idToken);
      afterLogin();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign in failed.');
    } finally { setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(SAVED_IDENTIFIER_KEY)
      .then((saved) => { if (active && saved) setIdentifier(saved); })
      .catch(() => { /* Secure storage can be unavailable in web preview. */ })
      .finally(() => {
        if (!active) return;
        setReady(true);
        if (!playInitialSplash) return;
        markLaunchSplashComplete();
        Animated.parallel([
          Animated.sequence([
            Animated.timing(revealProgress, { toValue: 1, duration: 760, delay: 100, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
            Animated.parallel([
              Animated.timing(shineProgress, { toValue: 1, duration: 780, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
              Animated.timing(logoProgress, { toValue: 1, duration: 1050, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            ]),
          ]),
          Animated.sequence([
            Animated.delay(900),
            Animated.parallel([
              Animated.timing(contentProgress, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(headerProgress, { toValue: 1, duration: 450, useNativeDriver: true }),
            ]),
          ]),
        ]).start();
      });
    return () => { active = false; revealProgress.stopAnimation(); shineProgress.stopAnimation(); logoProgress.stopAnimation(); contentProgress.stopAnimation(); headerProgress.stopAnimation(); };
  }, [contentProgress, headerProgress, logoProgress, playInitialSplash, revealProgress, shineProgress]);

  async function signIn() {
    const value = identifier.trim();
    if (!value || !password) { setError('Enter your email or phone number and password.'); return; }
    setBusy(true); setError('');
    try {
      await authApi.login(value, password);
      if (Platform.OS !== 'web') {
        if (rememberMe) await SecureStore.setItemAsync(SAVED_IDENTIFIER_KEY, value);
        else await SecureStore.deleteItemAsync(SAVED_IDENTIFIER_KEY);
      }
      afterLogin();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.screen, Platform.OS === 'web' && styles.webScreen]}>
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.back} onPress={() => { if (canGoBack) router.back(); }}>
            {canGoBack ? <Text style={styles.backArrow}>‹</Text> : null}
          </Pressable>
          <Text style={styles.headerTitle}>Login</Text>
          <View style={styles.profile}><View style={styles.profileHead} /><View style={styles.profileBody} /></View>
        </Animated.View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <View style={[styles.logoSpace, { height: Math.max(70, finalLogoTop + finalLogoWidth / ASPECT + 20 - 54) }]} />
            <Animated.View style={{ opacity: pageOpacity, transform: [{ translateY: pageTranslate }] }}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue to your partner workspace.</Text>

              <Text style={styles.label}>Email or mobile number</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && styles.webInput]} value={identifier} onChangeText={setIdentifier}
                  placeholder="Enter your email or phone" placeholderTextColor="#718096"
                  autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                  textContentType="username" returnKeyType="next" accessibilityLabel="Email or mobile number"
                />
              </View>

              <View style={styles.passwordHeading}>
                <Text style={styles.label}>Password</Text>
                <Pressable onPress={() => router.replace('/forgot-password' as never)}>
                  <Text style={styles.forgot}>Forgot password?</Text>
                </Pressable>
              </View>
              <View style={styles.inputBox}>
                <View style={styles.iconSlot}>
                  <View style={styles.lockShackle} />
                  <View style={styles.lockBody}><View style={styles.lockKey} /></View>
                </View>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && styles.webInput]} value={password} onChangeText={setPassword}
                  placeholder="Enter your password" placeholderTextColor="#718096"
                  secureTextEntry={!showPassword} textContentType="password"
                  returnKeyType="go" onSubmitEditing={() => void signIn()} accessibilityLabel="Password"
                />
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eye}>{showPassword ? '◉' : '◎'}</Text>
                </Pressable>
              </View>

              <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)} accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>{rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}</View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              {!!error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
              <Pressable style={[styles.signIn, busy && styles.disabled]} onPress={() => void signIn()} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign In  →</Text>}
              </Pressable>

              <View style={styles.separator}><View style={styles.rule} /><Text style={styles.or}>OR CONTINUE WITH</Text><View style={styles.rule} /></View>
              <GoogleSignInButton clientId={googleClientId} disabled={busy} onIdToken={completeGoogleLogin} onError={setError} />

              <View>
                <View style={styles.createRow}>
                  <Text style={styles.newText}>New to KRAFTNEX? </Text>
                  <Pressable onPress={() => router.push('/signup' as never)}><Text style={styles.createText}>Create account</Text></Pressable>
                </View>
                <View style={styles.footerDots}><View style={styles.dot} /><View style={styles.dot} /></View>
                <Text style={styles.footer}>Your spaces. Your people. Your possibilities.</Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Animated.View
          style={[styles.animatedLogo, {
            width: initialLogoWidth,
            height: initialLogoHeight,
            top: initialLogoTop,
            transform: [{ translateY: logoRise }, { scale: logoScale }],
          }]}
        >
          <Animated.View style={[styles.logoReveal, { width: revealWidth, height: initialLogoHeight }]}>
            <Image
              source={logo} resizeMode="stretch" accessibilityLabel="Kraftnex — Where People & Spaces Connect"
              style={{ width: initialLogoWidth, height: initialLogoHeight }}
            />
            <Animated.View pointerEvents="none" style={[styles.logoSheen, { left: shineLeft, height: initialLogoHeight * 0.9, top: initialLogoHeight * 0.05 }]} />
          </Animated.View>
        </Animated.View>
        {!ready ? <View style={styles.loading} pointerEvents="none" /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#ebe9f0' : '#fbf9ff' },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: '#fbf9ff', overflow: 'hidden' },
  webScreen: { shadowColor: '#1a1722', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  flex: { flex: 1 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f1eef5', backgroundColor: '#fbf9ff' },
  back: { width: 42, height: 42, justifyContent: 'center' },
  backArrow: { color: '#17212b', fontSize: 34, lineHeight: 38 },
  headerTitle: { color: '#353b3a', fontSize: 14, fontWeight: '500' },
  profile: { width: 33, height: 33, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  profileHead: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff', marginBottom: 2 },
  profileBody: { width: 13, height: 7, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 13, paddingBottom: 8 },
  logoSpace: { width: '100%' },
  title: { fontSize: 28, lineHeight: 35, letterSpacing: -0.6, color: '#002a20', fontWeight: '500', marginBottom: 2 },
  subtitle: { color: '#34485d', fontSize: 14, lineHeight: 21, marginBottom: 26 },
  label: { fontSize: 13, color: '#071f1a', fontWeight: '500' },
  inputBox: { height: 51, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 7, marginBottom: 17, shadowColor: '#4b3a63', shadowOpacity: 0.055, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  inputIcon: { width: 27, color: '#537078', fontSize: 18 },
  iconSlot: { width: 27, height: 24, justifyContent: 'center', alignItems: 'center' },
  lockShackle: { width: 9, height: 9, borderWidth: 1.6, borderColor: '#647780', borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6, marginBottom: -1 },
  lockBody: { width: 13, height: 10, borderRadius: 2, backgroundColor: '#647780', alignItems: 'center', justifyContent: 'center' },
  lockKey: { width: 2, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  input: { flex: 1, color: '#17212b', fontSize: 14, paddingVertical: 0 },
  webInput: { outlineWidth: 0, outlineColor: 'transparent' },
  passwordHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forgot: { color: '#002a20', fontSize: 13, fontWeight: '500' },
  eye: { color: '#647780', fontSize: 21, paddingLeft: 10 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 2, marginBottom: 22 },
  checkbox: { width: 15, height: 15, borderRadius: 2, borderWidth: 1, borderColor: '#73817b', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
  rememberText: { color: '#465261', fontSize: 12 },
  signIn: { height: 54, backgroundColor: GREEN, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#001b14', shadowOpacity: 0.17, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  signInText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.62 },
  separator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  rule: { height: 1, backgroundColor: '#ece8f5', flex: 1 },
  or: { color: '#5a6872', fontSize: 10, fontWeight: '500' },
  createRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 42 },
  newText: { color: '#354251', fontSize: 13 },
  createText: { color: '#071e19', fontSize: 13, fontWeight: '700' },
  footerDots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 38, marginBottom: 7 },
  dot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#b1b1b5' },
  footer: { color: '#738091', textAlign: 'center', fontSize: 11 },
  animatedLogo: { position: 'absolute', alignSelf: 'center', zIndex: 3, alignItems: 'flex-start', justifyContent: 'flex-start' },
  logoReveal: { overflow: 'hidden', alignSelf: 'flex-start' },
  logoSheen: { position: 'absolute', width: 17, backgroundColor: 'rgba(255,255,255,0.72)', shadowColor: '#cf9d43', shadowOpacity: 0.9, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 6, transform: [{ rotate: '12deg' }] },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: '#fbf9ff', opacity: 0.01 },
  error: { color: '#b42318', fontSize: 12, marginTop: -12, marginBottom: 12 },
});
