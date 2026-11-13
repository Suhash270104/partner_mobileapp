import { ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import { c } from '../professional/onboardingUi';

// Same look as the professional onboarding shell (progress segments, header, sticky footer), but
// for flows with any number of steps. Used by the realtor and marketplace-seller onboarding.
export type StepShellProps = {
  step: number; // 0-based
  steps: string[]; // short tag per step, e.g. ['PROFILE', 'CREDENTIALS']
  brand: string; // pill next to the logo, e.g. 'REALTY'
  initial: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  onBack: () => void;
  onJump?: (step: number) => void;
  error?: string;
  hint?: string;
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  busy?: boolean;
  onStepBack?: () => void;
  note?: string;
  hideFooter?: boolean;
  statusLabel?: string; // replaces "STEP x OF y" (e.g. 'APPLICATION STATUS')
};

export function StepShell(p: StepShellProps) {
  const total = p.steps.length;
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={p.onBack} hitSlop={10} accessibilityLabel="Go back" style={s.headerBack}><Text style={s.headerBackText}>←</Text></Pressable>
        <View style={s.headerBrand}>
          <Image source={require('../../../assets/kraftnex-logo-transparent.png')} style={s.logo} resizeMode="contain" />
          <View style={s.pill}><Text style={s.pillText}>{p.brand}</Text></View>
        </View>
        <View style={s.avatar}><Text style={s.avatarText}>{p.initial}</Text></View>
      </View>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.progressRow}>
            <View style={s.stagePill}><Text style={s.stagePillText}>{p.statusLabel || `STEP ${p.step + 1} OF ${total}`}</Text></View>
            <Text style={s.stageTag}>{p.steps[Math.min(p.step, total - 1)]}</Text>
          </View>
          <View style={s.segments}>
            {p.steps.map((tag, index) => {
              const done = p.statusLabel ? true : index < p.step;
              const current = !p.statusLabel && index === p.step;
              return <Pressable key={tag + index} disabled={!done || !p.onJump || !!p.statusLabel} onPress={() => p.onJump?.(index)} hitSlop={{ top: 8, bottom: 8 }} accessibilityLabel={`Step ${index + 1}: ${tag}`} style={[s.segment, done && s.segmentDone, current && s.segmentCurrent]} />;
            })}
          </View>
          <Text style={s.title}>{p.title}</Text>
          <Text style={s.subtitle}>{p.subtitle}</Text>
          {p.children}
        </ScrollView>
        {!p.hideFooter && <View style={s.footer}>
          {!!p.error && <Text style={s.footerError}>{p.error}</Text>}
          {!!p.hint && !p.error && <Text style={s.footerHint}>{p.hint}</Text>}
          <View style={s.footerRow}>
            {p.onStepBack && <Pressable style={s.backButton} onPress={p.onStepBack} disabled={p.busy}><Text style={s.backButtonText}>←  Back</Text></Pressable>}
            <Pressable style={[s.nextButton, (p.nextDisabled || p.busy) && s.nextDisabled]} onPress={p.onNext} disabled={p.nextDisabled || p.busy}>
              {p.busy ? <ActivityIndicator color="#fff" /> : <Text style={s.nextButtonText}>{p.nextLabel || 'Continue'}  →</Text>}
            </Pressable>
          </View>
          <Text style={s.footerNote}>{p.note || `Your progress is saved each time you continue  •  Step ${p.step + 1} of ${total}`}</Text>
        </View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  header: { height: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBackText: { fontSize: 22, color: c.ink },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 92, height: 27 },
  pill: { backgroundColor: c.amberSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  pillText: { color: c.amber, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 28 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stagePill: { backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  stagePillText: { color: c.greenText, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  stageTag: { color: c.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  segments: { flexDirection: 'row', gap: 4, marginTop: 12 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.track },
  segmentDone: { backgroundColor: '#2f8a68' },
  segmentCurrent: { backgroundColor: c.green },
  title: { color: c.ink, fontSize: 28, fontWeight: '800', marginTop: 20, letterSpacing: -0.4 },
  subtitle: { color: c.body, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  footer: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerError: { color: c.red, fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  footerHint: { color: c.amber, fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  footerNote: { color: c.muted, fontSize: 10, textAlign: 'center', marginTop: 8 },
  backButton: { height: 52, paddingHorizontal: 22, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: c.ink, fontSize: 14, fontWeight: '700' },
  nextButton: { flex: 1, height: 52, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  nextDisabled: { backgroundColor: '#a9b6b0' },
  nextButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
