import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { router } from 'expo-router';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { LeadProject, PlansSheet, ProposalContext, ProposalSheet, UnlockSheet } from '../../../components/studio/leadSheets';
import { useStudio } from '../../../components/studio/StudioContext';

interface Shortlisted {
  id: string;
  title?: string;
  status?: string;
  isUnlocked?: boolean;
  hasSubmittedProposal?: boolean;
  proposal?: unknown;
  client?: { name?: string };
  city?: string;
  location?: string;
  propertyType?: string;
  budgetRange?: string;
  areaSqFt?: string | number;
  timeline?: string;
  description?: string;
  proposalsReceived?: number;
  maxProposals?: number;
}

const CLOSED = ['completed', 'closed', 'archived', 'done'];

export default function ShortlistedScreen() {
  const { profile } = useStudio();
  const [projects, setProjects] = useState<Shortlisted[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [credits, setCredits] = useState<number | null>(typeof profile.leadCredits === 'number' ? profile.leadCredits : null);
  const [unlockTarget, setUnlockTarget] = useState<LeadProject | null>(null);
  const [proposalTarget, setProposalTarget] = useState<ProposalContext | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [chatting, setChatting] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const res = await partnerApi.call<{ projects?: Shortlisted[] } | Shortlisted[]>('/professional/shortlisted-projects');
      setProjects(Array.isArray(res) ? res : Array.isArray(res.projects) ? res.projects : []);
    } catch (e) {
      setProjects([]);
      setError(e instanceof Error ? e.message : 'Unable to load shortlisted projects.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (typeof profile.leadCredits === 'number') return;
    partnerApi.professionalProfile().then(record => { if (typeof record.leadCredits === 'number') setCredits(record.leadCredits); }, () => undefined);
  }, [profile.leadCredits]);

  async function openChat(project: Shortlisted) {
    setChatting(project.id);
    try {
      const result = await partnerApi.openProfessionalChatRoom(project.id);
      router.navigate({ pathname: '/professional/messages', params: result.room?.roomId ? { room: result.room.roomId } : {} } as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the conversation. Please try again.');
    } finally {
      setChatting('');
    }
  }

  const q = query.trim().toLowerCase();
  const shown = projects.filter(p => !q || [p.title, p.city, p.location, p.propertyType, p.client?.name].some(value => (value || '').toLowerCase().includes(q)));

  return (
    <View style={s.flex}>
      <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Shortlisted Projects</Text>
            <Text style={s.sub}>{projects.length} client brief{projects.length === 1 ? '' : 's'} you&apos;ve saved to review</Text>
          </View>
          <Pressable style={s.credits} onPress={() => setPlansOpen(true)}><Text style={s.creditsText}>{credits === null ? 'Leads' : `${credits} ${credits === 1 ? 'Lead' : 'Leads'}`}</Text></Pressable>
        </View>
        <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search shortlisted projects..." placeholderTextColor="#98a59f" />

        {loading && <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />}
        {!!error && <View style={{ gap: 6 }}><ErrorText>{error}</ErrorText><Pressable onPress={() => { setLoading(true); void load(); }}><Text style={s.link}>Retry</Text></Pressable></View>}
        {!loading && !error && shown.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{projects.length === 0 ? 'No shortlisted projects yet' : 'No projects match your search'}</Text>
            {projects.length === 0 && <Pressable style={s.solid} onPress={() => router.navigate('/professional/find-projects' as never)}><Text style={s.solidText}>Explore Marketplace Projects</Text></Pressable>}
          </View>
        )}

        {shown.map(project => {
          const hasProposal = Boolean(project.hasSubmittedProposal || project.proposal);
          const done = CLOSED.includes(String(project.status || '').toLowerCase().trim());
          const meta = [project.location, project.budgetRange ? `Budget ${project.budgetRange}` : null, project.areaSqFt, project.timeline].filter(Boolean).join(' · ');
          return (
            <View key={project.id} style={s.card}>
              <View style={s.top}>
                <Text style={s.cardTitle} numberOfLines={2}>{project.isUnlocked ? `${project.client?.name || 'Verified Client'} — ${project.title}` : project.title}</Text>
                <View style={[s.pill, project.isUnlocked ? { backgroundColor: c.mint } : { backgroundColor: '#eef1f0' }]}>
                  <Text style={[s.pillText, { color: project.isUnlocked ? c.greenText : c.body }]}>{project.isUnlocked ? 'Unlocked' : done ? 'Completed' : 'Locked'}</Text>
                </View>
              </View>
              {!!project.status && <Text style={s.status}>{project.status}</Text>}
              {!!meta && <Text style={s.meta}>{meta}</Text>}
              {!!project.description && <Text style={s.desc} numberOfLines={3}>{project.description}</Text>}

              {!project.isUnlocked ? (
                done ? <View style={s.solidOff}><Text style={s.solidText}>Project Completed</Text></View> : (
                  <Pressable style={s.solid} onPress={() => setUnlockTarget({ id: project.id, title: project.title, location: project.location || project.city, budgetRange: project.budgetRange, areaSqFt: project.areaSqFt, timeline: project.timeline, proposalsReceived: project.proposalsReceived, maxProposals: project.maxProposals })}>
                    <Text style={s.solidText}>🔒 Unlock · {credits && credits >= 1 ? '1 Credit' : 'Buy Leads to Unlock'}</Text>
                  </Pressable>
                )
              ) : (
                <View style={s.actions}>
                  <Pressable style={s.outline} disabled={chatting === project.id} onPress={() => void openChat(project)}>{chatting === project.id ? <ActivityIndicator color={c.green} /> : <Text style={s.outlineText}>Message</Text>}</Pressable>
                  {hasProposal ? <View style={[s.solidOff, { flex: 1 }]}><Text style={s.solidText}>Proposal Sent</Text></View>
                    : done ? <View style={[s.solidOff, { flex: 1 }]}><Text style={s.solidText}>Project Completed</Text></View>
                    : <Pressable style={[s.solid, { flex: 1 }]} onPress={() => setProposalTarget({ projectId: project.id, clientName: project.client?.name, projectTitle: project.title, location: project.location, budget: project.budgetRange, timeline: project.timeline })}><Text style={s.solidText}>Submit Proposal</Text></Pressable>}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <UnlockSheet
        project={unlockTarget}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={({ leadCredits }) => { if (typeof leadCredits === 'number') setCredits(leadCredits); void load(); }}
        onSubmitProposal={project => { setUnlockTarget(null); setProposalTarget({ projectId: project.id, projectTitle: project.title, location: project.location, budget: project.budgetRange, timeline: project.timeline }); }}
      />
      <ProposalSheet context={proposalTarget} onClose={() => setProposalTarget(null)} onSubmitted={() => void load()} />
      <PlansSheet visible={plansOpen} onClose={() => setPlansOpen(false)} onPurchased={() => { partnerApi.professionalProfile().then(record => { if (typeof record.leadCredits === 'number') setCredits(record.leadCredits); }, () => undefined); }} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: c.ink, fontSize: 26, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5, marginTop: 2 },
  credits: { backgroundColor: c.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  creditsText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  search: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14.5 },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 12 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardTitle: { flex: 1, color: c.ink, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  status: { color: c.greenText, fontSize: 11.5, fontWeight: '800' },
  meta: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  desc: { color: c.body, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  solid: { height: 46, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 4 },
  solidOff: { height: 46, borderRadius: 13, backgroundColor: '#a9b6b0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 4 },
  solidText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  outline: { flex: 1, height: 46, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  outlineText: { color: c.green, fontSize: 13.5, fontWeight: '800' },
});
