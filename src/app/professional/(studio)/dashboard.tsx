import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { router } from 'expo-router';
import { partnerApi, StudioDashboardResponse, StudioProposalRecord } from '../../../lib/partnerApi';
import { c, Card, ErrorText } from '../../../components/professional/onboardingUi';
import { RecommendedProjects } from '../../../components/studio/RecommendedProjects';
import { useStudio } from '../../../components/studio/StudioContext';

type ProposalFilter = 'all' | 'awarded' | 'shortlisted' | 'pending';

const formatRevenue = (lakhs: number) => (lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : lakhs > 0 ? `₹${lakhs.toFixed(2).replace(/\.00$/, '')}L` : '₹0');
const go = (path: string) => router.navigate(path as never);

function nameOf(item: StudioProposalRecord) {
  const project = typeof item.projectId === 'object' ? item.projectId : undefined;
  return {
    client: item.customerId?.name || item.customer?.name || project?.clientName || item.clientName || 'Client',
    title: project?.title || item.projectTitle || item.project?.title || item.title || 'Client Project Brief',
    location: project?.location || project?.city || item.project?.location || item.project?.city || item.location || item.city || '',
    quote: String(item.priceEst || item.amount || item.proposedPrice || item.budget || item.project?.budgetRange || 'Quote on scope'),
    timeline: item.timeline || item.project?.timeline || 'As per schedule',
  };
}

const STATUS = (status?: string) => {
  if (status === 'Completed') return { label: 'Completed & Delivered', bg: c.mint, fg: c.greenText };
  if (status === 'Won' || status === 'Awarded') return { label: 'Awarded Contract', bg: '#d6f0ec', fg: '#0f6b61' };
  if (status === 'Shortlisted') return { label: 'Shortlisted', bg: c.amberSoft, fg: c.amber };
  if (status === 'Not Selected') return { label: 'Not Selected', bg: c.redSoft, fg: c.red };
  return { label: 'Under Review', bg: '#e6eefc', fg: '#2c5fb3' };
};

