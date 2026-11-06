import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { router } from 'expo-router';
import { OpenClientProject, partnerApi } from '../../lib/partnerApi';
import { loadStoredPreferences, preferenceCriteria, preferencesFromProfile, ProjectPreferences } from '../../lib/projectPreferences';
import { c, Card } from '../professional/onboardingUi';
import { LeadProject, ProposalContext, ProposalSheet, UnlockSheet } from './leadSheets';
import { useStudio } from './StudioContext';

const idOf = (project: OpenClientProject) => String(project._id || project.id || '');
const placeOf = (project: OpenClientProject) => project.location || [project.locality, project.city].filter(Boolean).join(', ') || project.city || '';

// "KAI Recommended Projects": open client briefs this studio has not bid on yet, narrowed to the
// studio's operating cities and ranked by how many of its own criteria they meet. The desktop card
// shows a made-up percentage; here the match is the real criteria count.
export function RecommendedProjects() {
  const { profile } = useStudio();
  const [projects, setProjects] = useState<OpenClientProject[]>([]);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [credits, setCredits] = useState<number | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<ProjectPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlockTarget, setUnlockTarget] = useState<LeadProject | null>(null);
  const [proposalTarget, setProposalTarget] = useState<ProposalContext | null>(null);
  const designerId = String(profile._id || '');

  const load = useCallback(async () => {
    const [list, record, proposals, stored] = await Promise.allSettled([
      partnerApi.openClientProjects(),
      partnerApi.professionalProfile(),
      partnerApi.myProposals(),
      loadStoredPreferences(designerId),
    ]);
    if (list.status === 'fulfilled') {
      const value = list.value;
      setProjects(Array.isArray(value) ? value : (value.projects || []));
      setError('');
    } else {
      setError(list.reason instanceof Error ? list.reason.message : 'Could not load recommended projects.');
    }
    if (record.status === 'fulfilled') {
      setUnlocked(new Set((record.value.unlockedClientProjectIds || []).map(String)));
      if (typeof record.value.leadCredits === 'number') setCredits(record.value.leadCredits);
      if (typeof record.value.bonusLeadCredits === 'number') setBonus(record.value.bonusLeadCredits);
    }
    if (proposals.status === 'fulfilled' && Array.isArray(proposals.value)) {
      setSubmitted(new Set((proposals.value as { projectId?: { _id?: string } | string; project?: { id?: string; _id?: string } }[])
        .map(p => String((typeof p.projectId === 'object' ? p.projectId?._id : p.projectId) || p.project?.id || p.project?._id || ''))
        .filter(Boolean)));
    }
    if (stored.status === 'fulfilled') setPrefs(stored.value);
    setLoading(false);
  }, [designerId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const ranked = useMemo(() => {
    const criteriaPrefs = prefs || preferencesFromProfile(profile);
    const onboarding = (profile.onboardingData || {}) as { primaryCities?: unknown; cities?: unknown };
    const registered = [onboarding.primaryCities, onboarding.cities, (profile as { cities?: unknown }).cities]
      .find(value => Array.isArray(value) && value.length > 0) as string[] | undefined;
    const cities = (registered || (profile.city ? [profile.city] : [])).map(city => String(city).toLowerCase().trim()).filter(Boolean);
    return projects
      .filter(project => {
        if (project.designerId || project.projectType === 'professional') return false;
        if (project.status && project.status !== 'Open' && project.status !== 'Draft') return false;
        if (submitted.has(idOf(project))) return false;
        if (!cities.length) return true;
        const where = `${project.location || ''} ${project.city || ''}`.toLowerCase();
        return cities.some(city => where.includes(city));
      })
      .map(project => {
        const criteria = preferenceCriteria(project, criteriaPrefs);
        return { project, criteria, score: criteria.filter(item => item.ok).length };
      })
      .sort((a, b) => b.score - a.score
        || new Date(b.project.updatedAt || b.project.createdAt || 0).getTime() - new Date(a.project.updatedAt || a.project.createdAt || 0).getTime())
      .slice(0, 12);
  }, [projects, submitted, prefs, profile]);

  const asLead = (project: OpenClientProject): LeadProject => ({
    id: idOf(project), title: project.title, location: placeOf(project), budgetRange: project.budgetRange, areaSqFt: project.areaSqFt, timeline: project.timeline,
    proposalsReceived: project.proposalsReceived, maxProposals: project.maxProposals,
  });
  const unlockLabel = bonus !== null && bonus > 0 ? `${bonus} free left` : credits !== null && credits >= 1 ? '1 plan credit' : 'pay once';

  return (
    <View>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>KAI Recommended Projects</Text>
          <Text style={s.sub}>Matching your target locations & budget preferences</Text>
        </View>
        <Pressable onPress={() => router.navigate('/professional/find-projects' as never)}><Text style={s.link}>See all</Text></Pressable>
      </View>

      {loading && <ActivityIndicator color={c.green} style={{ marginVertical: 20 }} />}
      {!loading && !!error && <Text style={s.errorText}>{error}</Text>}
      {!loading && !error && ranked.length === 0 && (
        <Card style={s.empty}>
          <Text style={s.emptyTitle}>No Nearby Projects Found</Text>
          <Text style={s.emptyCopy}>When clients post new project briefs{profile.city ? ` in ${profile.city}` : ' in your service area'}, KAI will automatically match and feature them here for your studio.</Text>
        </Card>
      )}

      {ranked.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
          {ranked.map(({ project, criteria }) => {
            const id = idOf(project);
            const isUnlocked = unlocked.has(id);
            const allOk = criteria.length > 0 && criteria.every(item => item.ok);
            return (
              <View key={id} style={s.card}>
                {!!project.previewThumbnail && <Image source={{ uri: project.previewThumbnail }} style={s.image} />}
                <View style={s.body}>
                  <View style={s.badges}>
                    {allOk && <Text style={s.match}>✦ KAI match</Text>}
                    {!!(project.membershipLevel || project.budgetCategory) && <Text style={s.tier}>{project.membershipLevel || project.budgetCategory}</Text>}
                  </View>
                  <Pressable onPress={() => router.navigate({ pathname: '/professional/project-details', params: { id } } as never)}><Text style={s.cardTitle} numberOfLines={2}>{project.title || 'Client Project Brief'}</Text><Text style={s.details}>View Details →</Text></Pressable>
                  <Text style={s.place} numberOfLines={1}>📍 {placeOf(project) || 'Location on unlock'}</Text>
                  <View style={s.money}>
                    <Text style={s.budget} numberOfLines={1}>{project.budgetRange || 'Budget on request'}</Text>
                    {!!project.timeline && <Text style={s.place} numberOfLines={1}>{project.timeline}</Text>}
                  </View>
                  {criteria.length > 0 && (
                    <View style={s.criteria}>
                      {criteria.map(item => <Text key={item.label} style={[s.crit, item.ok ? s.critOk : s.critNo]}>{item.ok ? '✓' : '✕'} {item.label}</Text>)}
                    </View>
                  )}
                  {isUnlocked ? (
                    <Pressable style={s.primary} onPress={() => setProposalTarget({ projectId: id, projectTitle: project.title, location: placeOf(project), budget: project.budgetRange, timeline: project.timeline })}>
                      <Text style={s.primaryText}>Submit Bid  →</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={s.primary} onPress={() => setUnlockTarget(asLead(project))}>
                      <Text style={s.primaryText}>🔒 Unlock Lead · {unlockLabel}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <UnlockSheet
        project={unlockTarget}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={({ projectId, leadCredits }) => {
          setUnlocked(previous => new Set(previous).add(projectId));
          if (typeof leadCredits === 'number') setCredits(leadCredits);
          void load();
        }}
        onSubmitProposal={project => {
          setUnlockTarget(null);
          setProposalTarget({ projectId: project.id, projectTitle: project.title, location: project.location, budget: project.budgetRange, timeline: project.timeline });
        }}
      />
      <ProposalSheet
        context={proposalTarget}
        onClose={() => setProposalTarget(null)}
        onSubmitted={() => { if (proposalTarget) setSubmitted(previous => new Set(previous).add(proposalTarget.projectId)); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 6 },
  title: { color: c.ink, fontSize: 18, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5, marginTop: 2 },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  errorText: { color: c.red, fontSize: 13 },
  empty: { alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  card: { width: 280, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  image: { width: '100%', height: 130, backgroundColor: '#eef1ef' },
  body: { padding: 14, gap: 8 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  match: { backgroundColor: c.mint, color: c.greenText, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, fontSize: 10.5, fontWeight: '800', overflow: 'hidden' },
  tier: { backgroundColor: '#f1efe9', color: c.body, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, fontSize: 10.5, fontWeight: '800', overflow: 'hidden' },
  details: { color: c.green, fontSize: 12, fontWeight: '800', marginTop: 3 },
  cardTitle: { color: c.ink, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  place: { color: c.body, fontSize: 12.5 },
  money: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  budget: { color: c.greenText, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  criteria: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  crit: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  critOk: { backgroundColor: c.greenSoft, color: c.greenText },
  critNo: { backgroundColor: '#f4eeee', color: c.red },
  primary: { height: 44, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
