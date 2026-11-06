import { ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../AppText';
import type { ScrollViewInstance, TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STAGES, TOTAL_STAGES } from '../../lib/professionalOnboarding';

export const c = {
  bg: '#f6f8f7',
  card: '#ffffff',
  ink: '#10231c',
  body: '#4d5f57',
  muted: '#7b8a83',
  line: '#e3e9e6',
  green: '#0b3b2d',
  greenSoft: '#e3f2ea',
  greenText: '#17684b',
  mint: '#d9f0e4',
  amber: '#b7791f',
  amberSoft: '#fdf3dc',
  red: '#b3392f',
  redSoft: '#fdecea',
  track: '#d9e0dd',
};

type ShellProps = {
  stage: number;
  title: string;
  subtitle: string;
  initial: string;
  onBack: () => void;
  onJump: (stage: number) => void;
  children: ReactNode;
  error?: string;
  hint?: string;
  backLabel?: string;
  onStageBack?: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  busy?: boolean;
  scrollRef?: React.Ref<ScrollViewInstance>;
};

export function OnboardingShell({ scrollRef, ...props }: ShellProps) {
  const meta = STAGES[props.stage - 1];
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={props.onBack} hitSlop={10} accessibilityLabel="Go back" style={s.headerBack}>
          <Text style={s.headerBackText}>←</Text>
        </Pressable>
        <View style={s.headerBrand}>
          <Image source={require('../../../assets/kraftnex-logo-transparent.png')} style={s.logo} resizeMode="contain" />
          <View style={s.studioPill}><Text style={s.studioPillText}>STUDIO PRO</Text></View>
        </View>
        <View style={s.avatar}><Text style={s.avatarText}>{props.initial}</Text></View>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.progressRow}>
            <View style={s.stagePill}><Text style={s.stagePillText}>STAGE {props.stage} OF {TOTAL_STAGES}</Text></View>
            <Text style={s.stageTag}>{meta.tag}</Text>
          </View>
          <View style={s.segments}>
            {STAGES.map(item => {
              const done = item.num < props.stage;
              const current = item.num === props.stage;
              return (
                <Pressable
                  key={item.num}
                  disabled={!done}
                  onPress={() => props.onJump(item.num)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  accessibilityLabel={`Stage ${item.num}: ${item.title}`}
                  style={[s.segment, done && s.segmentDone, current && s.segmentCurrent]}
                />
              );
            })}
          </View>

          <Text style={s.title}>{props.title}</Text>
          <Text style={s.subtitle}>{props.subtitle}</Text>

          {props.children}
        </ScrollView>

        <View style={s.footer}>
          {!!props.error && <Text style={s.footerError}>{props.error}</Text>}
          {!!props.hint && !props.error && <Text style={s.footerHint}>{props.hint}</Text>}
          <View style={s.footerRow}>
            {props.onStageBack && (
              <Pressable style={s.backButton} onPress={props.onStageBack} disabled={props.busy}>
                <Text style={s.backButtonText}>←  {props.backLabel || 'Back'}</Text>
              </Pressable>
            )}
            <Pressable
              style={[s.nextButton, (props.nextDisabled || props.busy) && s.nextDisabled]}
              onPress={props.onNext}
              disabled={props.nextDisabled || props.busy}
            >
              {props.busy ? <ActivityIndicator color="#fff" /> : <Text style={s.nextButtonText}>{props.nextLabel}  →</Text>}
            </Pressable>
          </View>
          <Text style={s.footerNote}>Your progress is saved each time you continue  •  Step {props.stage} of {TOTAL_STAGES}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.sectionLabelRow}>
      <Text style={s.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

export function Question({ index, children, note }: { index?: string; children: ReactNode; note?: string }) {
  return (
    <View style={s.questionBlock}>
      <Text style={s.question}>{index ? `${index}  ` : ''}{children}</Text>
      {!!note && <Text style={s.questionNote}>{note}</Text>}
    </View>
  );
}

export function Card({ children, tinted, style }: { children: ReactNode; tinted?: boolean; style?: object }) {
  return <View style={[s.card, tinted && s.cardTint, style]}>{children}</View>;
}

// Full-width selectable card with the radio/check mark on the right, as in the mockup.
export function ChoiceCard({ selected, onPress, title, subtitle, body, glyph, multi, children, badge }: {
  selected: boolean;
  onPress: () => void;
  title: string;
  subtitle?: string;
  body?: string;
  glyph?: string;
  multi?: boolean;
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ selected }} style={[s.choice, selected && s.choiceOn]}>
      <View style={s.choiceTop}>
        {!!glyph && <View style={[s.choiceGlyph, selected && s.choiceGlyphOn]}><Text style={[s.choiceGlyphText, selected && { color: '#fff' }]}>{glyph}</Text></View>}
        <View style={s.flex}>
          <View style={s.choiceTitleRow}>
            <Text style={s.choiceTitle}>{title}</Text>
            {!!badge && <View style={s.choiceBadge}><Text style={s.choiceBadgeText}>{badge}</Text></View>}
          </View>
          {!!subtitle && <Text style={s.choiceSubtitle}>{subtitle}</Text>}
          {!!body && <Text style={s.choiceBody}>{body}</Text>}
        </View>
        <Mark selected={selected} square={multi} />
      </View>
      {children}
    </Pressable>
  );
}

