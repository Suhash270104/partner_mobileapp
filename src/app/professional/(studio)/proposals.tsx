import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';

interface Proposal {
  id: string;
  status?: string;
  priceEst?: string;
  timeline?: string;
  scopeText?: string;
  matchScore?: number | null;
  createdAt?: string;
  project?: { title?: string; location?: string; budgetRange?: string };
  customer?: { name?: string };
}

type FilterTab = 'all' | 'Submitted' | 'Under Review' | 'Shortlisted' | 'Won' | 'Not Selected';

// Same statuses and labels as the desktop Proposals view.
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  Submitted: { label: 'Submitted', bg: '#eef1f0', fg: c.body },
  'Under Review': { label: 'Under Review', bg: c.amberSoft, fg: c.amber },
  Pending: { label: 'Pending', bg: c.amberSoft, fg: c.amber },
  Shortlisted: { label: 'Shortlisted', bg: '#fbeee4', fg: '#8a4a24' },
  Won: { label: 'Won 🎉', bg: c.green, fg: '#fff' },
  Awarded: { label: 'Won 🎉', bg: c.green, fg: '#fff' },
  Accepted: { label: 'Accepted 🎉', bg: c.green, fg: '#fff' },
  'In Progress': { label: 'In Progress', bg: '#1d4c3b', fg: '#fff' },
  'Work in Progress': { label: 'In Progress', bg: '#1d4c3b', fg: '#fff' },
  Completed: { label: 'Completed', bg: c.green, fg: '#fff' },
  'Not Selected': { label: 'Not Selected', bg: c.redSoft, fg: c.red },
  Rejected: { label: 'Rejected', bg: c.redSoft, fg: c.red },
};

export default function ProposalsScreen() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setError('');
      const fetched = await partnerApi.myProposals();
      setProposals(Array.isArray(fetched) ? (fetched as Proposal[]) : []);
    } catch (e) {
      setProposals([]);
      setError(e instanceof Error ? e.message : 'Unable to load proposals.');
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => { void load(); }, 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 8000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const isWon = (p: Proposal) => p.status === 'Won' || p.status === 'Awarded';
  const byTab = filter === 'all' ? proposals : filter === 'Won' ? proposals.filter(isWon) : proposals.filter(p => p.status === filter);
  const q = query.trim().toLowerCase();
  const filtered = !q ? byTab : byTab.filter(p => (p.project?.title || '').toLowerCase().includes(q) || (p.customer?.name || '').toLowerCase().includes(q));

  // Quotes still awaiting a decision: every proposal not yet resolved.
  const pending = proposals
    .filter(p => !['Won', 'Awarded', 'Accepted', 'Completed', 'Not Selected', 'Rejected'].includes(p.status || ''))
    .reduce((sum, p) => sum + (parseFloat(String(p.priceEst || '').replace(/[^\d.]/g, '')) || 0), 0);

  const count = (tab: FilterTab) => tab === 'all' ? proposals.length : tab === 'Won' ? proposals.filter(isWon).length : proposals.filter(p => p.status === tab).length;
  const tabs: [FilterTab, string][] = [['all', 'All'], ['Submitted', 'Submitted'], ['Under Review', 'Under Review'], ['Shortlisted', 'Shortlisted'], ['Won', 'Won'], ['Not Selected', 'Not Selected']];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Proposals</Text>
      <Text style={s.sub}>{proposals.length} total{pending > 0 ? ` · ₹${pending.toLocaleString('en-IN')} in quotes awaiting a decision` : ''}</Text>
      <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search proposals…" placeholderTextColor="#98a59f" />
      {!!error && <ErrorText>{error}</ErrorText>}

      {loaded && !error && proposals.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No proposals yet</Text>
          <Text style={s.emptyCopy}>Submit a proposal from an unlocked client lead and it will appear here.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
            {tabs.map(([key, label]) => (
              <Pressable key={key} style={[s.tab, filter === key && s.tabOn]} onPress={() => setFilter(key)}>
                <Text style={[s.tabText, filter === key && { color: '#fff' }]}>{label} {count(key)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {filtered.length === 0 && loaded && <View style={s.empty}><Text style={s.emptyCopy}>{q ? 'No proposals match your search.' : `No proposals with status "${filter}"`}</Text></View>}
          {filtered.map(p => {
            const status = p.status ? (STATUS[p.status] || { label: p.status, bg: '#eef1f0', fg: c.body }) : null;
            const project = p.project || {};
            const initials = (project.title || p.customer?.name || 'PR').trim().slice(0, 2).toUpperCase();
            return (
              <View key={p.id} style={s.card}>
                <View style={s.top}>
                  <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={s.statusRow}>
                      {status ? <View style={[s.status, { backgroundColor: status.bg }]}><Text style={[s.statusText, { color: status.fg }]}>{status.label}</Text></View> : <View />}
                      {p.matchScore != null && <Text style={s.match}>{p.matchScore}% match</Text>}
                    </View>
                    <Text style={s.cardTitle} numberOfLines={2}>{project.title || ''}</Text>
                    <Text style={s.meta} numberOfLines={1}>{[p.customer?.name, project.location].filter(Boolean).join(' • ')}</Text>
                  </View>
                </View>
                <View style={s.money}>
                  <View style={{ flex: 1 }}><Text style={s.moneyLabel}>QUOTE</Text><Text style={s.moneyValue}>{p.priceEst || '0'}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.moneyLabel}>TIMELINE</Text><Text style={s.moneyValue}>{p.timeline || '—'}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.moneyLabel}>SUBMITTED</Text><Text style={s.moneyValue}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</Text></View>
                </View>
                {!!project.budgetRange && project.budgetRange !== p.priceEst && <Text style={s.meta}>Client budget: {project.budgetRange}</Text>}
                {!!p.scopeText && <Text style={s.scope} numberOfLines={3}>{p.scopeText}</Text>}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13, marginTop: 4, marginBottom: 14 },
  search: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14.5 },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 6, marginTop: 14 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12, gap: 10 },
  top: { flexDirection: 'row', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.green, fontSize: 14, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  match: { color: c.greenText, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '800', marginTop: 5, lineHeight: 21 },
  meta: { color: c.body, fontSize: 12, marginTop: 2 },
  money: { flexDirection: 'row', gap: 8, backgroundColor: '#f1f5f3', borderRadius: 12, padding: 10 },
  moneyLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  moneyValue: { color: c.ink, fontSize: 13, fontWeight: '800', marginTop: 2 },
  scope: { color: c.body, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },
});