export default function DashboardScreen() {
  const { profile, studioName, ownerName, patchProfile } = useStudio();
  const [data, setData] = useState<StudioDashboardResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [availability, setAvailability] = useState(profile.availability || 'Available');
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setData(await partnerApi.studioDashboard());
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your dashboard.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => { void load(); }, 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  async function toggleAvailability() {
    if (savingAvailability) return;
    const next = availability === 'Busy' ? 'Available' : 'Busy';
    const previous = availability;
    setAvailability(next);
    setSavingAvailability(true);
    setAvailabilityError('');
    try {
      await partnerApi.updateStudioProfile({ availability: next });
      patchProfile({ availability: next });
    } catch (error) {
      setAvailability(previous);
      setAvailabilityError(error instanceof Error ? error.message : 'Could not update your availability.');
    } finally {
      setSavingAvailability(false);
    }
  }

  const stats = data?.stats || {};
  const proposals = (data?.proposals || []).filter(item => item.status !== 'Completed');
  const won = Number(stats.projectsWon || 0);
  const submitted = Number(stats.proposalsSubmitted || 0);
  const conversion = submitted > 0 ? Math.round((won / submitted) * 100) : 0;
  const revenue = formatRevenue(Number(data?.revenueEarned || 0));
  const count = (statuses: string[]) => proposals.filter(item => statuses.includes(item.status || '')).length;
  const shown = proposals.filter(item => {
    if (filter === 'awarded') return ['Won', 'Awarded', 'Completed'].includes(item.status || '');
    if (filter === 'shortlisted') return item.status === 'Shortlisted';
    if (filter === 'pending') return ['Submitted', 'Under Review'].includes(item.status || '');
    return true;
  });
  const deadlines = proposals.filter(item => ['Submitted', 'Under Review', 'Shortlisted'].includes(item.status || '')).slice(0, 2);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const kpis = [
    { label: 'Profile views', value: Number(data?.professional?.profileViews || 0).toLocaleString('en-IN'), foot: 'Times recommended to clients', glyph: '◉' },
    { label: 'Project invitations', value: String(Number(stats.leads || 0)), foot: 'Clients unlocked you', glyph: '➤' },
    { label: 'Proposals submitted', value: String(submitted), foot: 'Total sent', glyph: '▤' },
    { label: 'Shortlisted', value: String(Number(stats.shortlisted || 0)), foot: 'From client shortlists', glyph: '★' },
    { label: 'Projects won', value: String(won), foot: 'Awarded to you', glyph: '✦' },
    { label: 'Revenue earned', value: revenue, foot: 'From won projects', glyph: '₹' },
  ];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.eyebrow}>DASHBOARD</Text>
      <Text style={s.greeting}>{greeting}, {ownerName.split(' ')[0] || 'there'}!</Text>
      {!!studioName && <View style={s.studioChip}><Text style={s.studioChipText}>Studio: {studioName}</Text></View>}
      <Text style={s.lead}>Here&apos;s what&apos;s happening with your business today.</Text>

      <View style={s.toolRow}>
        <Pressable style={[s.availability, availability === 'Busy' && s.availabilityBusy]} onPress={() => void toggleAvailability()} disabled={savingAvailability}>
          <View style={[s.dot, availability === 'Busy' && { backgroundColor: c.amber }]} />
          <View>
            <Text style={s.availLabel}>STUDIO STATUS</Text>
            <Text style={s.availValue}>{savingAvailability ? 'Updating…' : availability === 'Busy' ? 'Busy' : 'Available'}</Text>
          </View>
          <Text style={s.availSwitch}>Switch</Text>
        </Pressable>
        <View style={s.date}><Text style={s.dateText}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text></View>
      </View>
      {!!availabilityError && <ErrorText>{availabilityError}</ErrorText>}

      {profile.isApproved === false && (
        <View style={s.banner}>
          <Text style={s.bannerTitle}>APPLICATION UNDER ADMIN REVIEW</Text>
          <Text style={s.bannerCopy}>Your studio application is currently under review by KraftNex Admin. Once approved in the Admin Panel, your studio will be published on the public directory.</Text>
        </View>
      )}

      {!!loadError && <ErrorText>{loadError}</ErrorText>}
      {!data && !loadError && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}

      <Text style={s.section}>Studio Performance</Text>
      <View style={s.kpiGrid}>
        {kpis.map(kpi => (
          <View key={kpi.label} style={s.kpi}>
            <View style={s.kpiIcon}><Text style={s.kpiGlyph}>{kpi.glyph}</Text></View>
            <Text style={s.kpiValue}>{kpi.value}</Text>
            <Text style={s.kpiLabel}>{kpi.label}</Text>
            <Text style={s.kpiFoot}>{kpi.foot}</Text>
          </View>
        ))}
      </View>

      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.section}>Proposals & Projects</Text>
          <Text style={s.sub}>Executive summary of your active proposals, client shortlists, and won contracts</Text>
        </View>
        <View style={s.total}><Text style={s.totalText}>{proposals.length} Total</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {([
          ['all', `All Proposals (${proposals.length})`],
          ['awarded', `Won (${count(['Won', 'Awarded'])})`],
          ['shortlisted', `Shortlisted (${count(['Shortlisted'])})`],
          ['pending', `In Review (${count(['Submitted', 'Under Review'])})`],
        ] as [ProposalFilter, string][]).map(([id, label]) => (
          <Pressable key={id} style={[s.filter, filter === id && s.filterOn]} onPress={() => setFilter(id)}>
            <Text style={[s.filterText, filter === id && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {proposals.length === 0 ? (
        <Card style={s.empty}>
          <Text style={s.emptyTitle}>No Proposals Submitted Yet</Text>
          <Text style={s.emptyCopy}>Explore recommended client projects and submit your first quote to kickstart your contract pipeline.</Text>
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
          {shown.map((item, index) => {
            const info = nameOf(item);
            const tone = STATUS(item.status);
            return (
              <View key={item._id || item.id || index} style={s.proposal}>
                <View style={s.proposalTop}>
                  <View style={[s.status, { backgroundColor: tone.bg }]}><Text style={[s.statusText, { color: tone.fg }]}>{tone.label}</Text></View>
                  <Text style={s.proposalDate}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recent'}</Text>
                </View>
                <Text style={s.proposalTitle} numberOfLines={2}>{info.title}</Text>
                <Text style={s.proposalMeta} numberOfLines={1}>Client: <Text style={{ fontWeight: '800' }}>{info.client}</Text>{info.location ? `  •  ${info.location}` : ''}</Text>
                <View style={s.money}>
                  <View style={{ flex: 1 }}><Text style={s.moneyLabel}>YOUR QUOTE</Text><Text style={s.moneyValue} numberOfLines={1}>₹ {info.quote}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.moneyLabel}>TIMELINE</Text><Text style={s.moneyValue} numberOfLines={1}>{info.timeline}</Text></View>
                </View>
                {!!item.scopeText && item.scopeText.length > 5 && <Text style={s.scope} numberOfLines={2}>&ldquo;{item.scopeText}&rdquo;</Text>}
                <View style={s.proposalActions}>
                  <Pressable style={s.actionGhost} onPress={() => go('/professional/messages')}><Text style={s.actionGhostText}>Chat</Text></Pressable>
                  <Pressable style={s.actionSolid} onPress={() => go('/professional/proposals')}><Text style={s.actionSolidText}>View Details →</Text></Pressable>
                </View>
              </View>
            );
          })}
          {shown.length === 0 && <Text style={s.sub}>No proposals in this filter.</Text>}
        </ScrollView>
      )}

      <RecommendedProjects />

      <Text style={s.section}>Activity</Text>
      <Card>
        <View style={s.activityRow}><Text style={s.activityLabel}>Discussions</Text><Text style={s.activityValue}>{Number(stats.conversations || 0)}</Text></View>
        <View style={s.activityRow}><Text style={s.activityLabel}>Conversion rate</Text><Text style={s.activityValue}>{conversion}%</Text></View>
      </Card>

      <Text style={s.section}>Revenue Overview</Text>
      <Card>
        <Text style={s.revenue}>{revenue}</Text>
        <Text style={s.sub}>Total earned from won projects</Text>
        <View style={s.activityRow}><Text style={s.activityLabel}>Paid invoices</Text><Text style={s.activityValue}>{revenue}</Text></View>
        <View style={s.activityRow}><Text style={s.activityLabel}>Pending</Text><Text style={s.activityValue}>₹0</Text></View>
      </Card>

      <Text style={s.section}>Upcoming Deadlines</Text>
      <Card>
        {deadlines.length === 0 ? <Text style={s.sub}>No upcoming deadlines.</Text> : deadlines.map((item, index) => {
          const info = nameOf(item);
          return (
            <View key={item._id || item.id || index} style={s.deadline}>
              <Text style={s.deadlineTitle} numberOfLines={1}>{info.title}</Text>
              <Text style={s.sub}>{info.quote} · {item.createdAt ? `Awaiting response · sent ${new Date(item.createdAt).toLocaleDateString()}` : 'Awaiting client response'}</Text>
            </View>
          );
        })}
      </Card>

      <View style={s.headRow}>
        <Text style={[s.section, { flex: 1 }]}>Recent Messages</Text>
        <Pressable onPress={() => go('/professional/messages')}><Text style={s.link}>View all</Text></Pressable>
      </View>
      <Card>
        {(data?.recentMessages || []).length === 0 ? <Text style={s.sub}>No recent messages.</Text> : (data?.recentMessages || []).map((message, index) => (
          <Pressable key={String(message.id ?? index)} style={s.deadline} onPress={() => go('/professional/messages')}>
            <Text style={s.deadlineTitle} numberOfLines={1}>{message.clientName || 'Client'}</Text>
            <Text style={s.sub} numberOfLines={2}>{message.text}</Text>
            {!!message.time && <Text style={s.time}>{new Date(message.time).toLocaleString()}</Text>}
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  eyebrow: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  greeting: { color: c.ink, fontSize: 26, fontWeight: '800', marginTop: 4 },
  studioChip: { alignSelf: 'flex-start', backgroundColor: c.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 },
  studioChipText: { color: c.green, fontSize: 12, fontWeight: '800' },
  lead: { color: c.body, fontSize: 13.5, marginTop: 8 },
  toolRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'stretch' },
  availability: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.greenSoft, borderRadius: 16, borderWidth: 1, borderColor: '#bfe0cf', padding: 12 },
  availabilityBusy: { backgroundColor: c.amberSoft, borderColor: '#efd9a3' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22a06b' },
  availLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  availValue: { color: c.ink, fontSize: 17, fontWeight: '800' },
  availSwitch: { marginLeft: 'auto', color: '#fff', backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  date: { justifyContent: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12 },
  dateText: { color: c.ink, fontSize: 12, fontWeight: '700' },
  banner: { backgroundColor: c.amberSoft, borderRadius: 16, borderWidth: 1, borderColor: '#efd9a3', padding: 14, marginTop: 14 },
  bannerTitle: { color: '#5b4a16', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  bannerCopy: { color: '#7a652a', fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  section: { color: c.ink, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  sub: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  kpi: { width: '48.5%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  kpiIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  kpiGlyph: { color: c.green, fontSize: 14, fontWeight: '800' },
  kpiValue: { color: c.ink, fontSize: 26, fontWeight: '800', marginTop: 10 },
  kpiLabel: { color: c.ink, fontSize: 13, fontWeight: '700', marginTop: 2 },
  kpiFoot: { color: c.muted, fontSize: 11.5, marginTop: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  total: { backgroundColor: c.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  totalText: { color: c.green, fontSize: 11, fontWeight: '800' },
  filters: { gap: 8, paddingVertical: 10 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  filterOn: { backgroundColor: c.green, borderColor: c.green },
  filterText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  proposal: { width: 300, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 },
  proposalTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  proposalDate: { color: c.muted, fontSize: 11, fontWeight: '700' },
  proposalTitle: { color: c.ink, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  proposalMeta: { color: c.body, fontSize: 12 },
  money: { flexDirection: 'row', gap: 10, backgroundColor: '#f1f5f3', borderRadius: 12, padding: 10 },
  moneyLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  moneyValue: { color: c.ink, fontSize: 13.5, fontWeight: '800', marginTop: 2 },
  scope: { color: c.body, fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
  proposalActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionGhost: { flex: 1, height: 42, borderRadius: 12, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  actionGhostText: { color: c.ink, fontSize: 13, fontWeight: '800' },
  actionSolid: { flex: 1.4, height: 42, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  actionSolidText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  activityLabel: { color: c.body, fontSize: 13.5 },
  activityValue: { color: c.ink, fontSize: 14, fontWeight: '800' },
  revenue: { color: c.ink, fontSize: 28, fontWeight: '800' },
  deadline: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, gap: 2 },
  deadlineTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  time: { color: c.muted, fontSize: 11, marginTop: 2 },
  link: { color: c.green, fontSize: 13, fontWeight: '800', marginTop: 14 },
});
