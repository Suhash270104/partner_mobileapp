import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/AppText';
import type { ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { partnerApi, PartnerApiError } from '../../lib/partnerApi';
import {
  getInitialData,
  hydrateFromProfile,
  isProfileComplete,
  OnboardingData,
  stageProblems,
  TOTAL_STAGES,
} from '../../lib/professionalOnboarding';
import { c, OnboardingShell } from '../../components/professional/onboardingUi';
import { Stage1, Stage2, Stage3 } from '../../components/professional/Stages1to3';
import { Stage4, Stage5, Stage6 } from '../../components/professional/Stages4to6';
import { Stage7, Stage8, Stage9 } from '../../components/professional/Stages7to9';

const COPY: { title: string; subtitle: string; next: string }[] = [
  { title: "Let's Start With Your Professional Identity", subtitle: 'This helps KAI understand how you operate and match you with the right projects and clients.', next: 'Continue' },
  { title: "Let's Build Your Business DNA", subtitle: "Tell me about the kind of projects you love to work on. I'll understand your strengths and preferences to find the right matches for you.", next: 'Continue' },
  { title: 'Define Your Expertise in Detail', subtitle: 'Help me understand your strengths, the services you offer, and the kind of projects you specialize in.', next: 'Continue' },
  { title: "Let's Understand Your Work Better", subtitle: 'Share your projects and portfolio. KAI will analyze your work to understand your style, strengths and the type of projects you do best.', next: 'Analyze My Portfolio' },
  { title: 'Tell Me About Your Business Operations', subtitle: 'This helps me understand your team, capacity and how you operate, so I can match the right projects for you.', next: 'Continue' },
  { title: 'How Do You Work With Clients?', subtitle: 'Help me understand your process and working style so I can match clients who prefer the same.', next: 'Continue' },
  { title: "Let's Verify Your Business", subtitle: "Verification builds trust and helps clients feel confident working with you. Don't worry, this is quick and secure.", next: 'Continue' },
  { title: 'Your AI Professional Ranking', subtitle: "Based on your profile completeness, portfolio proof, and verification, here's your AI credibility score.", next: 'Continue' },
  { title: "You're All Set! Welcome to KraftNex", subtitle: 'Thank you for completing your professional onboarding! Your studio application and credentials are now under review by the KraftNex Admin team.', next: 'Submit for Review' },
];

type Phase = 'loading' | 'signedOut' | 'error' | 'ready';

export default function ProfessionalOnboardingScreen() {
  const params = useLocalSearchParams<{ edit?: string; new?: string }>();
  const forceEdit = params.edit === 'true' || params.new === 'true';
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [stage, setStage] = useState(1);
  const [data, setData] = useState<OnboardingData>(getInitialData());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const consentRecorded = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    setLoadError('');
    try {
      const session = await partnerApi.session();
      if (!session.user) {
        setPhase('signedOut');
        return;
      }
      try {
        const profile = await partnerApi.professionalProfile();
        setData(hydrateFromProfile(profile));
        // The wizard stores the next stage to resume at; a finished studio is shown as submitted.
        if (isProfileComplete(profile) && !forceEdit) {
          setSubmitted(true);
          setStage(TOTAL_STAGES);
        } else if (isProfileComplete(profile)) {
          // "Edit Profile DNA": walk the wizard again over the saved answers.
          setSubmitted(false);
          setStage(1);
        } else {
          setStage(Math.min(TOTAL_STAGES, Math.max(1, profile.onboardingStage || 1)));
        }
      } catch (error) {
        // No studio yet: this is a brand-new application, not an error.
        if (!(error instanceof PartnerApiError && error.status === 404)) throw error;
      }
      setPhase('ready');
    } catch (error) {
      if (error instanceof PartnerApiError && error.status === 401) {
        setPhase('signedOut');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'Could not load your studio onboarding.');
      setPhase('error');
    }
  }, [forceEdit]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const update = useCallback((fields: Partial<OnboardingData>) => {
    setSaveError('');
    setData(previous => ({ ...previous, ...fields }));
  }, []);

  function goTo(next: number) {
    setSaveError('');
    setStage(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function save(nextStage: number, isComplete: boolean) {
    setSaving(true);
    setSaveError('');
    try {
      // Renews an expired session first. This endpoint never rejects an expired sign-in: it would
      // quietly save the step as an anonymous draft instead of to this studio.
      await partnerApi.session().catch(() => undefined);
      await partnerApi.saveProfessionalOnboarding({
        stage: nextStage,
        businessName: data.businessName,
        companyName: data.businessName,
        data: data as unknown as Record<string, unknown>,
        isComplete,
      });
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? `Could not save your progress. ${error.message}` : 'Could not save your progress. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    if (stage === TOTAL_STAGES) {
      if (submitted) {
        router.replace('/professional/dashboard');
        return;
      }
      if (await save(TOTAL_STAGES, true)) {
        setSubmitted(true);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }
    const next = stage + 1;
    // The server decides whether the studio exists yet; only move on once the step is stored.
    if (!(await save(next, false))) return;
    // Stage 1 makes the Partner Terms / Privacy checkbox mandatory; the studio exists now.
    if (stage === 1 && data.acceptedPartnerTerms && !consentRecorded.current) {
      consentRecorded.current = true;
      void partnerApi.recordPartnerLegalConsent('studio_onboarding').catch(() => { consentRecorded.current = false; });
    }
    goTo(next);
  }

  if (phase !== 'ready') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          {phase === 'loading' && <><ActivityIndicator color={c.green} size="large" /><Text style={s.centerCopy}>Loading your studio onboarding…</Text></>}
          {phase === 'signedOut' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Studio Authentication Required</Text>
              <Text style={s.cardCopy}>Please log in with your Kraftnex account to access the professional studio onboarding wizard.</Text>
              <Pressable style={s.button} onPress={() => router.replace('/')}><Text style={s.buttonText}>Log In</Text></Pressable>
              <Text style={s.cardFoot}>Verified Architect & Designer Registration</Text>
            </View>
          )}
          {phase === 'error' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Couldn&apos;t load your onboarding</Text>
              <Text style={s.cardCopy}>{loadError}</Text>
              <Pressable style={s.button} onPress={() => void load()}><Text style={s.buttonText}>Try again</Text></Pressable>
              <Pressable onPress={leave}><Text style={s.link}>Go back</Text></Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const problems = submitted ? [] : stageProblems(stage, data);
  const copy = COPY[stage - 1];
  const stageProps = { data, update };

  return (
    <OnboardingShell
      stage={stage}
      title={copy.title}
      subtitle={copy.subtitle}
      initial={(data.businessName.trim()[0] || 'K').toUpperCase()}
      onBack={stage > 1 ? () => goTo(stage - 1) : leave}
      onJump={goTo}
      error={saveError}
      hint={problems.length ? `To continue: ${problems.join(', ')}.` : undefined}
      nextLabel={stage === TOTAL_STAGES && submitted ? 'Go to Dashboard' : copy.next}
      onNext={() => void onNext()}
      nextDisabled={problems.length > 0 || uploading}
      busy={saving}
      onStageBack={stage > 1 && !(stage === TOTAL_STAGES && submitted) ? () => goTo(stage - 1) : undefined}
      scrollRef={scrollRef}
    >
      {stage === 1 && <Stage1 {...stageProps} />}
      {stage === 2 && <Stage2 {...stageProps} />}
      {stage === 3 && <Stage3 {...stageProps} />}
      {stage === 4 && <Stage4 {...stageProps} onUploading={setUploading} />}
      {stage === 5 && <Stage5 {...stageProps} />}
      {stage === 6 && <Stage6 {...stageProps} />}
      {stage === 7 && <Stage7 {...stageProps} onUploading={setUploading} />}
      {stage === 8 && <Stage8 data={data} />}
      {stage === 9 && <Stage9 data={data} submitted={submitted} />}
    </OnboardingShell>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerCopy: { color: c.body, fontSize: 13 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 22, gap: 12, borderWidth: 1, borderColor: c.line },
  cardTitle: { color: c.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  cardCopy: { color: c.body, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  cardFoot: { color: c.muted, fontSize: 11.5, textAlign: 'center' },
  button: { height: 50, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  link: { color: c.green, fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
