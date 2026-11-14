import { ReactNode, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';

// Form / chrome controls shared by every realtor screen: pill buttons, bottom sheet, dropdown select,
// the intro card and the credits pill from the website's "My properties" page.

type Variant = 'primary' | 'soft' | 'danger' | 'ghost';

export function PillButton({ title, icon, onPress, disabled = false, loading = false, variant = 'primary', compact = false, grow = false }: {
  title: string; icon?: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: Variant; compact?: boolean; grow?: boolean;
}) {
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? palette.red : palette.green;
  const bg = variant === 'primary' ? '#0d4a38' : variant === 'soft' ? '#eef3f1' : variant === 'danger' ? '#fff' : 'transparent';
  const border = variant === 'danger' ? '#f3c9c4' : variant === 'ghost' ? palette.line : 'transparent';
  return <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }}
    style={[s.pill, compact && s.pillCompact, grow && { flex: 1 }, { backgroundColor: bg, borderColor: border }, (disabled || loading) && { opacity: 0.5 }]}>
    {loading ? <ActivityIndicator size="small" color={fg} /> : <>
      {icon ? <Icon name={icon} size={compact ? 15 : 18} color={fg} /> : null}
      <Text style={[s.pillText, compact && { fontSize: 13 }, { color: fg }]} numberOfLines={1}>{title}</Text>
    </>}
  </Pressable>;
}

export function IconButton({ icon, onPress, label, tone = 'muted', disabled = false }: { icon: string; onPress: () => void; label: string; tone?: 'muted' | 'danger'; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[s.iconBtn, disabled && { opacity: 0.4 }]}>
    <Icon name={icon} size={20} color={tone === 'danger' ? '#c0605a' : '#4d5f57'} />
  </Pressable>;
}

/** Modal sheet that slides up from the bottom with a grab handle, title and close button. */
export function BottomSheet({ visible, title, onClose, children, tall = false }: { visible: boolean; title?: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetRoot}>
      <Pressable style={s.sheetBackdrop} onPress={onClose} />
      <View style={[s.sheet, tall && { height: '92%' }]}>
        <View style={s.handle} />
        <View style={s.sheetHead}><Text style={s.sheetTitle} numberOfLines={1}>{title || ''}</Text><Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Icon name="x" size={24} color="#4d5f57" /></Pressable></View>
        <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export type Option = { value: string; label: string };
export const toOptions = (values: string[], labels?: Record<string, string>): Option[] => values.map(value => ({ value, label: labels?.[value] ?? humanize(value) }));
export function humanize(value: string) { const text = value.replaceAll('_', ' ').trim(); return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''; }

/** Dropdown that opens an option list in a bottom sheet (website uses native <select>). */
export function SelectField({ label, value, options, onChange, placeholder = 'Select', required = false }: { label?: string; value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  return <View style={s.field}>
    {label ? <Text style={s.label}>{label}{required ? <Text style={{ color: palette.red }}> *</Text> : null}</Text> : null}
    <Pressable onPress={() => setOpen(true)} style={s.select} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.selectText, !current && { color: palette.muted }]} numberOfLines={1}>{current?.label || placeholder}</Text>
      <Icon name="chevronDown" size={20} color="#33463f" />
    </Pressable>
    <BottomSheet visible={open} title={label || placeholder} onClose={() => setOpen(false)}>
      {options.map(option => {
        const on = option.value === value;
        return <Pressable key={option.value || 'none'} onPress={() => { onChange(option.value); setOpen(false); }} style={[s.option, on && s.optionOn]}>
          <Text style={[s.optionText, on && { color: palette.green, fontWeight: '800' }]}>{option.label}</Text>
          {on ? <Icon name="check" size={20} color={palette.green} /> : null}
        </Pressable>;
      })}
    </BottomSheet>
  </View>;
}

/** Large rounded white card: tinted chip, big title, description and a primary action ("Post New Property"). */
export function IntroCard({ chip, chipIcon, title, description, actionLabel, actionIcon = 'plus', onAction, actionDisabled, note }: {
  chip: string; chipIcon: string; title: string; description: string; actionLabel?: string; actionIcon?: string; onAction?: () => void; actionDisabled?: boolean; note?: string;
}) {
  return <View style={s.intro}>
    <View style={s.chip}><Icon name={chipIcon} size={15} color={palette.greenText} /><Text style={s.chipText}>{chip.toUpperCase()}</Text></View>
    <Text style={s.introTitle}>{title}</Text>
    <Text style={s.introDesc}>{description}</Text>
    {note ? <Text style={s.introNote}>{note}</Text> : null}
    {actionLabel && onAction ? <View style={{ alignSelf: 'flex-start' }}><PillButton title={actionLabel} icon={actionIcon} onPress={onAction} disabled={actionDisabled} /></View> : null}
  </View>;
}

export function CreditsPill({ credits, onTopUp }: { credits: number | null | undefined; onTopUp: () => void }) {
  const has = credits != null && credits > 0;
  return <View style={s.creditsRow}>
    <View style={[s.creditsPill, !has && { backgroundColor: palette.amberSoft, borderColor: '#f0dcae' }]}>
      <View style={[s.dot, !has && { backgroundColor: palette.amber }]} />
      <Text style={[s.creditsText, !has && { color: palette.amber }]}>{credits == null ? 'Listing credits' : `${credits} Listing Credit${credits === 1 ? '' : 's'} Available`}</Text>
    </View>
    <Pressable onPress={onTopUp} hitSlop={8}><Text style={s.topUp}>+ Top up credits</Text></Pressable>
  </View>;
}

/** "Listings" title on the left, an action pill on the right — the website's section toolbar. */
export function SectionHeader({ title, actionLabel, actionIcon = 'plus', onAction, disabled }: { title: string; actionLabel?: string; actionIcon?: string; onAction?: () => void; disabled?: boolean }) {
  return <View style={s.sectionHeader}>
    <Text style={s.sectionHeaderTitle}>{title}</Text>
    {actionLabel && onAction ? <PillButton title={actionLabel} icon={actionIcon} onPress={onAction} disabled={disabled} /> : null}
  </View>;
}

const s = StyleSheet.create({
  pill: { minHeight: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pillCompact: { minHeight: 40, paddingHorizontal: 14 }, pillText: { fontSize: 15, fontWeight: '800' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' }, sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16,35,28,0.5)' },
  sheet: { maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#cfd8e3', marginTop: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  sheetTitle: { flex: 1, color: palette.ink, fontSize: 19, fontWeight: '800' }, sheetBody: { padding: 18, paddingBottom: 34, gap: 12 },
  field: { gap: 6 }, label: { color: '#33463f', fontSize: 14, fontWeight: '800' },
  select: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }, selectText: { flex: 1, color: palette.ink, fontSize: 16 },
  option: { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionOn: { backgroundColor: palette.greenSoft }, optionText: { color: palette.ink, fontSize: 16 },
  intro: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 26, padding: 20, gap: 10 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ecf8f2', borderWidth: 1, borderColor: '#bfe9d6', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: palette.greenText, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  introTitle: { color: palette.ink, fontSize: 28, fontWeight: '800' }, introDesc: { color: palette.body, fontSize: 15, lineHeight: 22 }, introNote: { color: palette.amber, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  creditsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  creditsPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecf8f2', borderWidth: 1, borderColor: '#bfe9d6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1fbf7a' }, creditsText: { color: palette.green, fontSize: 14, fontWeight: '800', flexShrink: 1 }, topUp: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }, sectionHeaderTitle: { color: palette.ink, fontSize: 20, fontWeight: '800', flexShrink: 1 },
});
