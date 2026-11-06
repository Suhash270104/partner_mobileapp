import { useMemo, useRef, useState } from 'react';
import type { ScrollViewInstance } from 'react-native';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { c, Chip, ErrorText, KaiCard, Mark, OptionTile } from '../professional/onboardingUi';
import {
  AVAILABILITY_OPTIONS, DURATION_OPTIONS, MatchableProject, MIN_PROJECT_VALUES, NOTE_MAX, PROJECT_TYPE_OPTIONS, PROJECT_VALUE_TIERS,
  ProjectPreferences, PrefsProfile, projectMatchesPreferences, RADIUS_OPTIONS, savePreferences, SERVICE_OPTIONS,
} from '../../lib/projectPreferences';

const STEPS = ['Services', 'Budget', 'Location & Type', 'Availability'];

const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter(item => item !== value) : [...list, value]);

// Find Projects preferences for a studio: Services -> Budget -> Location & Type -> Availability.
// Saves to the studio profile (see lib/projectPreferences.ts for where each answer goes) and hands the
// preferences back so the project list can filter on them.
export function ProjectPreferencesWizard({ visible, designerId, initial, profile, projects, popularCities, save, onDone, onSkip }: {
  visible: boolean;
  designerId: string;
  initial: ProjectPreferences;
  profile: PrefsProfile;
  projects: MatchableProject[];
  popularCities: string[];
  save: (body: Record<string, unknown>) => Promise<unknown>;
  onDone: (prefs: ProjectPreferences) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<ProjectPreferences>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [cityInput, setCityInput] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  const set = <K extends keyof ProjectPreferences>(key: K, value: ProjectPreferences[K]) => setPrefs(previous => ({ ...previous, [key]: value }));
  const anywhere = prefs.radius === 'Anywhere';
  const cityChips = useMemo(() => Array.from(new Set([...prefs.cities, ...popularCities])).slice(0, 10), [prefs.cities, popularCities]);
  const tierLabels = PROJECT_VALUE_TIERS.filter(tier => prefs.budgetTiers.includes(tier.tier)).map(tier => tier.label);

  // Real counts from open client projects in the chosen cities.
  const typeDemand = useMemo(() => {
    const base = { ...prefs, budgetTiers: [], minProjectValue: '', projectTypes: [] as string[] };
    const inCities = projects.filter(project => projectMatchesPreferences(project, base));
    return PROJECT_TYPE_OPTIONS
      .map(option => ({ type: option.value, count: inCities.filter(project => projectMatchesPreferences(project, { ...base, projectTypes: [option.value] })).length }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
  }, [projects, prefs]);

  const errors: Record<number, string> = {
    0: prefs.services.length ? '' : 'Select at least one service.',
    1: prefs.budgetTiers.length ? '' : 'Select at least one project value.',
    2: !prefs.cities.length && !anywhere ? 'Add a city, or choose Anywhere.' : !prefs.projectTypes.length ? 'Select at least one project type.' : '',
    3: prefs.availability ? '' : 'Please choose your availability.',
  };

  function goTo(next: number) {
    setShowErrors(false);
    setSaveError('');
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function addCity() {
    const city = cityInput.trim();
    if (!city) return;
    setPrefs(previous => ({ ...previous, cities: previous.cities.some(item => item.toLowerCase() === city.toLowerCase()) ? previous.cities : [...previous.cities, city], radius: previous.radius === 'Anywhere' ? '' : previous.radius }));
    setCityInput('');
  }

  async function next() {
    if (errors[step]) { setShowErrors(true); return; }
    if (step < STEPS.length - 1) { goTo(step + 1); return; }
    setSaving(true);
    setSaveError('');
    try {
      await savePreferences(save, designerId, prefs, profile);
      onDone(prefs);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const error = showErrors ? errors[step] : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={step === 0 ? onSkip : () => goTo(step - 1)}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={step === 0 ? onSkip : () => goTo(step - 1)} hitSlop={10} accessibilityLabel="Back"><Text style={s.back}>←</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Find Projects</Text>
            <Text style={s.sub}>Set your preferences and let KAI find the best matches.</Text>
          </View>
        </View>
        <View style={s.steps}>
          {STEPS.map((name, index) => (
            <View key={name} style={{ flex: 1, gap: 4 }}>
              <View style={[s.bar, index <= step && s.barOn]} />
              <Text style={[s.stepName, index === step && { color: c.greenText }]} numberOfLines={1}>{name}</Text>
            </View>
          ))}
        </View>

        <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <Text style={s.q}>1. What services do you offer?</Text>
              <Text style={s.hint}>Select all that apply.</Text>
              <View style={s.grid}>
                {SERVICE_OPTIONS.map(service => <View key={service} style={s.half}><OptionTile label={service} selected={prefs.services.includes(service)} onPress={() => set('services', toggleIn(prefs.services, service))} /></View>)}
              </View>
              <KaiCard title="KAI INSIGHT" message="KAI uses your services to match you with client projects that need them." />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={s.q}>2. What project value do you prefer?</Text>
              <Text style={s.hint}>Select all that apply.</Text>
              {PROJECT_VALUE_TIERS.map(tier => {
                const on = prefs.budgetTiers.includes(tier.tier);
                return (
                  <Pressable key={tier.tier} style={[s.tier, on && s.tierOn]} onPress={() => set('budgetTiers', toggleIn(prefs.budgetTiers, tier.tier))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.tierName}>{tier.label} · {tier.range}</Text>
                      <Text style={s.hint}>{tier.sub}</Text>
                    </View>
                    <Mark selected={on} square />
                  </Pressable>
                );
              })}
              {tierLabels.length > 0 && <KaiCard title="KAI INSIGHT" message={`You'll be matched with client projects in the ${tierLabels.join(' and ')} range${tierLabels.length > 1 ? 's' : ''}.`} />}

              <Text style={[s.q, { marginTop: 8 }]}>Do you have a minimum project value in mind?</Text>
              <View style={s.wrap}>
                {MIN_PROJECT_VALUES.map(option => <Chip key={option.value || 'none'} label={option.label} selected={prefs.minProjectValue === option.value} onPress={() => set('minProjectValue', option.value)} />)}
              </View>
              <Text style={s.hint}>Optional.</Text>

              <Pressable style={s.switchRow} onPress={() => set('budgetTiers', toggleIn(prefs.budgetTiers, 'Regular'))} accessibilityRole="switch" accessibilityState={{ checked: prefs.budgetTiers.includes('Regular') }}>
                <Mark selected={prefs.budgetTiers.includes('Regular')} square />
                <Text style={[s.hint, { flex: 1, color: c.ink }]}>Yes, I&apos;m open to smaller projects too (up to ₹15 Lakhs)</Text>
              </Pressable>
              <Text style={s.hint}>Tip: keeping more than one budget range open can get you more project opportunities from clients.</Text>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.q}>3. Where do you want projects?</Text>
              <Text style={s.hint}>Select your preferred locations (you can choose multiple).</Text>
              <View style={s.addRow}>
                <TextInput style={s.input} value={cityInput} onChangeText={setCityInput} onSubmitEditing={addCity} placeholder="Type a city, e.g. Hyderabad" placeholderTextColor="#98a59f" returnKeyType="done" />
                <Pressable style={s.addBtn} onPress={addCity}><Text style={s.addText}>Add</Text></Pressable>
              </View>
              <View style={s.wrap}>
                {cityChips.map(city => (
                  <Chip key={city} label={city} selected={prefs.cities.includes(city)} onPress={() => setPrefs(previous => ({ ...previous, cities: toggleIn(previous.cities, city), radius: previous.radius === 'Anywhere' ? '' : previous.radius }))} />
                ))}
                <Chip label="Anywhere" selected={anywhere} onPress={() => setPrefs(previous => ({ ...previous, radius: previous.radius === 'Anywhere' ? '' : 'Anywhere', cities: previous.radius === 'Anywhere' ? previous.cities : [] }))} />
              </View>

              {!anywhere && (
                <>
                  <Text style={s.q}>Project Radius</Text>
                  <Text style={s.hint}>How far are you willing to travel?</Text>
                  <View style={s.wrap}>
                    {RADIUS_OPTIONS.filter(radius => radius !== 'Anywhere').map(radius => <Chip key={radius} label={radius} selected={prefs.radius === radius} onPress={() => set('radius', prefs.radius === radius ? '' : radius)} />)}
                  </View>
                </>
              )}

              <Text style={[s.q, { marginTop: 8 }]}>4. What type of projects are you interested in?</Text>
              <Text style={s.hint}>Select all that apply.</Text>
              <View style={s.grid}>
                {PROJECT_TYPE_OPTIONS.map(option => <View key={option.value} style={s.half}><OptionTile label={option.value} selected={prefs.projectTypes.includes(option.value)} onPress={() => set('projectTypes', toggleIn(prefs.projectTypes, option.value))} /></View>)}
              </View>
              <KaiCard
                title="KAI INSIGHT"
                message={typeDemand.length > 0
                  ? `${typeDemand.map(entry => `${entry.type} (${entry.count})`).join(' and ')} ${typeDemand.length > 1 ? 'have' : 'has'} the most open projects${prefs.cities.length && !anywhere ? ` in ${prefs.cities.slice(0, 2).join(' & ')}` : ''} right now.`
                  : 'Adding more cities or choosing Anywhere widens the projects you can be matched with.'}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={s.q}>5. When can you take a new project?</Text>
              <Text style={s.hint}>Let clients know your availability.</Text>
              <View style={s.grid}>
                {AVAILABILITY_OPTIONS.map(option => <View key={option} style={s.half}><OptionTile label={option} multi={false} selected={prefs.availability === option} onPress={() => set('availability', option)} /></View>)}
              </View>

              <Text style={[s.q, { marginTop: 8 }]}>Project Duration Preference (Optional)</Text>
              <Text style={s.hint}>Select the duration of projects you prefer.</Text>
              <View style={s.grid}>
                {DURATION_OPTIONS.map(option => (
                  <View key={option.value} style={s.half}>
                    <OptionTile label={option.sub ? `${option.value} (${option.sub})` : option.value} multi={false} selected={prefs.duration === option.value} onPress={() => set('duration', prefs.duration === option.value ? '' : option.value)} />
                  </View>
                ))}
              </View>

              <Text style={[s.q, { marginTop: 8 }]}>Additional Preferences (Optional)</Text>
              <TextInput
                style={[s.input, { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }]}
                value={prefs.note}
                onChangeText={value => set('note', value.slice(0, NOTE_MAX))}
                multiline
                maxLength={NOTE_MAX}
                placeholder="E.g. Preferred project size, specific requirements, areas of expertise, team size, etc."
                placeholderTextColor="#98a59f"
              />
              <Text style={[s.hint, { textAlign: 'right' }]}>{prefs.note.length}/{NOTE_MAX}</Text>

              <KaiCard title="KAI INSIGHT" message="Great, you're all set. We'll now show open projects that match your preferences." />

              <View style={s.summary}>
                <View style={s.summaryHead}>
                  <Text style={s.tierName}>Your Selections</Text>
                  <Pressable onPress={() => goTo(0)}><Text style={s.edit}>Edit</Text></Pressable>
                </View>
                {([
                  ['Services', prefs.services.slice(0, 2).join(', ') + (prefs.services.length > 2 ? ` +${prefs.services.length - 2}` : '')],
                  ['Budget', tierLabels.join(', ')],
                  ['Location', anywhere ? 'Anywhere' : `${prefs.cities.slice(0, 2).join(', ')}${prefs.cities.length > 2 ? ` +${prefs.cities.length - 2}` : ''}${prefs.radius ? ` (${prefs.radius})` : ''}`],
                  ['Availability', prefs.availability],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label} style={s.summaryRow}><Text style={s.hint}>{label}</Text><Text style={s.summaryValue} numberOfLines={2}>{value || '—'}</Text></View>
                ))}
              </View>
            </>
          )}

          {!!error && <ErrorText>{error}</ErrorText>}
          {!!saveError && <ErrorText>{saveError}</ErrorText>}
        </ScrollView>

        <View style={s.footer}>
          {step > 0 && <Pressable style={s.backBtn} onPress={() => goTo(step - 1)} disabled={saving}><Text style={s.backText}>Back</Text></Pressable>}
          <Pressable style={[s.nextBtn, saving && { opacity: 0.6 }]} onPress={() => void next()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.nextText}>{step < STEPS.length - 1 ? `Next: ${STEPS[step + 1]}  →` : 'Complete & Find Projects'}</Text>}
          </Pressable>
        </View>
        {step === 0 && <Pressable onPress={onSkip} style={s.skip}><Text style={s.skipText}>Skip for now — show all projects</Text></Pressable>}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#faf8f5' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  back: { color: c.green, fontSize: 26, fontWeight: '700' },
  title: { color: c.ink, fontSize: 24, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5, marginTop: 1 },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: '#dfe6e2' },
  barOn: { backgroundColor: c.green },
  stepName: { color: c.muted, fontSize: 10.5, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  q: { color: c.ink, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  hint: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  half: { width: '48.5%' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: c.line, padding: 14 },
  tierOn: { borderColor: c.green, backgroundColor: c.greenSoft },
  tierName: { color: c.ink, fontSize: 15, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14.5 },
  addBtn: { paddingHorizontal: 18, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  summary: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryValue: { color: c.ink, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  edit: { color: c.green, fontSize: 13, fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: '#faf8f5' },
  backBtn: { height: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: '#eef1ef', alignItems: 'center', justifyContent: 'center' },
  backText: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  nextBtn: { flex: 1, height: 52, borderRadius: 26, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  skip: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: c.muted, fontSize: 13, fontWeight: '700' },
});
