import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SectionTitle, StatePanel, StatusPill, VerticalFrame, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { ListingCreditsSheet } from '../../components/realtor/ListingCreditsSheet';
import { SummaryHeader, formatPrice } from '../../components/realtor/RealtorShared';
import { PartnerApiError } from '../../lib/partnerApi';
import { realtorApi } from '../../lib/partnerVerticalApi';

type Data = Record<string, unknown>;
type Tab = 'overview' | 'properties' | 'listings' | 'leads' | 'more';
const TABS = [{ key: 'overview', label: 'Overview', icon: '⌂' }, { key: 'properties', label: 'Properties', icon: '▦' }, { key: 'listings', label: 'Listings', icon: '▤' }, { key: 'leads', label: 'Leads', icon: '♧' }, { key: 'more', label: 'Realty', icon: '•••' }];
const asRows = (value: unknown): Data[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Data[] : [];
const firstString = (...values: unknown[]) => values.find(value => typeof value === 'string' && value.trim()) as string | undefined;
const nested = (data: Data, key: string) => data[key] && typeof data[key] === 'object' ? data[key] as Data : data;
const idOf = (item: Data) => String(item._id || item.id || '');
const locOf = (item: Data) => {
  const loc = item.location && typeof item.location === 'object' ? item.location as Data : {};
  return [firstString(loc.locality, item.locality), firstString(loc.city, item.city)].filter(Boolean).join(', ');
};

export default function RealtorDashboardScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(['overview', 'properties', 'listings', 'leads', 'more'].includes(String(tabParam)) ? tabParam as Tab : 'overview');
  const [profile, setProfile] = useState<Data | null>(null);
  const [rows, setRows] = useState<Data[]>([]);
  const [selected, setSelected] = useState<Data | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'signedOut' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const response = await realtorApi.profile();
      const realtor = nested(response, 'realtor');
      setProfile(realtor);
      setPhase('ready');
      return realtor;
    } catch (cause) {
      if (cause instanceof PartnerApiError && (cause.status === 401 || cause.status === 403)) { setPhase('signedOut'); setError('Sign in to your realtor account to continue.'); }
      else { setPhase('error'); setError(cause instanceof Error ? cause.message : 'Could not load realtor profile.'); }
      return null;
    }
  }, []);

  const loadTab = useCallback(async (currentTab: Tab, statusFilter = '') => {
    if (currentTab === 'overview') return;
    try {
      const response = currentTab === 'properties' ? await realtorApi.properties()
        : currentTab === 'listings' ? await realtorApi.listings()
          : currentTab === 'leads' ? await realtorApi.leads(statusFilter || undefined)
            : currentTab === 'more' ? await realtorApi.notifications() : {};
      const key = currentTab === 'properties' ? 'properties' : currentTab === 'listings' ? 'listings' : currentTab === 'leads' ? 'leads' : 'notifications';
      setRows(asRows(response[key]));
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not load ${currentTab}.`); }
  }, []);

  // Server data is loaded on mount and when the selected workspace tab changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadProfile(); }, [loadProfile]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (phase === 'ready') void loadTab(tab, filter); }, [tab, filter, phase, loadTab]);

  const refresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await loadTab(tab, filter);
    setRefreshing(false);
  };


  const company = firstString(profile?.companyName, profile?.fullName, 'Realty workspace')!;
  const chooseTab = (key: string) => { setError(''); setTab(key as Tab); };
  const status = String(profile?.approvalStatus || profile?.onboardingStatus || 'pending');
  const unread = useMemo(() => tab === 'more' ? rows.filter(item => !item.read && !item.readAt).length : 0, [rows, tab]);
  async function markAllRead() {
    setMarkingAll(true); setError('');
    try { await realtorApi.markAllNotificationsRead(); await loadTab('more'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read.'); }
    finally { setMarkingAll(false); }
  }
  const filteredRows = useMemo(() => rows.filter(item => !filter || tab !== 'leads' || String(item.status || '').toLowerCase() === filter.toLowerCase()), [rows, filter, tab]);

  return <VerticalFrame title={company} subtitle="KRAFTNEX REALTY" tabs={TABS} activeTab={tab} onTab={chooseTab} onBack={() => router.replace('/')}>
    {phase === 'loading' ? <StatePanel title="Loading Realty" message="Connecting to the realtor workspace…" /> : null}
    {phase === 'error' ? <StatePanel title="Couldn’t load realtor workspace" message={error} retry={() => void loadProfile()} /> : null}
    {phase === 'signedOut' ? <Panel>
      <PageHeading title="Open your Realty workspace" subtitle="Realty uses the same Kraftnex partner sign-in as your other workspaces. Sign in once, then pick Realtor from the home screen." />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <PrimaryButton title="Go to partner home" onPress={() => router.replace('/')} />
      <SecondaryButton title="Set up realtor workspace" onPress={() => router.push('/realtor/register')} />
    </Panel> : null}
    {phase === 'ready' ? <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />} contentContainerStyle={s.content}>
      {tab === 'overview' ? <>
        <PageHeading eyebrow="REAL ESTATE PARTNER" title={`Welcome${firstString(profile?.fullName) ? `, ${firstString(profile?.fullName)}` : ''}`} subtitle="Manage your properties, projects and buyer enquiries." />
        <Panel tint><View style={s.statusRow}><View style={{ flex: 1 }}><Text style={s.statusLabel}>ACCOUNT STATUS</Text><Text style={s.statusValue}>{status.replaceAll('_', ' ')}</Text></View><StatusPill label={status} tone={status === 'approved' ? 'green' : 'amber'} /></View>
          {profile?.approvalNote ? <Text style={s.note}>{String(profile.approvalNote)}</Text> : null}
          {profile?.approvalStatus !== 'approved' ? <SecondaryButton title="Review verification & profile" onPress={() => router.push('/realtor/onboarding')} /> : null}</Panel>
        <View style={s.kpis}>
          <Kpi label="Active listings" value={profile?.activeListingsCount} />
          <Kpi label="Available credits" value={profile?.listingQuota} />
          <Kpi label="Profile completion" value={profile?.profileCompleteness} suffix={profile?.profileCompleteness != null ? '%' : ''} />
          <Kpi label="Buyer leads" value={(profile?.stats as Data | undefined)?.leadsReceived} />
        </View>
        <Pressable onPress={() => setCreditsOpen(true)}><Panel style={s.creditCard}>
          <View style={{ flex: 1 }}><Text style={s.statusLabel}>LISTING CREDITS</Text><Text style={s.creditValue}>{profile?.listingQuota == null ? '—' : String(profile.listingQuota)} available</Text><Text style={s.creditHint}>Each property or project post uses one credit.</Text></View>
          <Text style={s.creditBuy}>Buy credits ›</Text>
        </Panel></Pressable>
        <SectionTitle title="Quick actions" />
        <Panel>
          <ActionRow title="Add a property" detail="Create a property draft with details and photos" onPress={() => router.push('/realtor/property/new')} />
          {['builder', 'developer'].includes(String(profile?.accountType)) ? <ActionRow title="Create a project" detail="Publish a development and its configurations" onPress={() => router.push('/realtor/project/new')} /> : null}
          <ActionRow title="Review buyer leads" detail="Follow up with interested buyers" onPress={() => setTab('leads')} />
        </Panel>
        {error ? <StatePanel title="Some workspace data is unavailable" message={error} retry={() => void loadTab(tab, filter)} /> : null}
      </> : null}
      {tab === 'properties' ? <>
        <PageHeading eyebrow="YOUR INVENTORY" title="My properties" subtitle="Owner and agent properties saved to your realty profile." action={<Text style={s.count}>{rows.length}</Text>} />
        <PrimaryButton title="＋  Add property" onPress={() => router.push('/realtor/property/new')} />
        {error ? <StatePanel title="Couldn’t load properties" message={error} retry={() => void loadTab(tab)} /> : null}
        {!error && filteredRows.length === 0 ? <StatePanel title="No properties yet" message="Add a property to start creating a marketplace listing." /> : filteredRows.map(item => <Pressable key={idOf(item)} onPress={() => setSelected(item)}><Panel><DataRow title={firstString(item.title, item.name, item.propertyType, 'Property')!} detail={[locOf(item), item.listingPurpose, item.price ? `₹${String(item.price)}` : null].filter(Boolean).join(' · ')} status={String(item.status || 'draft')} /></Panel></Pressable>)}
      </> : null}
      {tab === 'listings' ? <>
        <PageHeading eyebrow="MARKETPLACE" title="Published listings" subtitle="Listings buyers can discover on Kraftnex." action={<Text style={s.count}>{rows.length}</Text>} />
        <PrimaryButton title="＋  New listing" onPress={() => router.push('/realtor/listing/new')} />
        {error ? <StatePanel title="Couldn’t load listings" message={error} retry={() => void loadTab(tab)} /> : null}
        {!error && filteredRows.length === 0 ? <StatePanel title="No published listings" message="Choose a saved property or project to create a listing." /> : filteredRows.map(item => <Pressable key={idOf(item)} onPress={() => setSelected(item)}><Panel><DataRow title={firstString(item.title, item.propertyTitle, item.projectName, 'Listing')!} detail={[locOf(item), item.listingPurpose, item.price ? `₹${String(item.price)}` : null].filter(Boolean).join(' · ')} status={String(item.status || 'draft')} /></Panel></Pressable>)}
      </> : null}
      {tab === 'leads' ? <>
        <PageHeading eyebrow="BUYER INTEREST" title="Buyer leads" subtitle="Manage enquiries from interested property buyers." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{['', 'new', 'contacted', 'qualified', 'closed'].map(value => <Pressable key={value || 'all'} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterOn]}><Text style={[s.filterText, filter === value && s.filterTextOn]}>{value || 'All leads'}</Text></Pressable>)}</ScrollView>
        {error ? <StatePanel title="Couldn’t load leads" message={error} retry={() => void loadTab(tab, filter)} /> : null}
        {!error && filteredRows.length === 0 ? <StatePanel title="No leads yet" message="Buyer enquiries will appear here when a customer contacts you about a listing." /> : filteredRows.map(item => <Pressable key={idOf(item)} onPress={() => setSelected(item)}><Panel><DataRow title={firstString(item.buyerName, item.name, 'Buyer enquiry')!} detail={[firstString(item.propertyTitle, item.projectName), item.phone, item.createdAt ? new Date(String(item.createdAt)).toLocaleDateString() : ''].filter(Boolean).join(' · ')} status={String(item.status || 'new')} /></Panel></Pressable>)}
      </> : null}
      {tab === 'more' ? <>
        <PageHeading eyebrow="REALTY" title="Workspace hub" subtitle="Everything you need to manage your real estate business." />
        <Panel>
          <ActionRow title="Projects" detail="Developments and residential projects" onPress={() => router.push('/realtor/project/new')} />
          <ActionRow title="Developer profile" detail="Public company profile and authorized agents" onPress={() => router.push('/realtor/developer')} />
          <ActionRow title="Notifications" detail="Approvals, leads and listing updates" onPress={() => void loadTab('more')} />
          <ActionRow title="Verification & profile" detail="Credentials and service areas" onPress={() => router.push('/realtor/onboarding')} />
          <ActionRow title="Switch workspace" detail="Back to partner home — you stay signed in" onPress={() => router.replace('/')} />
        </Panel>
        <Panel><View style={s.notifHeader}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={s.notifTitle}>Notifications</Text>{unread > 0 ? <View style={s.badge}><Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}</View>
          {unread > 0 ? <View style={{ width: 130 }}><SecondaryButton title={markingAll ? 'Marking…' : 'Mark all read'} onPress={() => void markAllRead()} /></View> : <Text style={s.notifHint}>All caught up</Text>}
        </View></Panel>
        {rows.map(item => <Pressable key={idOf(item)} onPress={async () => { const id = idOf(item); if (id) await realtorApi.markNotificationRead(id); await loadTab('more'); }}><Panel><DataRow title={firstString(item.title, item.message, item.type, 'Kraftnex update')!} detail={firstString(item.body, item.createdAt)} status={item.readAt || item.read ? 'read' : 'new'} /></Panel></Pressable>)}
      </> : null}
      {error && tab !== 'overview' ? <StatePanel title="Couldn’t load this section" message={error} retry={() => void loadTab(tab, filter)} /> : null}
    </ScrollView> : null}
    <ListingCreditsSheet visible={creditsOpen} title="Buy listing credits" onClose={() => setCreditsOpen(false)} onPurchased={() => void loadProfile()} />
    <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
      <View style={s.modalBackdrop}><ScrollView style={s.modalCard} contentContainerStyle={s.modalContent}>
        <View style={s.modalHeader}><Text style={s.modalTitle}>{firstString(selected?.title, selected?.buyerName, selected?.projectName, 'Details')!}</Text><Pressable onPress={() => setSelected(null)}><Text style={s.close}>×</Text></Pressable></View>
        {selected ? <DetailContent item={selected} tab={tab} onRefresh={() => void loadTab(tab, filter)} onClose={() => setSelected(null)} /> : null}
      </ScrollView></View>
    </Modal>
  </VerticalFrame>;
}

function Kpi({ label, value, suffix = '' }: { label: string; value: unknown; suffix?: string }) {
  return <Panel style={s.kpi}><Text style={s.kpiValue}>{value == null ? '—' : `${String(value)}${suffix}`}</Text><Text style={s.kpiLabel}>{label}</Text></Panel>;
}
function ActionRow({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={s.actionRow}><View style={{ flex: 1 }}><Text style={s.actionTitle}>{title}</Text><Text style={s.actionDetail}>{detail}</Text></View><Text style={s.chevron}>›</Text></Pressable>;
}
const leadPhone = (item: Data) => firstString(item.customerPhone, item.phone, (item.customerId as Data | undefined)?.phone) || '';
const whatsappNumber = (phone: string) => { const digits = phone.replace(/\D/g, ''); return digits.length === 10 ? `91${digits}` : digits; };
function DetailSummary({ item, tab }: { item: Data; tab: Tab }) {
  if (tab === 'properties') return <SummaryHeader title={firstString(item.title, item.propertyType, 'Property')!} location={locOf(item)} price={formatPrice(item.price ?? item.monthlyRent)} status={String(item.status || 'draft')} extra={[item.propertyType, item.listingPurpose, item.bhk ? `${String(item.bhk)} BHK` : ''].filter(Boolean).map(value => String(value).replaceAll('_', ' ')).join(' · ')} />;
  if (tab === 'listings') return <SummaryHeader title={firstString(item.title, item.propertyTitle, item.projectName, 'Listing')!} location={locOf(item)} price={formatPrice(item.price)} status={String(item.status || 'draft')} extra={[item.listingPurpose, item.transactionType].filter(Boolean).map(value => String(value).replaceAll('_', ' ')).join(' · ')} />;
  if (tab === 'leads') {
    const customer = (item.customerId && typeof item.customerId === 'object' ? item.customerId : {}) as Data;
    return <SummaryHeader title={firstString(item.customerName, item.buyerName, customer.name, item.name, 'Buyer enquiry')!} location={firstString(item.propertyTitle, item.projectName, item.developerName)} status={String(item.status || 'new')} extra={[leadPhone(item), firstString(item.customerEmail, customer.email)].filter(Boolean).join(' · ')} />;
  }
  return null;
}
function DetailContent({ item, tab, onRefresh, onClose }: { item: Data; tab: Tab; onRefresh: () => void; onClose: () => void }) {
  const [status, setStatus] = useState(String(item.status || ''));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = idOf(item);
  async function act(action: string) {
    if (!id) return;
    setBusy(true); setError('');
    try {
      if (tab === 'leads') await realtorApi.updateLead(id, { status: action, note });
      else if (tab === 'listings' && action === 'submit') await realtorApi.submitListing(id);
      else if (tab === 'properties' && action === 'delete') await realtorApi.properties('DELETE', undefined, id);
      else if (tab === 'listings' && action === 'delete') await realtorApi.listings('DELETE', undefined, id);
      else if (tab === 'more' && action === 'read') await realtorApi.markNotificationRead(id);
      onClose(); onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The update could not be saved.'); }
    finally { setBusy(false); }
  }
  return <>
    {error ? <Text style={s.error}>{error}</Text> : null}
    <DetailSummary item={item} tab={tab} />
    {tab === 'leads' && leadPhone(item) ? <View style={s.contactRow}>
      <View style={{ flex: 1 }}><PrimaryButton title="Call" onPress={() => void Linking.openURL(`tel:${leadPhone(item)}`).catch(() => setError('Could not open the phone dialer.'))} /></View>
      <View style={{ flex: 1 }}><SecondaryButton title="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${whatsappNumber(leadPhone(item))}`).catch(() => setError('Could not open WhatsApp.'))} /></View>
    </View> : null}
    {Object.entries(item).filter(([key, value]) => !['_id', 'id', '__v'].includes(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')).slice(0, 16).map(([key, value]) => <DataRow key={key} title={key.replaceAll(/([A-Z])/g, ' $1').replaceAll('_', ' ')} detail={String(value)} />)}
    {tab === 'leads' ? <>
      <Field label="Follow-up note" value={note} onChangeText={setNote} multiline />
      <Text style={s.smallLabel}>Update enquiry status</Text>
      <ScrollView horizontal contentContainerStyle={s.filters}>{['contacted', 'qualified', 'closed'].map(value => <Pressable key={value} onPress={() => setStatus(value)} style={[s.filter, status === value && s.filterOn]}><Text style={[s.filterText, status === value && s.filterTextOn]}>{value}</Text></Pressable>)}</ScrollView>
      <PrimaryButton title="Save lead update" onPress={() => void act(status)} loading={busy} />
    </> : null}
    {tab === 'listings' && ['draft', 'changes_requested'].includes(String(item.status)) ? <PrimaryButton title="Submit for review" onPress={() => void act('submit')} loading={busy} /> : null}
    {(tab === 'properties' || tab === 'listings') ? <SecondaryButton title="Edit" onPress={() => { onClose(); router.push((tab === 'properties' ? `/realtor/property/${id}` : `/realtor/listing/${id}`) as never); }} /> : null}
    {(tab === 'properties' || tab === 'listings') ? <SecondaryButton title="Delete" onPress={() => void act('delete')} /> : null}
    {tab === 'more' && !item.readAt ? <PrimaryButton title="Mark as read" onPress={() => void act('read')} loading={busy} /> : null}
  </>;
}

const s = StyleSheet.create({
  content: { padding: 0, gap: 12 }, error: { color: palette.red, fontSize: 12, lineHeight: 18 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, statusLabel: { color: palette.greenText, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, statusValue: { color: palette.green, fontSize: 17, fontWeight: '800', marginTop: 3 }, note: { color: palette.body, fontSize: 12 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, kpi: { width: '48%', minHeight: 86, justifyContent: 'center' }, kpiValue: { color: palette.ink, fontSize: 22, fontWeight: '800' }, kpiLabel: { color: palette.muted, fontSize: 11, marginTop: 3 },
  count: { color: palette.greenText, backgroundColor: palette.greenSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 11, fontWeight: '800' }, actionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, actionTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' }, actionDetail: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }, chevron: { color: palette.greenText, fontSize: 26 },
  creditCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.amberSoft, borderColor: '#f0dcae' }, creditValue: { color: palette.ink, fontSize: 18, fontWeight: '800', marginTop: 3 }, creditHint: { color: palette.body, fontSize: 11, marginTop: 2 }, creditBuy: { color: palette.green, fontSize: 12, fontWeight: '800' },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, notifTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' }, notifHint: { color: palette.muted, fontSize: 11 }, badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' }, contactRow: { flexDirection: 'row', gap: 9 },
  filters: { gap: 8, paddingVertical: 4 }, filter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line }, filterOn: { backgroundColor: palette.green, borderColor: palette.green }, filterText: { color: palette.body, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }, filterTextOn: { color: '#fff' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,35,28,0.45)' }, modalCard: { maxHeight: '90%', borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: palette.bg }, modalContent: { padding: 18, paddingBottom: 30, gap: 8 }, modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }, modalTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', flex: 1 }, close: { color: palette.muted, fontSize: 28 }, smallLabel: { color: palette.ink, fontWeight: '800', fontSize: 12 },
});
