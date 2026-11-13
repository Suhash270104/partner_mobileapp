import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { router } from 'expo-router';
import { partnerApi, StudioDashboardResponse } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';

type Doc = Record<string, unknown>;
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item) : []);

function Bar({ label, value, color = c.green }: { label: string; value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={{ gap: 5 }}>
      <View style={s.lineHead}><Text style={s.lineLabel}>{label}</Text><Text style={s.lineValue}>{pct}%</Text></View>
      <View style={s.track}><View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

function Chips({ title, items, tone = 'green' }: { title: string; items: string[]; tone?: 'green' | 'amber' | 'grey' }) {
  if (!items.length) return null;
  const palette = { green: [c.greenSoft, c.greenText], amber: [c.amberSoft, c.amber], grey: ['#eef1ef', c.body] }[tone];
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={s.chips}>{items.map(item => <View key={item} style={[s.chip, { backgroundColor: palette[0] }]}><Text style={[s.chipText, { color: palette[1] }]}>{item}</Text></View>)}</View>
    </View>
  );
}

// Port of the desktop "AI Insights" tab: KAI score from the server, everything else derived on the
// client from the studio's saved onboarding profile.
export default function InsightsScreen() {
  const { profile } = useStudio();
  const [dash, setDash] = useState<StudioDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      setDash(await partnerApi.studioDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your insights.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const data = useMemo(() => ({ ...((profile.onboardingData || {}) as Doc), ...(profile as unknown as Doc) }), [profile]);
  const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : '');
  const businessName = text('businessName') || text('companyName') || 'Your Studio';
  const cities = list(data.cities).length ? list(data.cities) : list(data.primaryCities);
  const cityList = cities.length ? cities : (profile.city ? [profile.city] : []);
  const budgetRanges = list(data.budgetRanges).length ? list(data.budgetRanges) : list(data.acceptedBudgetCategories);
  const expertise = list(data.primaryExpertise);
  const services = list(data.services).length ? list(data.services) : list(data.servicesOffered);
  const specializations = list(data.specializations);
  const industries = list(data.industries);
  const propertyTypes = list(data.propertyTypes);
  const team = (data.team || {}) as Record<string, number>;
  const teamTotal = Number(team.total) || ['architects', 'designers', 'civilEngineers', 'siteEngineers', 'otherStaff'].reduce((sum, key) => sum + (Number(team[key]) || 0), 0);
  const timeline = text('projectTimeline') || '3–6 Months';
  const establishedYear = parseInt(text('establishedYear') || String(data.establishedYear || ''), 10);
  const yearsActive = Number.isFinite(establishedYear) && establishedYear > 1900 ? new Date().getFullYear() - establishedYear : 0;

  // Derived exactly like the desktop view.
  const portfolioCount = Number(data.portfolioImagesCount ?? list(data.portfolioImages).length);
  const marketCoverage = cityList.length >= 3 ? 95 : cityList.length >= 2 ? 78 : 60;
  const portfolioScore = portfolioCount >= 6 ? 92 : portfolioCount >= 3 ? 74 : 50;
  const serviceDepth = Math.min(100, services.length * 12 + specializations.length * 8);
  const profileComplete = Math.round(Math.min(100, (marketCoverage + portfolioScore + serviceDepth) / 3));
  const verifiedCount = Object.values((data.verifiedDocs || {}) as Doc).filter(Boolean).length;
  const trustScore = Math.min(100, 60 + verifiedCount * 10);

  const kai = dash?.kaiMetrics || {};
  const score = Number(kai.score || 0);
  const responseRate = Number(kai.responseRate || 0);
  const proposalQuality = Number(kai.proposalQuality || 0);
  const clientSatisfaction = Number(kai.clientSatisfaction || 0);
  const onTimeDelivery = Number(kai.onTimeDelivery || 0);
  const label = kai.ratingLabel || (score >= 90 ? 'Excellent' : score >= 75 ? 'Very Good' : score >= 60 ? 'Good' : score > 0 ? 'Building Score' : 'New Studio');
  const stars = kai.stars || (score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score > 0 ? 2 : 0);
  const percentile = kai.betterThanPercentile || (score > 0 ? Math.min(99, Math.round(score * 0.94)) : 0);

  const operations: [string, string][] = [
    ['Work Mode', text('clientWorkMode') || 'Hybrid'],
    ['Simultaneous Projects', text('simultaneousProjects') || '3–5'],
    ['Avg. Project Timeline', timeline],
    ['Engagement Type', text('preferredEngagement') || 'Turnkey'],
    ['After-Project Support', text('afterProjectSupport') || 'Yes'],
    ['Willing to Travel', data.willingToTravel ? 'Yes' : 'No'],
    ['In-House Manufacturing', data.inHouseManufacturing ? 'Yes' : 'No'],
    ['Warranty Provided', data.warrantyProvided ? 'Yes' : 'No'],
  ];
  const teamRows: [string, number][] = ([['Architects', team.architects], ['Interior Designers', team.designers], ['Civil Engineers', team.civilEngineers], ['Site Engineers', team.siteEngineers], ['Other Staff', team.otherStaff]] as [string, number | undefined][])
    .filter((row): row is [string, number] => Number(row[1]) > 0);
  const processSteps = list(data.processSteps);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Pressable onPress={() => router.navigate('/professional/analytics' as never)} hitSlop={8}><Text style={s.back}>‹ Analytics</Text></Pressable>
      <View style={s.titleRow}><Text style={s.title}>AI Insights</Text><View style={s.beta}><Text style={s.betaText}>BETA</Text></View></View>
      <Text style={s.sub}>Personalised recommendations from KAI, generated from {businessName}&apos;s onboarding profile.</Text>
      {!!error && (
        <View style={{ gap: 6 }}><ErrorText>{error}</ErrorText><Pressable onPress={() => { setLoading(true); void load(); }}><Text style={s.link}>Try again</Text></Pressable></View>
      )}
      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 16 }} />}

      <View style={s.hero}>
        <View style={s.ring}><Text style={s.ringValue}>{score}</Text><Text style={s.ringLabel}>KAI SCORE</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.heroTitle}>{label}</Text>
          <Text style={s.heroStars}>{'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}</Text>
          <Text style={s.heroCopy}>
            {score > 0 ? `Performing better than ${percentile}% of professionals on KraftNex.` : 'Submit proposals and collect reviews to build your KAI score.'}
            {yearsActive > 0 ? ` ${yearsActive} years of experience.` : ''}
          </Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Profile strength & trust</Text>
        <View style={s.tiles}>
          <View style={[s.tile, { backgroundColor: c.greenSoft }]}><Text style={s.tileValue}>{profileComplete}%</Text><Text style={s.tileLabel}>Profile strength</Text></View>
          <View style={[s.tile, { backgroundColor: c.amberSoft }]}><Text style={s.tileValue}>{trustScore}%</Text><Text style={s.tileLabel}>Trust score</Text><Text style={s.tileFoot}>{verifiedCount} verified doc{verifiedCount === 1 ? '' : 's'}</Text></View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>KAI score breakdown</Text>
        <Bar label="Profile Completeness" value={profileComplete} />
        <Bar label="Response Rate" value={responseRate} />
        <Bar label="Proposal Quality" value={proposalQuality} color="#c79a2c" />
        <Bar label="Client Satisfaction" value={clientSatisfaction} color="#c0562c" />
        <Bar label="On-Time Delivery" value={onTimeDelivery} color={c.amber} />
        <Bar label="Trust Score" value={trustScore} />
        <Bar label="Market Coverage" value={marketCoverage} color="#1d4c3b" />
        <Bar label="Portfolio Strength" value={portfolioScore} />
        <Bar label="Service Depth" value={serviceDepth} color="#c79a2c" />
      </View>

      <View style={s.tiles}>
        <View style={s.statTile}><Text style={s.tileLabel}>Cities</Text><Text style={s.tileValue}>{cityList.length}</Text><Text style={s.tileFoot} numberOfLines={1}>{cityList.slice(0, 2).join(', ') || '—'}</Text></View>
        <View style={s.statTile}><Text style={s.tileLabel}>Budget range</Text><Text style={s.tileValue} numberOfLines={1}>{budgetRanges[0] || '—'}</Text><Text style={s.tileFoot}>Primary target</Text></View>
      </View>
      <View style={s.tiles}>
        <View style={s.statTile}><Text style={s.tileLabel}>Services</Text><Text style={s.tileValue}>{services.length}</Text><Text style={s.tileFoot}>Active lines</Text></View>
        <View style={s.statTile}><Text style={s.tileLabel}>Team size</Text><Text style={s.tileValue}>{teamTotal || '—'}</Text><Text style={s.tileFoot}>Total members</Text></View>
      </View>

      <Chips title="Primary expertise" items={expertise} />
      <Chips title="Specializations" items={specializations} tone="amber" />
      <Chips title="Industries" items={industries} tone="grey" />
      <Chips title="Property types" items={propertyTypes} tone="grey" />

      <View style={s.card}>
        <Text style={s.cardTitle}>Operational profile</Text>
        <View style={s.opGrid}>
          {operations.map(([k, v]) => <View key={k} style={s.op}><Text style={s.opLabel}>{k.toUpperCase()}</Text><Text style={s.opValue}>{v || '—'}</Text></View>)}
        </View>
      </View>

      {teamRows.length > 0 && (
        <View style={s.card}>
          <View style={s.lineHead}><Text style={s.cardTitle}>Team composition</Text><Text style={s.lineValue}>{teamTotal} total</Text></View>
          {teamRows.map(([k, v]) => <Bar key={k} label={`${k} (${v})`} value={teamTotal ? (v / teamTotal) * 100 : 0} color="#1d4c3b" />)}
        </View>
      )}

      {processSteps.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Client process flow</Text>
          {processSteps.map((step, i) => <View key={`${step}-${i}`} style={s.step}><View style={s.stepNo}><Text style={s.stepNoText}>{i + 1}</Text></View><Text style={s.lineLabel}>{step}</Text></View>)}
        </View>
      )}

      <Pressable style={s.outline} onPress={() => router.navigate('/professional/profile' as never)}><Text style={s.outlineText}>Improve my profile</Text></Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  back: { color: c.green, fontSize: 13, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  beta: { backgroundColor: '#c0562c', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  betaText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: c.green, borderRadius: 20, padding: 18 },
  ring: { width: 92, height: 92, borderRadius: 46, borderWidth: 5, borderColor: '#34d399', alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: '#fff', fontSize: 30, fontWeight: '800' },
  ringLabel: { color: '#9cc9b6', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.6 },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  heroStars: { color: '#e3b84e', fontSize: 15, letterSpacing: 1 },
  heroCopy: { color: '#c3dccf', fontSize: 12, lineHeight: 17 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 12 },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '800' },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineLabel: { color: c.ink, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  lineValue: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#e6ebe8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  statTile: { flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 2 },
  tileValue: { color: c.ink, fontSize: 22, fontWeight: '800' },
  tileLabel: { color: c.body, fontSize: 11.5, fontWeight: '700' },
  tileFoot: { color: c.muted, fontSize: 10.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  opGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  op: { width: '48.5%', backgroundColor: '#f1f5f3', borderRadius: 12, padding: 10, gap: 3 },
  opLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  opValue: { color: c.ink, fontSize: 13, fontWeight: '800' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNo: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: c.green, fontSize: 11, fontWeight: '800' },
  outline: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 14, fontWeight: '800' },
});
