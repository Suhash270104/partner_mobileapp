import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { router } from 'expo-router';
import { OpenClientProject, partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { LeadProject, ProposalContext, ProposalSheet, UnlockSheet } from '../../../components/studio/leadSheets';
import { ProjectPreferencesWizard } from '../../../components/studio/ProjectPreferencesWizard';
import { useStudio } from '../../../components/studio/StudioContext';
import {
  loadStoredPreferences, MIN_PROJECT_VALUES, preferenceCriteria, PROJECT_VALUE_TIERS, ProjectPreferences,
  preferencesFromProfile, projectMatchesPreferences,
} from '../../../lib/projectPreferences';

const ALL = 'All locations';

const idOf = (project: OpenClientProject) => String(project._id || project.id || '');
const placeOf = (project: OpenClientProject) => project.location || [project.locality, project.city].filter(Boolean).join(', ') || project.city || '';

export default function FindProjectsScreen() {
  const { profile: studio, patchProfile } = useStudio();
  const designerId = String(studio._id || '');
  const [prefs, setPrefs] = useState<ProjectPreferences | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  // "Recommended" = only briefs that meet the studio's preferences; "All Projects" = everything.
  const [recommendedOnly, setRecommendedOnly] = useState(true);
  const [bonus, setBonus] = useState<number | null>(null);
  const [projects, setProjects] = useState<OpenClientProject[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(ALL);
  const [unlockTarget, setUnlockTarget] = useState<LeadProject | null>(null);
  const [proposalTarget, setProposalTarget] = useState<ProposalContext | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    const [listResult, profileResult, proposalResult] = await Promise.allSettled([
      partnerApi.openClientProjects(),
      partnerApi.professionalProfile(),
      partnerApi.myProposals(),
    ]);
    if (listResult.status === 'fulfilled') {
      const value = listResult.value;
      setProjects(Array.isArray(value) ? value : (value.projects || []));
    } else {
      setError(listResult.reason instanceof Error ? listResult.reason.message : 'Could not load projects.');
    }
    if (profileResult.status === 'fulfilled') {
      setUnlocked(new Set((profileResult.value.unlockedClientProjectIds || []).map(String)));
      if (typeof profileResult.value.leadCredits === 'number') setCredits(profileResult.value.leadCredits);
      if (typeof profileResult.value.bonusLeadCredits === 'number') setBonus(profileResult.value.bonusLeadCredits);
    }
    if (proposalResult.status === 'fulfilled' && Array.isArray(proposalResult.value)) {
      setSubmitted(new Set((proposalResult.value as { projectId?: { _id?: string } | string; project?: { id?: string; _id?: string } }[])
        .map(p => String((typeof p.projectId === 'object' ? p.projectId?._id : p.projectId) || p.project?.id || p.project?._id || ''))
        .filter(Boolean)));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // A studio that has not set preferences on this device starts with the wizard, pre-filled from its profile.
  useEffect(() => {
    if (!designerId) return;
    let cancelled = false;
    void loadStoredPreferences(designerId).then(stored => {
      if (cancelled) return;
      if (stored) setPrefs(stored); else setWizardOpen(true);
      setPrefsReady(true);
    });
    return () => { cancelled = true; };
  }, [designerId]);

  // Only open client briefs: no studio-posted projects, nothing already awarded or closed.
  const open = useMemo(() => projects.filter(project => {
    if (project.designerId || project.projectType === 'professional') return false;
    if (project.status && project.status !== 'Open' && project.status !== 'Draft') return false;
    return true;
  }), [projects]);

  const locations = useMemo(() => {
    const counts = new Map<string, number>();
    open.forEach(project => { const city = project.city || placeOf(project); if (city) counts.set(city, (counts.get(city) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [open]);

  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const usePrefs = Boolean(prefs && recommendedOnly);
  const shown = open
    .filter(project => !usePrefs || (prefs && projectMatchesPreferences(project, prefs)))
    .filter(project => location === ALL || (project.city || placeOf(project)) === location)
    .filter(project => {
      if (!words.length) return true;
      const haystack = [project.title, placeOf(project), project.budgetRange, project.propertyType, project.timeline].filter(Boolean).join(' ').toLowerCase();
      return words.every(word => haystack.includes(word));
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  // On "All Projects" a studio's best fits come first (newest first within each group).
  const ranked = prefs && !recommendedOnly
    ? [...shown].sort((a, b) => preferenceCriteria(b, prefs).filter(x => x.ok).length - preferenceCriteria(a, prefs).filter(x => x.ok).length)
    : shown;

  const tabCounts = prefs
    ? { recommended: open.filter(project => projectMatchesPreferences(project, prefs)).length, all: open.length }
    : { recommended: 0, all: open.length };

  const prefsLocation = prefs
    ? (prefs.radius === 'Anywhere' || !prefs.cities.length
      ? 'Anywhere'
      : `${prefs.cities.slice(0, 2).join(', ')}${prefs.cities.length > 2 ? ` +${prefs.cities.length - 2}` : ''}${prefs.radius ? ` · within ${prefs.radius}` : ''}`)
    : '';
  const prefsChips = prefs
    ? [
      ...PROJECT_VALUE_TIERS.filter(tier => prefs.budgetTiers.includes(tier.tier)).map(tier => `${tier.label} · ${tier.range}`),
      ...(prefs.minProjectValue ? [`Min ${MIN_PROJECT_VALUES.find(option => option.value === prefs.minProjectValue)?.label || prefs.minProjectValue}`] : []),
      ...prefs.projectTypes,
    ]
    : [];
  const popularCities = locations.map(([city]) => city).slice(0, 8);
  const planCredits = credits === null ? 0 : Math.max(0, credits - (bonus ?? 0));
  const creditLine = credits === null ? ''
    : bonus === null ? `${credits} lead ${credits === 1 ? 'credit' : 'credits'} available`
    : bonus > 0 ? `${bonus} of 2 free unlocks left${planCredits > 0 ? ` · ${planCredits} plan credits` : ''}`
    : credits > 0 ? `Free unlocks used · ${credits} plan ${credits === 1 ? 'credit' : 'credits'} left`
    : '2 free unlocks used · pay once per lead';

  const asLead = (project: OpenClientProject): LeadProject => ({
    id: idOf(project), title: project.title, location: placeOf(project), budgetRange: project.budgetRange, areaSqFt: project.areaSqFt, timeline: project.timeline,
    proposalsReceived: project.proposalsReceived, maxProposals: project.maxProposals,
  });

  return (
    <View style={s.flex}>
      <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
        <Text style={s.title}>Find Projects</Text>
        <Text style={s.sub}>Open client briefs. Unlock one to see the client&apos;s contact and send a proposal.</Text>
        {prefsReady && (
          <View style={s.match}>
            <View style={s.matchHead}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="zap" size={13} color="#456557" /><Text style={s.matchTitle}>KAI SMART MATCH · YOUR CRITERIA</Text></View>
              <Pressable style={s.matchEdit} onPress={() => setWizardOpen(true)}><Text style={s.matchEditText}>{prefs ? 'Edit' : 'Set up'}</Text></Pressable>
            </View>
            {prefs ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="mapPin" size={14} color={c.ink} /><Text style={s.matchPlace}>{prefsLocation}</Text></View>
                {prefsChips.length > 0 && <View style={s.matchChips}>{prefsChips.map(chip => <Text key={chip} style={s.matchChip}>{chip}</Text>)}</View>}
              </>
            ) : <Text style={s.matchCopy}>Tell KAI the projects you want and we&apos;ll match briefs by budget, city and type.</Text>}
            {!!creditLine && <Text style={s.matchCredits}>{creditLine}</Text>}
          </View>
        )}

        {!!prefs && (
          <View style={s.tabs}>
            {([[true, 'Recommended', tabCounts.recommended], [false, 'All Projects', tabCounts.all]] as [boolean, string, number][]).map(([on, label, count]) => (
              <Pressable key={label} style={[s.tab, recommendedOnly === on && s.tabOn]} onPress={() => setRecommendedOnly(on)}>
                <Text style={[s.tabText, recommendedOnly === on && { color: c.greenText }]}>{label}  {count}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search by project, area, budget…" placeholderTextColor="#98a59f" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {[[ALL, open.length] as [string, number], ...locations].map(([name, count]) => (
            <Pressable key={name} style={[s.chip, location === name && s.chipOn]} onPress={() => setLocation(name)}>
              <Text style={[s.chipText, location === name && { color: '#fff' }]}>{name} {count}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}
        {!!error && <ErrorText>{error}</ErrorText>}
        {!loading && !error && ranked.length === 0 && (
          <View style={s.empty}><Text style={s.emptyTitle}>No projects found</Text><Text style={s.emptyCopy}>{usePrefs ? 'No open briefs match your criteria yet. Try All Projects or edit your criteria.' : 'Try a different search or location.'}</Text></View>
        )}

        {ranked.map(project => {
          const id = idOf(project);
          const isUnlocked = unlocked.has(id);
          const hasProposal = submitted.has(id);
          return (
            <View key={id} style={s.card}>
              {!!project.previewThumbnail && <Image source={{ uri: project.previewThumbnail }} style={s.image} />}
              <View style={s.body}>
                <Pressable onPress={() => router.navigate({ pathname: '/professional/project-details', params: { id } } as never)}><Text style={s.cardTitle} numberOfLines={2}>{project.title || 'Client Project Brief'}</Text><Text style={s.details}>View Details →</Text></Pressable>
                <Text style={s.place} numberOfLines={1}>{placeOf(project) || 'Location on unlock'}</Text>
                {!!prefs && (() => {
                  const criteria = preferenceCriteria(project, prefs);
                  if (!criteria.length) return null;
                  return (
                    <View style={s.criteria}>
                      {criteria.every(item => item.ok) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Icon name="zap" size={11} color={c.greenText} /><Text style={[s.matchBadge, { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 }]}>KAI match</Text></View>}
                      {criteria.map(item => <View key={item.label} style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }, item.ok ? { backgroundColor: c.greenSoft } : { backgroundColor: '#f8eded' }]}><Icon name={item.ok ? 'check' : 'x'} size={11} color={item.ok ? c.greenText : c.red} strokeWidth={2.4} /><Text style={[s.crit, { paddingHorizontal: 0, paddingVertical: 0 }, item.ok ? s.critOk : s.critNo, { backgroundColor: 'transparent' }]}>{item.label}</Text></View>)}
                    </View>
                  );
                })()}
                <View style={s.facts}>
                  {[['BUDGET', project.budgetRange || 'Flexible'], ['TYPE', project.propertyType || '—'], ['TIMELINE', project.timeline || 'Flexible']].map(([label, value]) => (
                    <View key={label} style={s.fact}><Text style={s.factLabel}>{label}</Text><Text style={s.factValue} numberOfLines={1}>{value}</Text></View>
                  ))}
                </View>
                {hasProposal ? (
                  <View style={s.sent}><Text style={s.sentText}>Proposal sent</Text></View>
                ) : isUnlocked ? (
                  <Pressable style={s.primary} onPress={() => setProposalTarget({ projectId: id, projectTitle: project.title, location: placeOf(project), budget: project.budgetRange, timeline: project.timeline })}>
                    <Text style={s.primaryText}>Submit Proposal</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.primary} onPress={() => setUnlockTarget(asLead(project))}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="lock" size={15} color="#fff" /><Text style={s.primaryText}>Unlock Contact · {credits && credits >= 1 ? '1 credit' : 'pay once'}</Text></View>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <UnlockSheet
        project={unlockTarget}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={({ projectId, leadCredits }) => {
          setUnlocked(previous => new Set(previous).add(projectId));
          if (typeof leadCredits === 'number') setCredits(leadCredits);
        }}
        onSubmitProposal={project => {
          setUnlockTarget(null);
          setProposalTarget({ projectId: project.id, projectTitle: project.title, location: project.location, budget: project.budgetRange, timeline: project.timeline });
        }}
      />
      {wizardOpen && designerId !== '' && (
        <ProjectPreferencesWizard
          visible
          designerId={designerId}
          initial={prefs || preferencesFromProfile(studio)}
          profile={studio}
          projects={open}
          popularCities={popularCities}
          save={body => partnerApi.updateStudioProfile(body).then(() => { patchProfile(body as never); })}
          onDone={next => { setPrefs(next); setRecommendedOnly(true); setWizardOpen(false); }}
          onSkip={() => setWizardOpen(false)}
        />
      )}
      <ProposalSheet
        context={proposalTarget}
        onClose={() => setProposalTarget(null)}
        onSubmitted={() => { if (proposalTarget) setSubmitted(previous => new Set(previous).add(proposalTarget.projectId)); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  search: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14.5 },
  chips: { gap: 8, paddingVertical: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  chipOn: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, marginBottom: 14, overflow: 'hidden' },
  image: { width: '100%', height: 160, backgroundColor: '#eef1ef' },
  body: { padding: 14, gap: 8 },
  details: { color: c.green, fontSize: 12, fontWeight: '800', marginTop: 3 },
  cardTitle: { color: c.ink, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  place: { color: c.body, fontSize: 12.5 },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, backgroundColor: '#f1f5f3', borderRadius: 11, padding: 9 },
  factLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  factValue: { color: c.ink, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  primary: { height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  match: { backgroundColor: '#f2f0ea', borderRadius: 16, padding: 14, gap: 8, marginBottom: 12 },
  matchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  matchTitle: { flex: 1, color: '#456557', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  matchEdit: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  matchEditText: { color: c.greenText, fontSize: 12.5, fontWeight: '800' },
  matchPlace: { color: c.ink, fontSize: 13.5, fontWeight: '700' },
  matchChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  matchChip: { backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, color: c.ink, fontSize: 11.5, fontWeight: '600', overflow: 'hidden' },
  matchCopy: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  matchCredits: { backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, color: c.greenText, fontSize: 12.5, fontWeight: '700', overflow: 'hidden' },
  tabs: { flexDirection: 'row', backgroundColor: '#ece9e2', borderRadius: 13, padding: 4, marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  tabOn: { backgroundColor: '#fff' },
  tabText: { color: c.muted, fontSize: 13, fontWeight: '800' },
  criteria: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  matchBadge: { backgroundColor: c.mint, color: c.greenText, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  crit: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  critOk: { backgroundColor: c.greenSoft, color: c.greenText },
  critNo: { backgroundColor: '#f4eeee', color: c.red },
  sent: { height: 48, borderRadius: 13, backgroundColor: c.amberSoft, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  sentText: { color: c.amber, fontSize: 14, fontWeight: '800' },
});
