import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { Icon } from '../Icon';
import { router } from 'expo-router';
import { OpenClientProject, partnerApi } from '../../lib/partnerApi';
import { loadStoredPreferences, preferenceCriteria, preferencesFromProfile, ProjectPreferences } from '../../lib/projectPreferences';
import { c, Card } from '../professional/onboardingUi';
import { LeadProject, ProposalContext, ProposalSheet, UnlockSheet } from './leadSheets';
import { useStudio } from './StudioContext';

const CARD_W = 300;
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + 12} decelerationRate="fast" contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
          {ranked.map(({ project, criteria }) => {
            const id = idOf(project);
            const isUnlocked = unlocked.has(id);
            const allOk = criteria.length > 0 && criteria.every(item => item.ok);
            const tier = project.membershipLevel || project.budgetCategory;
            const open = () => router.navigate({ pathname: '/professional/project-details', params: { id } } as never);
            return (
              <View key={id} style={s.card}>
                <View style={s.media}>
                  {project.previewThumbnail
                    ? <Image source={{ uri: project.previewThumbnail }} style={s.image} />
                    : <View style={s.placeholder}><Icon name="image" size={30} color={c.green} strokeWidth={1.5} /></View>}
                  <View style={s.badges}>
                    {allOk && <View style={s.matchBadge}><Icon name="zap" size={11} color={c.greenText} /><Text style={s.matchText}>KAI match</Text></View>}
                    {!!tier && <View style={s.tierBadge}><Text style={s.tierText}>{tier}</Text></View>}
                  </View>
                </View>
                <View style={s.body}>
                  <View style={{ gap: 6 }}>
                    <Pressable onPress={open}><Text style={s.cardTitle} numberOfLines={2}>{project.title || 'Client Project Brief'}</Text></Pressable>
                    <View style={s.row}><Icon name="mapPin" size={14} color={c.body} /><Text style={s.place} numberOfLines={1}>{placeOf(project) || 'Location on unlock'}</Text></View>
                  </View>
                  <View style={s.stats}>
                    <View style={s.stat}><Text style={s.statLabel}>BUDGET</Text><Text style={s.statValue} numberOfLines={1}>{project.budgetRange || 'On request'}</Text></View>
                    <View style={s.statDivider} />
                    <View style={s.stat}><Text style={s.statLabel}>TIMELINE</Text><Text style={s.statValue} numberOfLines={1}>{project.timeline || 'Flexible'}</Text></View>
                  </View>
                  {criteria.length > 0 && (
                    <View style={s.criteria}>
                      {criteria.map(item => (
                        <View key={item.label} style={[s.crit, item.ok ? s.critOk : s.critNo]}>
                          <Icon name={item.ok ? 'check' : 'x'} size={11} color={item.ok ? c.greenText : c.red} strokeWidth={2.4} />
                          <Text style={[s.critText, { color: item.ok ? c.greenText : c.red }]}>{item.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={s.actions}>
                    {isUnlocked ? (
                      <Pressable style={s.primary} onPress={() => setProposalTarget({ projectId: id, projectTitle: project.title, location: placeOf(project), budget: project.budgetRange, timeline: project.timeline })}>
                        <Text style={s.primaryText}>Submit bid</Text><Icon name="arrowRight" size={16} color="#fff" />
                      </Pressable>
                    ) : (
                      <Pressable style={s.primary} onPress={() => setUnlockTarget(asLead(project))}>
                        <Icon name="lock" size={15} color="#fff" /><Text style={s.primaryText}>Unlock lead · {unlockLabel}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={open} style={s.detailsBtn} hitSlop={6}><Text style={s.details}>View details</Text><Icon name="arrowRight" size={14} color={c.green} /></Pressable>
                  </View>
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
  card: { width: CARD_W, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: c.line, overflow: 'hidden' },
  media: { height: 120, backgroundColor: c.greenSoft },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  matchBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  matchText: { color: c.greenText, fontSize: 11, fontWeight: '800' },
  tierBadge: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  tierText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { flex: 1, padding: 16, gap: 14, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  place: { color: c.body, fontSize: 13, flexShrink: 1 },
  stats: { flexDirection: 'row', backgroundColor: '#f6f8f7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  stat: { flex: 1, gap: 2 },
  statDivider: { width: 1, backgroundColor: c.line, marginHorizontal: 12 },
  statLabel: { color: c.body, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  statValue: { color: c.greenText, fontSize: 14, fontWeight: '800' },
  criteria: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  crit: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  critText: { fontSize: 11, fontWeight: '700' },
  critOk: { backgroundColor: c.greenSoft },
  critNo: { backgroundColor: '#f8eded' },
  actions: { gap: 10, alignItems: 'center' },
  primary: { alignSelf: 'stretch', height: 46, borderRadius: 13, backgroundColor: c.green, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  details: { color: c.green, fontSize: 13, fontWeight: '800' },
});
