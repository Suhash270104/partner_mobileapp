import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PageHeading, StatePanel, StatusPill, VerticalFrame, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { ListingCreditsSheet } from '../../components/realtor/ListingCreditsSheet';
import { LeadSheet } from '../../components/realtor/LeadSheet';
import { LeadCard, ListingCard, NotificationCard, ProjectCard, PropertyCard } from '../../components/realtor/RealtorCards';
import { CreditsPill, IntroCard, PillButton, SectionHeader, SelectField, toOptions } from '../../components/realtor/RealtorControls';
import { AlertBanner, CreditsHero, EmptyState, ListRow, MenuItem, NavCard, SectionCard, StatCard, StatGrid, WorkspaceSheet } from '../../components/realtor/RealtorUi';
import { Data, LEAD_STATUS_OPTIONS, humanize, leadTone, liveListingUrl } from '../../components/realtor/realtorFormat';
import { PartnerApiError, partnerApi } from '../../lib/partnerApi';
import { getStudioSocket } from '../../lib/studioSocket';
import { realtorApi } from '../../lib/partnerVerticalApi';

type Tab = 'overview' | 'properties' | 'listings' | 'leads' | 'notifications';
const TAB_KEYS = ['overview', 'properties', 'listings', 'leads', 'notifications'];
const asRows = (value: unknown): Data[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Data[] : [];
const idOf = (item: Data | null | undefined) => String(item?._id || item?.id || '');
const first = (...values: unknown[]) => values.find(value => typeof value === 'string' && value.trim()) as string | undefined;
const ROLE: Record<string, string> = { individual_owner: 'Owner', agent: 'Agent', builder: 'Builder', developer: 'Developer' };

export default function RealtorDashboardScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(TAB_KEYS.includes(String(tabParam)) ? tabParam as Tab : 'overview');
  const [menuOpen, setMenuOpen] = useState(false);
  // Deep links (?tab=...) switch the visible section.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const next = String(tabParam); if (next === 'more') setMenuOpen(true); else if (TAB_KEYS.includes(next)) setTab(next as Tab); }, [tabParam]);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'signedOut' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Data | null>(null);
  const [properties, setProperties] = useState<Data[]>([]);
  const [listings, setListings] = useState<Data[]>([]);
  const [projects, setProjects] = useState<Data[]>([]);
  const [leads, setLeads] = useState<Data[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [notifications, setNotifications] = useState<Data[]>([]);
  const [unread, setUnread] = useState(0);
  const [hasDeveloper, setHasDeveloper] = useState(false);
  const [leadFilter, setLeadFilter] = useState('');
  const [lead, setLead] = useState<Data | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [marking, setMarking] = useState(false);

  const isBuilder = ['builder', 'developer'].includes(String(profile?.accountType));
  const approved = profile?.approvalStatus === 'approved';
  const credits = profile?.listingQuota == null ? null : Number(profile.listingQuota);

  const loadAll = useCallback(async () => {
    try {
      const profileResponse = await realtorApi.profile();
      const realtor = (profileResponse.realtor && typeof profileResponse.realtor === 'object' ? profileResponse.realtor : profileResponse) as Data;
      setProfile(realtor); setPhase('ready'); setError('');
      const builder = ['builder', 'developer'].includes(String(realtor.accountType));
      const [props, lists, leadRes, notes, projs, dev] = await Promise.allSettled([
        realtorApi.properties(), realtorApi.listings(), realtorApi.leads(leadFilter || undefined), realtorApi.notifications(),
        builder ? realtorApi.projects() : Promise.resolve({} as Data), builder ? realtorApi.developer.get() : Promise.resolve({} as Data),
      ]);
      if (props.status === 'fulfilled') setProperties(asRows(props.value.properties));
      if (lists.status === 'fulfilled') setListings(asRows(lists.value.listings));
      if (leadRes.status === 'fulfilled') { const rows = asRows(leadRes.value.leads); setLeads(rows); setLeadsTotal(Number((leadRes.value.pagination as Data | undefined)?.total ?? rows.length)); }
      if (notes.status === 'fulfilled') { const rows = asRows(notes.value.notifications); setNotifications(rows); setUnread(Number(notes.value.unreadCount ?? rows.filter(item => !item.read && !item.readAt).length)); }
      if (projs.status === 'fulfilled') setProjects(asRows(projs.value.projects));
      if (dev.status === 'fulfilled') setHasDeveloper(!!(dev.value.developer && typeof dev.value.developer === 'object'));
      if ([props, lists, leadRes, notes].every(result => result.status === 'rejected')) setError('Some workspace data could not be loaded. Pull down to retry.');
    } catch (cause) {
      if (cause instanceof PartnerApiError && (cause.status === 401 || cause.status === 403)) { setPhase('signedOut'); setError('Sign in to your realtor account to continue.'); }
      else { setPhase(current => current === 'ready' ? current : 'error'); setError(cause instanceof Error ? cause.message : 'Could not load the realtor workspace.'); }
    }
  }, [leadFilter]);

  // Reload whenever the screen regains focus (e.g. after posting a property) or the server-side lead filter changes.
  useFocusEffect(useCallback(() => { void loadAll(); }, [loadAll]));
  // A buyer unlocking a listing pushes `realestate:new_lead` over the shared socket; refresh the badge and lists.
  useEffect(() => {
    const socket = getStudioSocket();
    if (!socket) return;
    const refresh = () => { void loadAll(); };
    socket.on('realestate:new_lead', refresh);
    return () => { socket.off('realestate:new_lead', refresh); };
  }, [loadAll]);

  const refresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };
  const openCredits = () => setCreditsOpen(true);
  const goTab = (next: Tab) => { setError(''); setTab(next); };
  const company = first(profile?.companyName, profile?.fullName) || 'Realtor workspace';
  const stats = useMemo(() => ({
    active: listings.filter(item => item.status === 'published').length,
    closed: listings.filter(item => item.status === 'sold' || item.status === 'rented').length,
  }), [listings]);

  // ---- actions -------------------------------------------------------------------------------------------------
  async function run(id: string, action: () => Promise<unknown>, failure: string, after?: () => void) {
    setBusyId(id);
    try { await action(); await loadAll(); after?.(); }
    catch (cause) { Alert.alert(failure, cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusyId(''); }
  }
  function submitListing(listing: Data | undefined, propertyId = '') {
    const id = idOf(listing);
    if (!id) { Alert.alert('No listing yet', 'This property has no draft listing to submit.'); return; }
    setBusyId(propertyId || id);
    realtorApi.submitListing(id).then(() => loadAll()).then(() => Alert.alert('Submitted for review', 'Our team will review this listing. Editing is locked until the review finishes.'))
      .catch(cause => {
        const code = cause instanceof PartnerApiError ? cause.code : '';
        const message = cause instanceof Error ? cause.message : 'Could not submit this listing.';
        if (code === 'MIN_PHOTOS_REQUIRED' || code === 'MAX_PHOTOS_EXCEEDED' || code === 'LOCATION_PIN_REQUIRED') {
          Alert.alert('Almost there', message, propertyId ? [{ text: 'Not now', style: 'cancel' }, { text: 'Edit property', onPress: () => router.push(`/realtor/property/${propertyId}` as never) }] : [{ text: 'OK' }]);
        } else Alert.alert('Could not submit', message);
      }).finally(() => setBusyId(''));
  }
  function deleteProperty(item: Data) {
    Alert.alert('Delete this property?', 'Its listings will be deleted too. The listing credit used to post it is NOT refunded.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run(idOf(item), () => realtorApi.properties('DELETE', undefined, idOf(item)), 'Could not delete property') },
    ]);
  }
  function deleteListing(item: Data) {
    Alert.alert('Delete this listing?', 'Only draft listings can be deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run(idOf(item), () => realtorApi.listings('DELETE', undefined, idOf(item)), 'Could not delete listing') },
    ]);
  }
  function editProperty(item: Data) {
    const go = () => router.push(`/realtor/property/${idOf(item)}` as never);
    if (item.listing?.status === 'published') Alert.alert('Edit a live property?', 'This property is live on the marketplace. Changes you save may be visible to buyers immediately.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Edit anyway', onPress: go }]);
    else go();
  }
  function viewLive(listingId: string) {
    const url = liveListingUrl(listingId);
    if (!url) { Alert.alert('Public site not configured', 'Set EXPO_PUBLIC_PUBLIC_SITE_URL to open live listings.'); return; }
    void Linking.openURL(url).catch(() => Alert.alert('Could not open the listing', url));
  }
  async function markAllRead() {
    setMarking(true);
    try { await realtorApi.markAllNotificationsRead(); await loadAll(); }
    catch (cause) { Alert.alert('Could not update notifications', cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setMarking(false); }
  }
  async function signOut() {
    try { await partnerApi.logout(); } catch { /* leave the workspace even if the server call fails */ }
    setMenuOpen(false); router.replace('/');
  }

  // ---- navigation ----------------------------------------------------------------------------------------------
  const tabs = [
    { key: 'overview', label: 'Dashboard', icon: '' }, { key: 'properties', label: isBuilder ? 'Projects' : 'My properties', icon: '' },
    { key: 'leads', label: 'Buyer leads', icon: '' }, { key: 'notifications', label: 'Notifications', icon: '' }, { key: 'more', label: 'More', icon: '' },
  ];
  const menuItems: MenuItem[] = [
    { key: 'overview', label: 'Dashboard', icon: 'dashboard', onPress: () => goTab('overview') },
    { key: 'properties', label: isBuilder ? 'Projects' : 'My properties', icon: isBuilder ? 'building' : 'home', onPress: () => goTab('properties') },
    { key: 'listings', label: 'Published listings', icon: 'tag', onPress: () => goTab('listings') },
    { key: 'leads', label: 'Buyer leads', icon: 'users', onPress: () => goTab('leads') },
    { key: 'notifications', label: 'Notifications', icon: 'bell', onPress: () => goTab('notifications'), badge: unread },
    ...(isBuilder ? [{ key: 'developer', label: 'Developer profile', icon: 'briefcase', onPress: () => router.push('/realtor/developer') }] : []),
    { key: 'kyc', label: 'Verification & profile', icon: 'shield', onPress: () => router.push('/realtor/onboarding') },
    { key: 'switch', label: 'Switch workspace', icon: 'layers', onPress: () => router.replace('/') },
  ];
  const verification = !profile ? null : profile.approvalStatus === 'rejected'
    ? <AlertBanner tone="red" title="Verification needs attention" message={first(profile.approvalNote) || 'An administrator could not verify your KYC. Update your details and resubmit.'} actionLabel="Review KYC" onAction={() => router.push('/realtor/onboarding')} />
    : !approved ? <AlertBanner title="Account pending verification" message="You can build drafts now. Public publishing opens once an administrator verifies your KYC." actionLabel="Review KYC" onAction={() => router.push('/realtor/onboarding')} /> : null;

  const newProperty = () => router.push('/realtor/property/new' as never);

  return <VerticalFrame title="Realtor workspace" initials={company.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')} onAvatar={() => setMenuOpen(true)}
    tabs={phase === 'ready' ? tabs : []} activeTab={tab === 'listings' ? 'more' : tab} onTab={key => key === 'more' ? setMenuOpen(true) : goTab(key as Tab)}
    refreshing={refreshing} onRefresh={phase === 'ready' ? () => void refresh() : undefined} badges={{ notifications: unread }}>
    {phase === 'loading' ? <StatePanel title="Loading your workspace" message="Connecting to the realtor workspace…" /> : null}
    {phase === 'error' ? <StatePanel title="Couldn’t load the realtor workspace" message={error} retry={() => void loadAll()} /> : null}
    {phase === 'signedOut' ? <View style={s.gap}>
      <PageHeading title="Open your Realty workspace" subtitle="Realty uses the same Kraftnex partner sign-in as your other workspaces. Sign in once, then pick Realtor from the home screen." />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <PillButton title="Go to partner home" onPress={() => router.replace('/')} />
      <PillButton title="Set up realtor workspace" variant="ghost" onPress={() => router.push('/realtor/register')} />
    </View> : null}

    {phase === 'ready' ? <View style={s.gap}>
      {error ? <StatePanel title="Some workspace data is unavailable" message={error} retry={() => void loadAll()} /> : null}

      {tab === 'overview' ? <>
        <PageHeading title="Dashboard" subtitle="Your listings, leads and credits at a glance." />
        {verification}
        {!approved && profile?.onboardingStatus !== 'submitted' && Number(profile?.profileCompleteness || 0) < 100
          ? <AlertBanner tone="blue" icon="user" title="Complete your profile & KYC" message={`Your profile is ${Math.round(Number(profile?.profileCompleteness || 0))}% complete.`} actionLabel="Continue onboarding" onAction={() => router.push('/realtor/onboarding')} /> : null}
        <StatGrid>
          <StatCard label="Active listings" value={stats.active} caption="Live on the marketplace" icon="tag" tone="green" onPress={() => goTab('listings')} />
          <StatCard label="Buyer leads" value={leadsTotal} caption="Enquiries received" icon="users" tone="blue" onPress={() => goTab('leads')} />
          <StatCard label="Sold / Rented" value={stats.closed} caption="Closed transactions" icon="clock" tone="amber" />
          <StatCard label="Listing credits" value={credits} caption={credits && credits > 0 ? 'Available to post' : 'Buy a pack to post'} icon="coins" tone="amber" onPress={openCredits} />
        </StatGrid>
        {credits != null && credits <= 0 ? <CreditsHero eyebrow="Out of credits" title="Buy a listing pack to keep posting" message="Add a property and publish it to reach verified buyers." actionLabel="Buy Listing Pack" onAction={openCredits} /> : null}
        <NavCard icon={isBuilder ? 'building' : 'home'} tone="green" title={isBuilder ? 'Projects' : 'My properties'} detail={isBuilder ? 'Developments, towers and unit inventory' : 'Property catalogue and specifications'} onPress={() => goTab('properties')} />
        <NavCard icon="tag" tone="violet" title="Published listings" detail="What buyers see on the marketplace" onPress={() => goTab('listings')} />
        <NavCard icon="users" tone="amber" title="Buyer leads" detail="People who unlocked your contact details" onPress={() => goTab('leads')} />
        <SectionCard title="Recent leads" actionLabel="View all" onAction={() => goTab('leads')}>
          {leads.length ? leads.slice(0, 5).map(item => <ListRow key={idOf(item)} title={first(item.customerName, item.buyerName) || 'Buyer enquiry'} detail={first(item.listing?.title, item.propertyTitle)}
            trailing={<StatusPill label={humanize(item.status || 'unlocked')} tone={leadTone(item.status) === 'green' ? 'green' : leadTone(item.status) === 'red' ? 'red' : leadTone(item.status) === 'violet' ? 'violet' : leadTone(item.status) === 'blue' ? 'blue' : 'amber'} />} onPress={() => setLead(item)} />)
            : <EmptyState icon="users" title="No leads yet" message="Enquiries appear here as soon as buyers unlock one of your listings." actionLabel="Add a property" onAction={newProperty} />}
        </SectionCard>
      </> : null}

      {tab === 'properties' && !isBuilder ? <>
        <PageHeading title="My properties" subtitle="Your property catalogue." />
        {verification}
        <IntroCard chip="My properties" chipIcon="home" title="My properties" description="Post and manage your property catalogue with society details, layout specs, amenities, nearby landmarks, and photos."
          actionLabel={credits != null && credits <= 0 ? 'Buy Listing Credits' : 'Post New Property'} actionIcon={credits != null && credits <= 0 ? 'coins' : 'plus'} onAction={credits != null && credits <= 0 ? openCredits : newProperty}
          note={credits != null && credits <= 0 ? '0 Listing Credits Available — buy a pack to post your next property.' : undefined} />
        {credits != null && credits > 0 ? <CreditsPill credits={credits} onTopUp={openCredits} /> : null}
        {properties.length ? properties.map(item => <PropertyCard key={idOf(item)} item={item} busy={busyId === idOf(item)} onEdit={() => editProperty(item)} onDelete={() => deleteProperty(item)}
          onSubmit={() => submitListing(item.listing, idOf(item))} onViewLive={() => viewLive(idOf(item.listing))} />)
          : <EmptyState icon="home" title="No properties yet" message="Post your first property to start receiving buyer enquiries." actionLabel={credits != null && credits <= 0 ? 'Buy Listing Credits' : 'Post New Property'} onAction={credits != null && credits <= 0 ? openCredits : newProperty} />}
      </> : null}

      {tab === 'properties' && isBuilder ? <>
        <PageHeading title="Projects" subtitle="Developments, towers and unit inventory." />
        {verification}
        <SectionHeader title="Projects" actionLabel="New Project" onAction={() => router.push('/realtor/project/new' as never)} disabled={!hasDeveloper} />
        {!hasDeveloper ? <Text style={s.warn}>Create a developer profile in the Developer tab before adding a project.</Text> : null}
        {!hasDeveloper ? <PillButton title="Create developer profile" icon="briefcase" variant="soft" onPress={() => router.push('/realtor/developer')} /> : null}
        {credits != null && credits > 0 ? <CreditsPill credits={credits} onTopUp={openCredits} /> : null}
        {projects.length ? projects.map(item => <ProjectCard key={idOf(item)} item={item} busy={busyId === idOf(item)} onOpen={() => router.push(`/realtor/project/${idOf(item)}` as never)}
          onSubmit={() => void run(idOf(item), () => realtorApi.submitProject(idOf(item)), 'Could not submit project')} />)
          : <View style={s.dashed}><EmptyState icon="inbox" title="No projects yet" message="Create your first project to start adding configurations and listings." /></View>}
      </> : null}

      {tab === 'listings' ? <>
        <PageHeading title="Published listings" subtitle="What buyers see on the marketplace." />
        {verification}
        <SectionHeader title="Listings" actionLabel="New Listing" onAction={() => router.push('/realtor/listing/new' as never)} />
        {listings.length ? listings.map(item => <ListingCard key={idOf(item)} item={item} busy={busyId === idOf(item)} onOpen={() => router.push(`/realtor/listing/${idOf(item)}` as never)}
          onSubmit={() => submitListing(item)} onDelete={() => deleteListing(item)} onViewLive={() => viewLive(idOf(item))} />)
          : <EmptyState icon="tag" title="No listings yet" message="Post a property or create a project, then submit its listing for review." />}
      </> : null}

      {tab === 'leads' ? <>
        <PageHeading title="Buyer leads" subtitle="Enquiries from buyers who unlocked your details." />
        <SelectField label="Leads" value={leadFilter} options={[{ value: '', label: 'All statuses' }, ...toOptions(LEAD_STATUS_OPTIONS)]} onChange={setLeadFilter} placeholder="All statuses" />
        {leads.length ? leads.map(item => <LeadCard key={idOf(item)} item={item} onOpen={() => setLead(item)} />)
          : <EmptyState icon="users" title={leadFilter ? 'No leads with this status' : 'No leads yet'} message={leadFilter ? 'Try another status or choose All statuses.' : 'Enquiries appear here as soon as buyers unlock one of your listings.'} />}
      </> : null}

      {tab === 'notifications' ? <>
        <PageHeading title="Notifications" subtitle="New leads and review updates." />
        <SectionHeader title="Notifications" actionLabel={marking ? 'Marking…' : 'Mark all read'} actionIcon="checkCheck" onAction={unread > 0 ? () => void markAllRead() : undefined} />
        {notifications.length ? notifications.map(item => <NotificationCard key={idOf(item)} item={item} onMarkRead={() => void run(idOf(item), () => realtorApi.markNotificationRead(idOf(item)), 'Could not mark as read')} />)
          : <EmptyState icon="bell" title="You’re all caught up" message="New leads and listing updates will appear here." />}
      </> : null}
    </View> : null}

    <LeadSheet lead={lead} onClose={() => setLead(null)} onSaved={() => void loadAll()} />
    <WorkspaceSheet visible={menuOpen} onClose={() => setMenuOpen(false)} name={company} role={`${ROLE[String(profile?.accountType)] || 'Realtor'} portal`} items={menuItems} activeKey={tab}
      credits={credits} onBuyCredits={openCredits} statusLabel={approved ? 'Verified' : profile?.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'} statusTone={approved ? 'green' : profile?.approvalStatus === 'rejected' ? 'red' : 'amber'}
      completeness={profile?.profileCompleteness == null ? null : Number(profile.profileCompleteness)} onSignOut={() => void signOut()} />
    <ListingCreditsSheet visible={creditsOpen} onClose={() => setCreditsOpen(false)} onPurchased={() => void loadAll()} />
  </VerticalFrame>;
}

const s = StyleSheet.create({
  gap: { gap: 14 }, error: { color: palette.red, fontSize: 13, lineHeight: 19 },
  warn: { color: '#c26a00', fontSize: 15, fontWeight: '800', lineHeight: 22 }, dashed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#d7dfdb', borderRadius: 24, backgroundColor: '#fff' },
});
