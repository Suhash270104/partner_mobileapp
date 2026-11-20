import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PartnerBrand } from '../components/PartnerBrand';
import { Icon } from '../components/Icon';
import { AccountSummary } from '../components/auth/AccountSummary';
import { authApi } from '../lib/auth';
import { setPendingPhone } from '../lib/pendingPhone';
import { accountNeedsDetails, firstNameOf, partnerApi, PartnerRoleType, PartnerSession } from '../lib/partnerApi';
import { registerPartnerDevicePush } from '../lib/partnerPush';
import { hasAutoOpened, LaunchTarget, markAutoOpened, resolveStudioLaunch, resolveTechnicianLaunch } from '../lib/workspaceLaunch';

// Used only by the hidden website links below; re-enable together with them.
// const publicSite = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
const partnerSite = process.env.EXPO_PUBLIC_PARTNER_SITE_URL?.trim().replace(/\/+$/, '');

type Workspace = { type: Exclude<PartnerRoleType, 'customer'>; title: string; category: string; description: string; benefit: string; icon: string; route: string; setupRoute: string };
const workspaces: Workspace[] = [
  { type: 'technician', title: 'Technician', category: 'FIELD ENGINEERING', description: 'Service jobs, schedule, KYC and earnings', benefit: 'Deployment ready', icon: 'settings', route: '/technician/dashboard', setupRoute: '/become-professional?type=technician' },
  { type: 'designer', title: 'Professional', category: 'STUDIO PRO & ATELIER', description: 'Leads, projects, proposals and clients', benefit: 'Client pipeline included', icon: 'briefcase', route: '/professional/dashboard', setupRoute: '/become-professional?type=designer' },
  { type: 'realtor', title: 'Realtor / Developer', category: 'PRIME REAL ESTATE', description: 'Projects, listings, media and leads', benefit: 'Portfolio verification', icon: 'building', route: '/realtor/dashboard', setupRoute: '/realtor/register' },
  { type: 'merchant', title: 'Marketplace seller', category: 'CURATED MATERIAL SUPPLY', description: 'Products, enquiries and quotations', benefit: 'Enquiry-based B2B marketplace', icon: 'tag', route: '/store', setupRoute: '/store/register' },
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

  const loadSession = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setApiError('');
    // A returning person sees their account at once while the server confirms it (and keeps it when offline).
    let shownFromCache = false;
    if (!refresh) {
      const cached = await partnerApi.cachedSession();
      if (cached?.user) { setSession(cached); setLoading(false); shownFromCache = true; }
    }
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
      // Unreachable: keep the saved account rather than signing the person out of the screen.
      if (!shownFromCache) { setSession(null); setMerchant(null); }
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
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void loadSession(true); });
    return () => subscription.remove();
  }, [loadSession]);

  const user = session?.user ?? null;
  // An account with no name or email (created by phone alone) cannot go further until it has both.
  const needsDetails = accountNeedsDetails(user);
  useEffect(() => { if (needsDetails && !loading) router.push('/complete-profile' as never); }, [needsDetails, loading]);

  // A returning, already-set-up partner should land on their dashboard, not on the workspace picker
  // or the onboarding wizard. Runs once per sign-in; coming back to this screen later keeps the picker.
  useEffect(() => {
    if (!user || loading || needsDetails || hasAutoOpened(user.id)) return;
    const partnerRoles = (user.roles ?? []).filter(role => role.type !== 'customer');
    const target = partnerRoles.length === 1
      ? partnerRoles[0].type
      : user.activeRole && user.activeRole !== 'customer' ? user.activeRole : null;
    if (!target) return;
    markAutoOpened(user.id);
    void (async () => {
      // Open the dashboard only for finished workspaces; otherwise stay on the picker and let them choose.
      const launch = target === 'technician' ? await resolveTechnicianLaunch() : target === 'designer' ? await resolveStudioLaunch() : null;
      if (launch) { if (launch.kind === 'open') router.replace(launch.path as never); }
      else if (target === 'realtor') router.replace('/realtor/dashboard' as never);
    })();
  }, [user, loading, needsDetails]);

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

  // What each workspace tile says and does, from the server's saved state (never guessed).
  type Tone = 'green' | 'amber' | 'blue' | 'red' | 'grey';
  type Status = { label: string; tone: Tone; action: string; ready: boolean; resume: boolean };
  const checking: Status = { label: 'Checking…', tone: 'grey', action: 'Open', ready: false, resume: false };
  const [launch, setLaunch] = useState<{ uid: string; designer?: Status; technician?: Status }>({ uid: '' });
  useEffect(() => {
    if (!user || loading) return;
    const uid = user.id;
    let live = true;
    const fromLaunch = (target: LaunchTarget): Status => target.kind === 'open' ? { label: 'Active', tone: 'green', action: 'Open', ready: true, resume: false }
      : target.kind === 'resume' ? { label: 'Setup in progress', tone: 'blue', action: 'Continue', ready: false, resume: true }
      : target.kind === 'blocked' ? { label: 'Not approved', tone: 'red', action: 'Details', ready: false, resume: false }
      : target.kind === 'error' ? { label: 'Could not check', tone: 'grey', action: 'Retry', ready: false, resume: false }
      : { label: 'Not set up', tone: 'grey', action: 'Set up', ready: false, resume: false };
    void resolveStudioLaunch().then(t => { if (live) setLaunch(prev => ({ ...(prev.uid === uid ? prev : { uid }), designer: fromLaunch(t) })); });
    void resolveTechnicianLaunch().then(t => { if (live) setLaunch(prev => ({ ...(prev.uid === uid ? prev : { uid }), technician: fromLaunch(t) })); });
    return () => { live = false; };
  }, [user, loading]);

  function statusOf(item: Workspace): Status {
    if (loading) return checking;
    if (!user) return { label: 'Sign in to start', tone: 'grey', action: 'Sign in', ready: false, resume: false };
    if (item.type === 'designer' || item.type === 'technician') return (launch.uid === user.id ? launch[item.type] : undefined) ?? checking;
    if (item.type === 'merchant') {
      if (merchant?.canAccessDashboard) return { label: 'Active', tone: 'green', action: 'Open', ready: true, resume: false };
      if (merchant?.isMerchant) return { label: 'Under review', tone: 'amber', action: 'View status', ready: false, resume: false };
      return { label: 'Not set up', tone: 'grey', action: 'Set up', ready: false, resume: false };
    }
    const role = user.roles?.find(entry => entry.type === item.type);
    if (!role) return { label: 'Not set up', tone: 'grey', action: 'Set up', ready: false, resume: false };
    if (role.status === 'active') return { label: 'Active', tone: 'green', action: 'Open', ready: true, resume: false };
    if (role.status === 'rejected' || role.status === 'suspended') return { label: 'Not approved', tone: 'red', action: 'Details', ready: false, resume: false };
    return { label: 'Under review', tone: 'amber', action: 'View status', ready: false, resume: false };
  }
  const tones: Record<Tone, { bg: string; fg: string }> = {
    green: { bg: '#dff5ec', fg: '#07623f' }, amber: { bg: '#fff1cf', fg: '#8a5a00' }, blue: { bg: '#e3ecff', fg: '#2650b0' },
    red: { bg: '#ffe4e1', fg: '#a3322b' }, grey: { bg: '#eef1f0', fg: '#5d6d66' },
  };
  const accents: Record<string, string> = { technician: '#dff5ec', designer: '#e8e8ff', realtor: '#e5efff', merchant: '#fff2cb' };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const ordered = [...workspaces].sort((a, b) => Number(statusOf(b).ready) - Number(statusOf(a).ready));
  const featured = user ? ordered.find(item => statusOf(item).ready || statusOf(item).resume) : undefined;
  const featuredStatus = featured ? statusOf(featured) : null;

  /** Follows a launch decision. A failure to tell is shown, never turned into a setup wizard. */
  function follow(target: LaunchTarget, signedOutPath: string) {
    if (target.kind === 'error' || target.kind === 'blocked') { setApiError(target.message); return; }
    setApiError('');
    router.push((target.kind === 'signedOut' ? signedOutPath : target.path) as never);
  }

  async function openWorkspace(item: Workspace) {
    // A new technician registers inside the setup wizard itself, so no account is needed to open it.
    if (item.type === 'technician' && !user) { router.push('/technician/setup'); return; }
    if (!user) { router.push('/login' as never); return; }
    // Technician and studio: the server's saved profile decides (dashboard, resume, or start), not this session's role list,
    // because a workspace created on the website may not be listed there.
    if (item.type === 'technician') { follow(await resolveTechnicianLaunch(), '/login'); return; }
    if (item.type === 'designer') { follow(await resolveStudioLaunch(), '/login'); return; }
    const role = user.roles?.find(entry => entry.type === item.type);
    if (item.type === 'merchant' && !merchant) { setApiError('Seller access could not be verified. Refresh and try again.'); return; }
    const route = item.type === 'merchant'
      ? merchant?.canAccessDashboard ? item.route : item.setupRoute
      : role?.status === 'active' ? item.route : item.setupRoute;
    // Any existing realtor role (pending included) opens the dashboard, which guides unfinished onboarding; only people without one register.
    if (item.type === 'realtor') { router.push((role ? '/realtor/dashboard' : '/realtor/register') as never); return; }
    if (item.type === 'merchant') { router.push((merchant?.canAccessDashboard ? '/store' : '/store/register') as never); return; }
    await openConfigured(partnerSite, route, 'Set EXPO_PUBLIC_PARTNER_SITE_URL to open partner workspace pages.');
  }

  async function signIn() {
    setLoginBusy(true); setLoginError('');
    try {
      const outcome = await authApi.login(emailOrPhone.trim(), password);
      setPassword('');
      setModalOpen(false);
      // An account without a verified phone is finished on its own screen before a session exists.
      if (outcome.kind === 'verifyPhone') { setPendingPhone(outcome.pending); router.push('/verify-phone' as never); return; }
      await loadSession(true);
    } catch (error) {
      setLoginError(error instanceof Error && error.message ? error.message : 'Sign in failed. Please try again.');
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
        <Pressable style={user ? styles.avatar : styles.signInButton} onPress={() => { if (user) { setLoginError(''); setModalOpen(true); } else router.push('/login' as never); }} accessibilityLabel={user ? 'Open account' : 'Sign in'}><Text style={user ? styles.avatarText : styles.signInText}>{user ? initials : 'Sign in'}</Text></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSession(true)} tintColor="#07523e" />}>
        <View style={styles.hero}>
          <Text style={styles.title}>{user ? `${greeting}${welcomeName ? `, ${welcomeName}` : ''}` : 'One login for every way you work'}</Text>
          <Text style={styles.intro}>{user ? 'Pick a workspace to manage jobs, leads, listings and orders.' : 'Choose a workspace to get started. Sign in from the header to continue.'}</Text>
        </View>

        {featured && featuredStatus ? (
          <View style={styles.featured}>
            <Text style={styles.featuredEyebrow}>{featuredStatus.resume ? 'FINISH YOUR SETUP' : 'JUMP BACK IN'}</Text>
            <Text style={styles.featuredTitle}>{featured.title}</Text>
            <View style={styles.featuredChip}><Text style={styles.featuredChipText}>{featuredStatus.label}</Text></View>
            <Pressable style={styles.featuredButton} onPress={() => void openWorkspace(featured)} accessibilityRole="button"><Text style={styles.featuredButtonText}>{featuredStatus.resume ? 'Continue setup' : 'Open dashboard'}  →</Text></Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{user ? 'Your workspaces' : 'Workspaces'}</Text>
        <View style={styles.grid}>
          {ordered.map(item => {
            const status = statusOf(item);
            const tone = tones[status.tone];
            return (
              <Pressable key={item.type} style={styles.tile} onPress={() => void openWorkspace(item)} disabled={loading} accessibilityRole="button" accessibilityLabel={user ? `${item.title}, ${status.label}` : item.title}>
                <View style={[styles.iconBox, { backgroundColor: accents[item.type] }]}><Icon name={item.icon} size={22} color="#07523e" /></View>
                <Text style={styles.tileTitle}>{item.title}</Text>
                <Text style={styles.tileDesc}>{item.description}</Text>
                {user && <View style={[styles.chip, { backgroundColor: tone.bg }]}><Text style={[styles.chipText, { color: tone.fg }]}>{status.label}</Text></View>}
                {user && <View style={styles.tileButton}><Text style={styles.tileButtonText}>{status.action}  →</Text></View>}
              </Pressable>
            );
          })}
        </View>

        {!!apiError && <View style={styles.errorCard}><Text style={styles.errorTitle}>Something needs attention</Text><Text style={styles.errorText}>{apiError}</Text><Pressable onPress={() => void loadSession(true)}><Text style={styles.retry}>Try again</Text></Pressable></View>}
        {!!configError && <View style={styles.configError}><Text style={styles.configErrorText}>{configError}</Text></View>}
        {user ? <View style={styles.footer}><Pressable onPress={() => void signOut()} hitSlop={10}><Text style={styles.footerLink}>Sign out</Text></Pressable></View> : null}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeader}><PartnerBrand compact /><Pressable onPress={() => setModalOpen(false)} accessibilityLabel="Close"><Text style={styles.close}>×</Text></Pressable></View>
          {user ? <><AccountSummary user={user} />{/* Signed-in devices is switched off for now. Re-enable by uncommenting:
          <Pressable style={styles.primaryButton} onPress={() => { setModalOpen(false); router.push('/devices' as never); }}><Text style={styles.primaryText}>Signed-in devices</Text></Pressable> */}<Pressable style={styles.primaryButton} onPress={() => void signOut()}><Text style={styles.primaryText}>Sign out</Text></Pressable></> : <>
            <Text style={styles.modalTitle}>Sign in to Kraftnex</Text><Text style={styles.modalCopy}>Use your Kraftnex account to continue setting up a workspace.</Text>
            <TextInput style={styles.input} placeholder="Email or phone" placeholderTextColor="#84938d" value={emailOrPhone} onChangeText={setEmailOrPhone} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#84938d" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={() => void signIn()} />
            {!!loginError && <Text style={styles.loginError}>{loginError}</Text>}
            <Pressable style={[styles.primaryButton, loginBusy && styles.disabled]} onPress={() => void signIn()} disabled={loginBusy || !emailOrPhone.trim() || !password}>{loginBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}</Pressable>
            <Pressable onPress={() => { setModalOpen(false); router.push('/signup'); }}><Text style={styles.register}>Create a Kraftnex account →</Text></Pressable>
          </>}
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f6fc' },
  header: { height: 64, paddingHorizontal: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8ecea' },
  signInButton: { height: 38, paddingHorizontal: 20, borderRadius: 19, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' },
  signInText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  title: { fontSize: 20, lineHeight: 27, color: '#082f29', fontWeight: '900', letterSpacing: -0.25 },
  intro: { marginTop: 7, color: '#5c6e67', fontSize: 14, lineHeight: 20 },
  featured: { marginHorizontal: 16, marginTop: 18, backgroundColor: '#064a38', borderRadius: 22, padding: 20, shadowColor: '#064a38', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  featuredEyebrow: { color: '#9fd8c3', fontSize: 12, fontWeight: '800', letterSpacing: 0.9 },
  featuredTitle: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 6 },
  featuredCopy: { color: '#cfe8de', fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  featuredChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  featuredChipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  featuredButton: { backgroundColor: '#fff', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  featuredButtonText: { color: '#064a38', fontSize: 15.5, fontWeight: '800' },
  featuredLink: { color: '#cfe8de', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  sectionTitle: { color: '#122f29', fontSize: 16, fontWeight: '800', marginTop: 22, marginHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginTop: 12 },
  tile: { flexGrow: 1, flexBasis: '46%', backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#edf0f1', padding: 14, shadowColor: '#123c30', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { color: '#17352e', fontSize: 16, fontWeight: '800', marginTop: 12 },
  tileDesc: { color: '#5c6e67', fontSize: 13, lineHeight: 18, marginTop: 4, minHeight: 36 },
  chip: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  chipText: { fontSize: 12.5, fontWeight: '800' },
  tileButton: { backgroundColor: '#f0f6f3', borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  tileButtonText: { color: '#164338', fontSize: 14, fontWeight: '800' },
  errorCard: { backgroundColor: '#fff0ef', marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: 14 },
  errorTitle: { color: '#a7403c', fontSize: 15, fontWeight: '800' },
  errorText: { color: '#a7403c', fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  retry: { color: '#07523e', fontSize: 14.5, fontWeight: '800', marginTop: 9 },
  configError: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#fff0ef', padding: 12, borderRadius: 10 },
  configErrorText: { color: '#aa4a44', fontSize: 13 },
  footer: { marginTop: 26, alignItems: 'center' },
  footerLink: { color: '#5c6e67', fontSize: 14.5, fontWeight: '700', paddingVertical: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,35,29,0.4)', justifyContent: 'center', padding: 22 }, modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, close: { fontSize: 26, color: '#64746c' }, modalTitle: { color: '#123b30', fontSize: 20, fontWeight: '900', marginTop: 18 }, modalCopy: { color: '#687a73', fontSize: 12, lineHeight: 18, marginTop: 5 }, input: { borderWidth: 1, borderColor: '#dfe7e3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12, color: '#183c31', fontSize: 14 }, primaryButton: { backgroundColor: '#064a38', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' }, disabled: { opacity: 0.55 }, loginError: { color: '#ad4941', fontSize: 11, marginTop: 9 }, register: { color: '#17634c', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 14 },
});
