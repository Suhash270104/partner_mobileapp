import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PartnerBrand } from '../components/PartnerBrand';
import { firstNameOf, partnerApi, PartnerApiError, PartnerRoleType, PartnerSession } from '../lib/partnerApi';
import { registerPartnerDevicePush } from '../lib/partnerPush';

// Used only by the hidden website links below; re-enable together with them.
// const publicSite = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
const partnerSite = process.env.EXPO_PUBLIC_PARTNER_SITE_URL?.trim().replace(/\/+$/, '');

type Workspace = { type: Exclude<PartnerRoleType, 'customer'>; title: string; category: string; description: string; benefit: string; icon: string; route: string; setupRoute: string };
const workspaces: Workspace[] = [
  { type: 'technician', title: 'Technician', category: 'FIELD ENGINEERING', description: 'Service jobs, schedule, KYC and earnings', benefit: 'Deployment ready', icon: '⚒', route: '/technician/dashboard', setupRoute: '/become-professional?type=technician' },
  { type: 'designer', title: 'Interior professional', category: 'STUDIO PRO & ATELIER', description: 'Leads, projects, proposals and clients', benefit: 'Client pipeline included', icon: '◉', route: '/professional/dashboard', setupRoute: '/become-professional?type=designer' },
  { type: 'realtor', title: 'Realtor / Developer', category: 'PRIME REAL ESTATE', description: 'Projects, listings, media and leads', benefit: 'Portfolio verification', icon: '▦', route: '/realtor/dashboard', setupRoute: '/realtor/register' },
  { type: 'merchant', title: 'Marketplace seller', category: 'CURATED MATERIAL SUPPLY', description: 'Products, enquiries and orders', benefit: 'Multi-currency checkout', icon: '▣', route: '/store/dashboard', setupRoute: '/store/register' },
];