export function Mark({ selected, square }: { selected: boolean; square?: boolean }) {
  return (
    <View style={[s.mark, square && s.markSquare, selected && s.markOn]}>
      {selected && (square ? <Text style={s.markTick}>✓</Text> : <View style={s.markDot} />)}
    </View>
  );
}

// Compact option tile used in two-column grids.
export function OptionTile({ label, selected, onPress, multi = true }: { label: string; selected: boolean; onPress: () => void; multi?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ selected }} style={[s.tile, selected && s.tileOn]}>
      <Text style={[s.tileText, selected && s.tileTextOn]} numberOfLines={3}>{label}</Text>
      <Mark selected={selected} square={multi} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, removable }: { label: string; selected: boolean; onPress: () => void; removable?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[s.chip, selected && s.chipOn]}>
      <Text style={[s.chipText, selected && s.chipTextOn]}>{selected ? (removable ? `${label}  ×` : `✓  ${label}`) : `+  ${label}`}</Text>
    </Pressable>
  );
}

export function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={s.segmented}>
      {options.map(option => (
        <Pressable key={option} onPress={() => onChange(option)} style={[s.segmentedItem, value === option && s.segmentedOn]}>
          <Text style={[s.segmentedText, value === option && s.segmentedTextOn]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function YesNo({ value, onChange, yes = 'Yes', no = 'No' }: { value: boolean | undefined; onChange: (value: boolean) => void; yes?: string; no?: string }) {
  return (
    <View style={s.yesNo}>
      <Pressable onPress={() => onChange(true)} style={[s.yesNoItem, value === true && s.yesNoOn]}><Text style={[s.yesNoText, value === true && s.yesNoTextOn]}>{yes}</Text></Pressable>
      <Pressable onPress={() => onChange(false)} style={[s.yesNoItem, value === false && s.yesNoOn]}><Text style={[s.yesNoText, value === false && s.yesNoTextOn]}>{no}</Text></Pressable>
    </View>
  );
}

export function Stepper({ value, onChange, label, hint }: { value: number; onChange: (next: number) => void; label: string; hint?: string }) {
  return (
    <View style={s.stepperRow}>
      <View style={s.flex}>
        <Text style={s.stepperLabel}>{label}</Text>
        {!!hint && <Text style={s.stepperHint}>{hint}</Text>}
      </View>
      <View style={s.stepper}>
        <Pressable onPress={() => onChange(Math.max(0, value - 1))} style={s.stepperBtn} accessibilityLabel={`Decrease ${label}`}><Text style={s.stepperBtnText}>−</Text></Pressable>
        <Text style={s.stepperValue}>{value}</Text>
        <Pressable onPress={() => onChange(value + 1)} style={s.stepperBtn} accessibilityLabel={`Increase ${label}`}><Text style={s.stepperBtnText}>+</Text></Pressable>
      </View>
    </View>
  );
}

export function Field({ label, note, ...input }: { label?: string; note?: string } & TextInputProps) {
  return (
    <View style={s.fieldBlock}>
      {!!label && <Text style={s.fieldLabel}>{label}</Text>}
      <TextInput placeholderTextColor="#98a59f" {...input} style={[s.input, input.style]} />
      {!!note && <Text style={s.fieldNote}>{note}</Text>}
    </View>
  );
}

export function KaiCard({ title, message, sub }: { title?: string; message: string; sub?: string }) {
  return (
    <View style={s.kai}>
      <View style={s.kaiIcon}><Text style={s.kaiIconText}>✦</Text></View>
      <View style={s.flex}>
        <Text style={s.kaiTitle}>{title || 'KAI ASSISTANT'}</Text>
        <Text style={s.kaiMessage}>{message}</Text>
        {!!sub && <Text style={s.kaiSub}>{sub}</Text>}
      </View>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={s.errorText}>{children}</Text>;
}

export function Pill({ label, tone = 'green' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'grey' }) {
  const palette = { green: [c.mint, c.greenText], amber: [c.amberSoft, c.amber], red: [c.redSoft, c.red], grey: ['#eef1ef', c.body] }[tone];
  return <View style={[s.pill, { backgroundColor: palette[0] }]}><Text style={[s.pillText, { color: palette[1] }]}>{label}</Text></View>;
}

export function Row({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>;
}

export function Grid2({ children }: { children: ReactNode }) {
  return <View style={s.grid2}>{children}</View>;
}

export const shared = StyleSheet.create({
  gap: { gap: 10 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  header: { height: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  headerBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerBackText: { fontSize: 22, color: c.ink },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logo: { width: 92, height: 27 },
  studioPill: { backgroundColor: c.amberSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  studioPillText: { color: c.amber, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
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
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionLabel: { color: c.ink, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  questionBlock: { marginTop: 24, marginBottom: 12 },
  question: { color: c.ink, fontSize: 17, fontWeight: '800', lineHeight: 23 },
  questionNote: { color: c.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  card: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  cardTint: { backgroundColor: c.greenSoft, borderColor: '#bfe0cf' },
  choice: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1.5, borderColor: c.line, padding: 14, marginBottom: 10 },
  choiceOn: { backgroundColor: c.greenSoft, borderColor: c.green },
  choiceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  choiceGlyph: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  choiceGlyphOn: { backgroundColor: c.green },
  choiceGlyphText: { fontSize: 18, color: c.green },
  choiceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  choiceTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  choiceBadge: { backgroundColor: '#e3e8e5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  choiceBadgeText: { color: c.body, fontSize: 10, fontWeight: '700' },
  choiceSubtitle: { color: c.muted, fontSize: 12, marginTop: 1 },
  choiceBody: { color: c.body, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c3cec8', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  markSquare: { borderRadius: 7 },
  markOn: { borderColor: c.green, backgroundColor: c.green },
  markDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  markTick: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: -1 },
  tile: { width: '48.5%', minHeight: 62, borderRadius: 14, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileOn: { backgroundColor: c.greenSoft, borderColor: c.green },
  tileText: { flex: 1, color: c.ink, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  tileTextOn: { color: c.green },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  chip: { borderRadius: 999, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 9 },
  chipOn: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.body, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  segmented: { flexDirection: 'row', backgroundColor: '#eaefec', borderRadius: 12, padding: 3 },
  segmentedItem: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentedOn: { backgroundColor: c.green },
  segmentedText: { color: c.body, fontSize: 13, fontWeight: '700' },
  segmentedTextOn: { color: '#fff' },
  yesNo: { flexDirection: 'row', gap: 6 },
  yesNoItem: { minWidth: 56, height: 36, paddingHorizontal: 14, borderRadius: 9, backgroundColor: '#eaefec', alignItems: 'center', justifyContent: 'center' },
  yesNoOn: { backgroundColor: c.green },
  yesNoText: { color: c.body, fontSize: 13, fontWeight: '700' },
  yesNoTextOn: { color: '#fff' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  stepperLabel: { color: c.ink, fontSize: 14, fontWeight: '700' },
  stepperHint: { color: c.muted, fontSize: 11, marginTop: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef3f0', borderRadius: 12 },
  stepperBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: c.green, fontSize: 22, fontWeight: '600' },
  stepperValue: { minWidth: 28, textAlign: 'center', color: c.ink, fontSize: 16, fontWeight: '800' },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 15 },
  fieldNote: { color: c.muted, fontSize: 11, marginTop: 5 },
  kai: { flexDirection: 'row', gap: 12, backgroundColor: '#eaf3ee', borderRadius: 16, padding: 14, marginTop: 18, borderWidth: 1, borderColor: '#cfe5d9' },
  kaiIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  kaiIconText: { color: '#fff', fontSize: 15 },
  kaiTitle: { color: c.amber, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  kaiMessage: { color: c.ink, fontSize: 13.5, fontWeight: '600', lineHeight: 19, marginTop: 3 },
  kaiSub: { color: c.body, fontSize: 12, lineHeight: 17, marginTop: 4 },
  errorText: { color: c.red, fontSize: 12.5, fontWeight: '600', marginTop: 8, lineHeight: 17 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 10.5, fontWeight: '800' },
});
