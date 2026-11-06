import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { partnerApi, StudioDashboardResponse, StudioProposalRecord } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';

type Range = '7d' | '30d' | '90d' | '1y';
const RANGES: [Range, string, number][] = [['7d', '7 Days', 7], ['30d', '30 Days', 30], ['90d', '3 Months', 90], ['1y', '1 Year', 365]];

type Proposal = StudioProposalRecord & { matchScore?: number | null; updatedAt?: string; project?: { title?: string } };

// Same parsing as the desktop analytics: "₹45 L", "1.2 Cr" or a plain rupee number -> lakhs.
const lakhsOf = (priceEst?: string) => {
  const raw = String(priceEst || '').replace(/[₹,\s]/g, '');
  const cr = raw.match(/([\d.]+)\s*[Cc][Rr]/);
  const l = raw.match(/([\d.]+)\s*[Ll]/);
  if (cr) return parseFloat(cr[1]) * 100;
  if (l) return parseFloat(l[1]);
  const n = parseFloat(raw);
  return Number.isNaN(n) ? 0 : n / 100000;
};
const isWonStatus = (status?: string) => ['Won', 'Awarded', 'Accepted', 'Completed', 'In Progress', 'Work in Progress'].includes(status || '');
const formatRevenue = (lakhs: number) => (lakhs >= 100 ? `₹${(lakhs / 100).toFixed(2)} Cr` : lakhs > 0 ? `₹${lakhs.toFixed(2).replace(/\.00$/, '')}L` : '₹0');