export default function PartnerHomeScreen() {
  const [session, setSession] = useState<PartnerSession | null>(null);
  const [merchant, setMerchant] = useState<{ isMerchant: boolean; canAccessDashboard: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [configError, setConfigError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashOpacity] = useState(() => new Animated.Value(1));
  const [splashScale] = useState(() => new Animated.Value(0.92));

  const loadSession = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setApiError('');
    try {
      const nextSession = await partnerApi.session();
      setSession(nextSession);
      if (nextSession.user) {
        // Whichever workspace they use, this phone should receive their alerts. Never awaited.
        void registerPartnerDevicePush();
        try {
          const result = await partnerApi.merchantStatus();
          setMerchant({ isMerchant: result.isMerchant, canAccessDashboard: result.canAccessDashboard });
        } catch (error) {
          setMerchant(null);
          setApiError(error instanceof Error ? error.message : 'Could not verify seller workspace access.');
        }
      } else setMerchant(null);
    } catch (error) {
      setSession(null);
      setMerchant(null);
      setApiError(error instanceof Error ? error.message : 'Could not load the partner session.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadSession(); }, 0);
    return () => clearTimeout(timer);
  }, [loadSession]);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(splashOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(splashScale, { toValue: 1, useNativeDriver: true, speed: 1.2, bounciness: 4 }),
    ]).start();
    const timer = setTimeout(() => Animated.timing(splashOpacity, { toValue: 0, duration: 420, useNativeDriver: true }).start(() => setSplashVisible(false)), 1200);
    return () => clearTimeout(timer);
  }, [splashOpacity, splashScale]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void loadSession(true); });
    return () => subscription.remove();
  }, [loadSession]);

  const user = session?.user ?? null;
  const welcomeName = firstNameOf(user);
  const initials = useMemo(() => {
    const name = firstNameOf(user);
    return name ? name.slice(0, 1).toUpperCase() : user?.email?.slice(0, 1).toUpperCase() || '•';
  }, [user]);

  async function openConfigured(base: string | undefined, path: string, missingMessage: string) {
    if (!base) { setConfigError(missingMessage); return; }
    setConfigError('');
    try { await Linking.openURL(`${base}${path}`); }
    catch { setConfigError('Kraftnex could not open that destination. Check the configured site URL.'); }
  }

  async function openWorkspace(item: Workspace) {
    if (item.type === 'technician') {
      router.push('/technician/setup');
      return;
    }
    if (!user) { router.push('/login' as never); return; }
    if (item.type === 'designer') {
      const designerRole = user.roles?.find(entry => entry.type === 'designer');
      router.push(designerRole ? '/professional/dashboard' : '/professional/onboarding');
      return;
    }
    const role = user.roles?.find(entry => entry.type === item.type);
    if (item.type === 'merchant' && !merchant) { setApiError('Seller access could not be verified. Refresh and try again.'); return; }
    const route = item.type === 'merchant'
      ? merchant?.canAccessDashboard ? item.route : item.setupRoute
      : role?.status === 'active' ? item.route : item.setupRoute;
    if (item.type === 'realtor') { router.push((role?.status === 'active' ? '/realtor/dashboard' : '/realtor/register') as never); return; }
    if (item.type === 'merchant') { router.push((merchant?.canAccessDashboard ? '/store/dashboard' : '/store/register') as never); return; }
    await openConfigured(partnerSite, route, 'Set EXPO_PUBLIC_PARTNER_SITE_URL to open partner workspace pages.');
  }

  async function signIn() {
    setLoginBusy(true); setLoginError('');
    try {
      const nextSession = await partnerApi.login(emailOrPhone.trim(), password);
      setSession(nextSession);
      setPassword('');
      setModalOpen(false);
      await loadSession(true);
    } catch (error) {
      setLoginError(error instanceof PartnerApiError ? error.message : 'Sign in failed. Please try again.');
    } finally { setLoginBusy(false); }
  }

  async function signOut() {
    try { await partnerApi.logout(); setSession({ user: null }); setMerchant(null); setModalOpen(false); }
    catch (error) { setLoginError(error instanceof Error ? error.message : 'Could not sign out.'); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PartnerBrand compact />
        {/* Website link hidden for now:
        <Pressable onPress={() => void openConfigured(publicSite, '', 'Set EXPO_PUBLIC_PUBLIC_SITE_URL to open Kraftnex.com.')} accessibilityRole="link"><Text style={styles.siteLink}>KraftNex.com ↗</Text></Pressable> */}
        <Pressable style={user ? styles.avatar : styles.signInButton} onPress={() => { if (user) { setLoginError(''); setModalOpen(true); } else router.push('/login' as never); }} accessibilityLabel={user ? 'Open account' : 'Sign in'}><Text style={user ? styles.avatarText : styles.signInText}>{user ? initials : 'Sign in'}</Text></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSession(true)} tintColor="#07523e" />}>
        <View style={styles.hero}>
          {/* Connection status banner hidden:
          <View style={styles.banner}><Text style={styles.bannerIcon}>⌁</Text><Text style={styles.bannerText}>{loading ? 'CONNECTING TO KRAFTNEX' : apiError ? 'CONNECTION NEEDS ATTENTION' : 'WORKSPACE ACTIVATION'}</Text><View style={[styles.dot, apiError ? styles.dotError : loading ? styles.dotLoading : styles.dotOk]} /></View> */}
          <Text style={styles.title}>{welcomeName ? `Welcome, ${welcomeName}` : 'Welcome, Partner'}</Text>
          <Text style={styles.intro}>Set up your first workspace to start receiving jobs, leads, enquiries and orders. You can add more later from the account menu.</Text>
          <Text style={styles.sectionTitle}>Choose Your Workspace</Text>
          <Text style={styles.helper}>Select the type of business you want to manage on KraftNex.</Text>
        </View>
        {workspaces.map(item => {
          const role = user?.roles?.find(entry => entry.type === item.type);
          const isVerifiedMerchant = item.type === 'merchant' && merchant?.isMerchant;
          const state = loading ? 'Checking access…' : role?.status === 'active' || (item.type === 'merchant' && merchant?.canAccessDashboard) ? 'Workspace active' : role?.status === 'pending' || isVerifiedMerchant ? 'Application in progress' : user ? 'Deployment ready' : 'Sign in to get started';
          return <View key={item.type} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, item.type === 'designer' && styles.iconPurple, item.type === 'realtor' && styles.iconBlue, item.type === 'merchant' && styles.iconYellow]}><Text style={styles.iconText}>{item.icon}</Text></View>
              <View style={styles.cardHeading}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.category}>{item.category}</Text></View>
              <View style={[styles.radio, (role?.status === 'active' || (item.type === 'merchant' && merchant?.canAccessDashboard)) && styles.radioSelected]} />
            </View>
            <Text style={styles.description}>{item.description}</Text>
            <View style={styles.cardBottom}><Text style={styles.benefit}>{state === 'Deployment ready' ? item.benefit : state}</Text><Pressable style={styles.setupButton} onPress={() => void openWorkspace(item)} disabled={loading}><Text style={styles.setupText}>{role?.status === 'active' || (item.type === 'merchant' && merchant?.canAccessDashboard) ? 'Open' : 'Set up'}  →</Text></Pressable></View>
          </View>;
        })}
        <View style={styles.securityCard}><Text style={styles.securityIcon}>◉</Text><View style={styles.securityCopy}><Text style={styles.securityTitle}>Bespoke Multi-Tenant Architecture</Text><Text style={styles.securityText}>Your data and commercial telemetry remain encrypted and strictly isolated within your organization’s perimeter.</Text></View></View>
        {/* Client-dashboard website card hidden for now:
        <View style={styles.portalCard}><Text style={styles.portalEyebrow}>⌁  Looking for your client dashboard?</Text><View style={styles.portalRow}><Pressable style={styles.portalButton} onPress={() => void openConfigured(publicSite, '/client/dashboard', 'Set EXPO_PUBLIC_PUBLIC_SITE_URL to open the client dashboard.')}><Text style={styles.portalButtonText}>Open it on KraftNex.com</Text></Pressable><Pressable onPress={() => void openConfigured(publicSite, '/client/dashboard', 'Set EXPO_PUBLIC_PUBLIC_SITE_URL to switch portals.')}><Text style={styles.switchText}>SWITCH PORTAL ↗</Text></Pressable></View></View> */}
        {!!apiError && <View style={styles.errorCard}><Text style={styles.errorTitle}>Partner connection unavailable</Text><Text style={styles.errorText}>{apiError}</Text><Pressable onPress={() => void loadSession(true)}><Text style={styles.retry}>Try again</Text></Pressable></View>}
        {!!configError && <View style={styles.configError}><Text style={styles.configErrorText}>{configError}</Text></View>}
        <View style={styles.footer}><Text style={styles.footerText}>♧  Encrypted Gateway</Text><Text style={styles.footerText}>KRAFTNEX V2.4</Text></View>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeader}><PartnerBrand compact /><Pressable onPress={() => setModalOpen(false)} accessibilityLabel="Close"><Text style={styles.close}>×</Text></Pressable></View>
          {user ? <><Text style={styles.modalTitle}>Your account</Text><Text style={styles.modalCopy}>{firstNameOf(user) || user.email || user.phone || 'Partner account'}</Text><Pressable style={styles.primaryButton} onPress={() => void signOut()}><Text style={styles.primaryText}>Sign out</Text></Pressable></> : <>
            <Text style={styles.modalTitle}>Sign in to Kraftnex</Text><Text style={styles.modalCopy}>Use your Kraftnex account to continue setting up a workspace.</Text>
            <TextInput style={styles.input} placeholder="Email or phone" placeholderTextColor="#84938d" value={emailOrPhone} onChangeText={setEmailOrPhone} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#84938d" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={() => void signIn()} />
            {!!loginError && <Text style={styles.loginError}>{loginError}</Text>}
            <Pressable style={[styles.primaryButton, loginBusy && styles.disabled]} onPress={() => void signIn()} disabled={loginBusy || !emailOrPhone.trim() || !password}>{loginBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}</Pressable>
            <Pressable onPress={() => { setModalOpen(false); router.push('/signup'); }}><Text style={styles.register}>Create a Kraftnex account →</Text></Pressable>
          </>}
        </View></View>
      </Modal>
      {splashVisible && <Animated.View pointerEvents="none" style={[styles.splash, { opacity: splashOpacity }]}><Animated.View style={{ transform: [{ scale: splashScale }] }}><PartnerBrand /></Animated.View><Text style={styles.splashCaption}>PARTNER WORKSPACE</Text></Animated.View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f6fc' },
  header: { height: 62, paddingHorizontal: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8ecea' },
  signInButton: { height: 32, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' },
  signInText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  siteLink: { color: '#73808b', fontSize: 11, fontWeight: '600' },
  avatar: { width: 29, height: 29, borderRadius: 16, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  scroll: { flex: 1 }, content: { paddingBottom: 20 },
  hero: { backgroundColor: '#edf9f7', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  banner: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, backgroundColor: '#e3f4ee', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 }, bannerIcon: { color: '#17644c', fontSize: 11 }, bannerText: { color: '#426c5d', fontSize: 7, fontWeight: '800', letterSpacing: 0.6 }, dot: { width: 7, height: 7, borderRadius: 4, marginLeft: 8 }, dotOk: { backgroundColor: '#43a781' }, dotError: { backgroundColor: '#d16a63' }, dotLoading: { backgroundColor: '#d3a64a' },
  title: { fontSize: 28, lineHeight: 34, color: '#082f29', fontWeight: '900', letterSpacing: -0.55 }, intro: { marginTop: 8, color: '#65766f', fontSize: 13, lineHeight: 19 }, sectionTitle: { color: '#122f29', fontSize: 19, fontWeight: '800', marginTop: 20 }, helper: { color: '#89948f', fontSize: 11, marginTop: 4 },
  card: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#edf0f1', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, minHeight: 120, shadowColor: '#123c30', shadowOpacity: 0.055, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, cardTop: { flexDirection: 'row', alignItems: 'center' }, iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#dff5ec', alignItems: 'center', justifyContent: 'center' }, iconPurple: { backgroundColor: '#e8e8ff' }, iconBlue: { backgroundColor: '#e5efff' }, iconYellow: { backgroundColor: '#fff2cb' }, iconText: { color: '#07523e', fontSize: 15, fontWeight: '800' }, cardHeading: { marginLeft: 8, flex: 1 }, cardTitle: { color: '#17352e', fontSize: 14, fontWeight: '800' }, category: { color: '#667a72', fontSize: 8, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 }, radio: { width: 8, height: 8, borderRadius: 5, borderWidth: 1, borderColor: '#77908a', marginRight: 1 }, radioSelected: { backgroundColor: '#087754', borderColor: '#087754' }, description: { color: '#61746e', fontSize: 11, marginTop: 11 }, cardBottom: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, benefit: { color: '#70817b', fontSize: 9, flex: 1 }, setupButton: { backgroundColor: '#f0f6f3', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11 }, setupText: { color: '#164338', fontSize: 10, fontWeight: '800' },
  securityCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#edf0f1', backgroundColor: '#f8fafb', padding: 14, flexDirection: 'row', alignItems: 'center' }, securityIcon: { width: 23, height: 23, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#fff', borderRadius: 12, color: '#477466', marginRight: 7, overflow: 'hidden' }, securityCopy: { flex: 1 }, securityTitle: { color: '#344a44', fontSize: 9, fontWeight: '800' }, securityText: { color: '#788680', fontSize: 7, lineHeight: 10, marginTop: 2 },
  portalCard: { marginHorizontal: 16, marginTop: 14, borderRadius: 15, backgroundColor: '#f0f1ff', padding: 13 }, portalEyebrow: { color: '#677582', fontSize: 8, marginBottom: 6 }, portalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, portalButton: { borderRadius: 7, backgroundColor: '#fff', paddingVertical: 7, paddingHorizontal: 9 }, portalButtonText: { color: '#24443c', fontSize: 8, fontWeight: '700' }, switchText: { color: '#74818b', fontSize: 7, fontWeight: '800' },
  errorCard: { backgroundColor: '#fff0ef', margin: 12, padding: 12, borderRadius: 11 }, errorTitle: { color: '#a7403c', fontSize: 12, fontWeight: '800' }, errorText: { color: '#a7403c', fontSize: 10, marginTop: 5 }, retry: { color: '#07523e', fontSize: 12, fontWeight: '800', marginTop: 7 }, configError: { marginHorizontal: 12, marginTop: 8, backgroundColor: '#fff0ef', padding: 8, borderRadius: 8 }, configErrorText: { color: '#aa4a44', fontSize: 9 }, footer: { marginHorizontal: 14, marginTop: 22, flexDirection: 'row', justifyContent: 'space-between' }, footerText: { color: '#71817a', fontSize: 7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,35,29,0.4)', justifyContent: 'center', padding: 22 }, modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { fontSize: 26, color: '#64746c' }, modalTitle: { color: '#123b30', fontSize: 20, fontWeight: '900', marginTop: 18 }, modalCopy: { color: '#687a73', fontSize: 12, lineHeight: 18, marginTop: 5 }, input: { borderWidth: 1, borderColor: '#dfe7e3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12, color: '#183c31', fontSize: 14 }, primaryButton: { backgroundColor: '#064a38', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' }, disabled: { opacity: 0.55 }, loginError: { color: '#ad4941', fontSize: 11, marginTop: 9 }, register: { color: '#17634c', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  splash: { ...StyleSheet.absoluteFill, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 10 }, splashCaption: { color: '#55756a', fontSize: 8, fontWeight: '800', letterSpacing: 1.7, marginTop: 13 },
});