function Bar({ pct, color }: { pct: number; color: string }) {
  return <View style={s.track}><View style={[s.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} /></View>;
}

export default function AnalyticsScreen() {
  const { profile } = useStudio();
  const [dash, setDash] = useState<StudioDashboardResponse | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>('30d');
  const [nowMs] = useState(() => Date.now());

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const [dashResult, proposalResult] = await Promise.allSettled([partnerApi.studioDashboard(), partnerApi.myProposals()]);
    if (dashResult.status === 'fulfilled') setDash(dashResult.value);
    else setError(dashResult.reason instanceof Error ? dashResult.reason.message : 'Could not load your analytics.');
    setProposals(proposalResult.status === 'fulfilled' && Array.isArray(proposalResult.value) ? (proposalResult.value as Proposal[]) : []);
    setLoaded(true);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const stats = dash?.stats || {};
  const metrics = {
    profileViews: Number(dash?.professional?.profileViews || 0),
    invitations: Number(stats.leads || 0),
    proposalsSubmitted: Number(stats.proposalsSubmitted || 0),
    shortlisted: Number(stats.shortlisted || 0),
    revenueEarned: Number(dash?.revenueEarned || 0),
  };
  const conversionRate = metrics.proposalsSubmitted > 0 ? Math.round((Number(stats.projectsWon || 0) / metrics.proposalsSubmitted) * 100) : 0;
  const won = proposals.filter(p => p.status === 'Won' || p.status === 'Awarded');

  let revenueLakhs = metrics.revenueEarned;
  let avgDeal = '0.00';
  if (loaded) {
    if (won.length > 0) {
      const parsed = won.reduce((sum, p) => sum + lakhsOf(p.priceEst), 0);
      if (parsed > 0) revenueLakhs = parsed;
      avgDeal = (revenueLakhs / won.length).toFixed(2);
    } else if (metrics.revenueEarned > 0) avgDeal = metrics.revenueEarned.toFixed(2);
  }

  const days = RANGES.find(item => item[0] === range)![2];
  const start = nowMs - days * 86400000;
  const prevStart = nowMs - 2 * days * 86400000;
  const timeOf = (p: Proposal) => new Date(p.createdAt || p.updatedAt || 0).getTime();
  const current = proposals.filter(p => { const t = timeOf(p); return t >= start && t <= nowMs; });
  const previous = proposals.filter(p => { const t = timeOf(p); return t >= prevStart && t < start; });
  const curWon = current.filter(p => isWonStatus(p.status)).length;
  const prevWon = previous.filter(p => isWonStatus(p.status)).length;
  const curRate = current.length > 0 ? Math.round((curWon / current.length) * 100) : 0;
  const prevRate = previous.length > 0 ? Math.round((prevWon / previous.length) * 100) : 0;
  const wonDelta = curWon - prevWon;
  const rateDelta = curRate - prevRate;

  const buckets = [
    { label: 'Won', color: c.green, match: (st: string) => isWonStatus(st) },
    { label: 'Shortlisted', color: '#c0562c', match: (st: string) => st === 'Shortlisted' },
    { label: 'Under Review', color: c.amber, match: (st: string) => st === 'Under Review' || st === 'Pending' },
    { label: 'Submitted', color: '#8a9189', match: (st: string) => st === 'Submitted' },
    { label: 'Not Selected', color: '#c79a9a', match: (st: string) => st === 'Not Selected' || st === 'Rejected' },
  ].map(bucket => ({ ...bucket, count: current.filter(p => bucket.match(p.status || '')).length }));
  const maxBucket = Math.max(...buckets.map(b => b.count), 1);

  const kaiMatched = current.filter(p => p.matchScore != null).length;
  const direct = current.length - kaiMatched;
  const sourceTotal = current.length || 1;

  // Category mix from proposal titles and the studio's own onboarding expertise, same rule as desktop.
  const catCounts: Record<string, number> = {};
  proposals.forEach(p => {
    const title = p.project?.title || p.projectTitle || '';
    const cat = title.includes('Villa') ? 'Villas & Luxury Homes' : title.includes('Clinic') || title.includes('Commercial') ? 'Commercial & Retail' : 'Residential Apartments';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const onboarding = (profile.onboardingData || {}) as { primaryExpertise?: string[]; specializations?: string[] };
  (onboarding.primaryExpertise || onboarding.specializations || []).forEach(item => {
    const lower = item.toLowerCase();
    const cat = lower.includes('villa') || lower.includes('luxury') ? 'Villas & Luxury Homes' : lower.includes('commercial') || lower.includes('office') ? 'Commercial & Retail' : 'Residential Apartments';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const catTotal = Object.values(catCounts).reduce((a, b) => a + b, 0);
  const categories = Object.keys(catCounts).length
    ? Object.entries(catCounts).map(([name, count]) => ({ name, count, pct: Math.round((count / Math.max(1, catTotal)) * 100) }))
    : ['Villas & Luxury Homes', 'Residential Apartments', 'Commercial & Retail'].map(name => ({ name, count: 0, pct: 0 }));

  const tiers = [0, 0, 0, 0];
  proposals.forEach(p => {
    const v = lakhsOf(p.priceEst);
    if (v <= 0) return;
    tiers[v < 30 ? 0 : v <= 60 ? 1 : v <= 100 ? 2 : 3] += 1;
  });
  const tierTotal = tiers.reduce((a, b) => a + b, 0);
  const tierRows = [['Under ₹30 Lakhs', tiers[0]], ['₹30L – ₹60 Lakhs', tiers[1]], ['₹60L – ₹1 Crore', tiers[2]], ['₹1 Crore+ Ultra High', tiers[3]]] as [string, number][];

  const funnel = [
    { label: 'Profile Impressions', count: metrics.profileViews, pct: 100 },
    { label: 'Project Invitations', count: metrics.invitations, pct: metrics.profileViews > 0 ? Math.min(100, Math.round((metrics.invitations / metrics.profileViews) * 100)) : 0 },
    { label: 'Proposals Submitted', count: metrics.proposalsSubmitted, pct: metrics.invitations > 0 ? Math.min(100, Math.round((metrics.proposalsSubmitted / metrics.invitations) * 100)) : 0 },
    { label: 'Client Shortlisted', count: metrics.shortlisted, pct: metrics.proposalsSubmitted > 0 ? Math.min(100, Math.round((metrics.shortlisted / metrics.proposalsSubmitted) * 100)) : 0 },
    { label: 'Projects Awarded & Won', count: won.length, pct: conversionRate },
  ];

  // Last six months of won-proposal value, from real timestamps.
  const nowDate = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    const inMonth = won.filter(p => {
      const ts = p.updatedAt || p.createdAt;
      if (!ts) return false;
      const pd = new Date(ts);
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
    });
    return { month: d.toLocaleDateString('en-US', { month: 'short' }), revenue: Math.round(inMonth.reduce((sum, p) => sum + lakhsOf(p.priceEst), 0)), projects: inMonth.length };
  });
  const maxMonth = Math.max(...months.map(m => m.revenue), 10);

  const delta = (value: number, suffix = '') => (value === 0 ? null : <Text style={[s.delta, { color: value > 0 ? '#3f8a5f' : '#8a3f3f' }]}>{value > 0 ? '↑' : '↓'} {Math.abs(value)}{suffix}</Text>);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Analytics</Text>
      <Text style={s.sub}>Performance across your pipeline — calculated from proposals, leads, and client onboarding DNA.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ranges}>
        {RANGES.map(([key, label]) => <Pressable key={key} style={[s.range, range === key && s.rangeOn]} onPress={() => setRange(key)}><Text style={[s.rangeText, range === key && { color: '#fff' }]}>{label}</Text></Pressable>)}
      </ScrollView>
      {!!error && <ErrorText>{error}</ErrorText>}
      {!loaded && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}

      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiLabel}>Proposals Won</Text><Text style={s.kpiValue}>{curWon}</Text>{delta(wonDelta)}</View>
        <View style={s.kpi}><Text style={s.kpiLabel}>Win Rate</Text><Text style={s.kpiValue}>{curRate}%</Text>{delta(rateDelta, '%')}</View>
        <View style={s.kpi}><Text style={s.kpiLabel}>Avg. Deal Value</Text><Text style={s.kpiValue}>₹{avgDeal}L</Text></View>
        <View style={s.kpi}><Text style={s.kpiLabel}>Total Revenue</Text><Text style={s.kpiValue}>{formatRevenue(revenueLakhs)}</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Proposals by Status</Text>
        {buckets.map(b => <View key={b.label} style={s.line}><View style={s.lineHead}><Text style={s.lineLabel}>{b.label}</Text><Text style={s.lineValue}>{b.count}</Text></View><Bar pct={(b.count / maxBucket) * 100} color={b.color} /></View>)}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Lead Sources</Text>
        {[['KAI Smart Match', kaiMatched, c.green], ['Direct Search', direct, '#c0562c']].map(([label, count, color]) => (
          <View key={label as string} style={s.line}><View style={s.lineHead}><Text style={s.lineLabel}>{label as string}</Text><Text style={s.lineValue}>{Math.round(((count as number) / sourceTotal) * 100)}% · {count as number}</Text></View><Bar pct={((count as number) / sourceTotal) * 100} color={color as string} /></View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Revenue Growth & Trajectory</Text>
        <View style={s.chart}>
          {months.map(m => (
            <View key={m.month + m.revenue} style={s.chartCol}>
              <Text style={s.chartValue}>{m.revenue > 0 ? `₹${m.revenue}L` : ''}</Text>
              <View style={[s.chartBar, { height: Math.max(4, (m.revenue / maxMonth) * 110) }]} />
              <Text style={s.chartMonth}>{m.month}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Client Acquisition Funnel</Text>
        {funnel.map(stage => <View key={stage.label} style={s.line}><View style={s.lineHead}><Text style={s.lineLabel}>{stage.label}</Text><Text style={s.lineValue}>{stage.count}</Text></View><Bar pct={stage.pct} color={c.green} /><Text style={s.sub}>{stage.pct}%</Text></View>)}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Project Category Distribution</Text>
        {categories.map(cat => <View key={cat.name} style={s.line}><View style={s.lineHead}><Text style={s.lineLabel}>{cat.name}</Text><Text style={s.lineValue}>{cat.pct}% · {cat.count}</Text></View><Bar pct={cat.pct} color={c.green} /></View>)}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Client Budget Tier Distribution</Text>
        {tierRows.map(([label, count]) => <View key={label} style={s.line}><View style={s.lineHead}><Text style={s.lineLabel}>{label}</Text><Text style={s.lineValue}>{count} Lead{count === 1 ? '' : 's'} · {tierTotal > 0 ? Math.round((count / tierTotal) * 100) : 0}%</Text></View><Bar pct={tierTotal > 0 ? (count / tierTotal) * 100 : 0} color={c.amber} /></View>)}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  ranges: { gap: 8, paddingVertical: 4 },
  range: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  rangeOn: { backgroundColor: c.green, borderColor: c.green },
  rangeText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 2 },
  kpiLabel: { color: c.muted, fontSize: 12, fontWeight: '600' },
  kpiValue: { color: c.ink, fontSize: 24, fontWeight: '800' },
  delta: { fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 12 },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '800' },
  line: { gap: 5 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { color: c.ink, fontSize: 13, fontWeight: '700' },
  lineValue: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#e6ebe8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, paddingTop: 10 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartBar: { width: 22, borderRadius: 6, backgroundColor: c.green },
  chartValue: { color: c.body, fontSize: 9.5, fontWeight: '700' },
  chartMonth: { color: c.muted, fontSize: 11, fontWeight: '700' },
});
