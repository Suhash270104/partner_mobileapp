import { ReactNode } from 'react';
import { Icon } from '../Icon';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../AppText';
import { PartnerBrand } from '../PartnerBrand';

export const palette = {
  bg: '#f6f8f7', card: '#fff', ink: '#10231c', body: '#4d5f57', muted: '#7b8a83', line: '#e3e9e6',
  green: '#0b3b2d', greenSoft: '#e3f2ea', greenText: '#17684b', amber: '#b7791f', amberSoft: '#fdf3dc',
  red: '#b3392f', redSoft: '#fdecea', blue: '#2a5ba8', blueSoft: '#e8f0fb', violet: '#5b3fa0', violetSoft: '#efeafa',
};

const TAB_GLYPHS: Record<string, string> = { overview: 'dashboard', dashboard: 'dashboard', properties: 'layers', listings: 'fileText', projects: 'briefcase', leads: 'users', more: 'settings', products: 'layers', orders: 'clipboard', settings: 'settings' };
const TAB_NAMES: Record<string, string> = { Overview: 'Home', Realty: 'More', Enquiries: 'Enquiries' };
const tabGlyph = (tab: { key: string }) => TAB_GLYPHS[tab.key] || 'dashboard';
const tabName = (tab: { label: string }) => TAB_NAMES[tab.label] || tab.label;

export function VerticalFrame({ title, subtitle, children, tabs, activeTab, onTab, onBack }: {
  title: string; subtitle?: string; children: ReactNode; tabs: { key: string; label: string; icon: string }[];
  activeTab: string; onTab: (key: string) => void; onBack?: () => void;
}) {
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.header}>
      {onBack ? <Pressable style={s.back} onPress={onBack}><Text style={s.backText}>‹</Text></Pressable> : <View style={s.brand}><PartnerBrand compact /></View>}
      <View style={s.headerTitle}><Text numberOfLines={1} style={s.headerName}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={s.headerSub}>{subtitle}</Text> : null}</View>
      <View style={s.avatar}><Text style={s.avatarText}>{title.trim().charAt(0).toUpperCase()}</Text></View>
    </View>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    {tabs.length ? <View style={s.tabs}>{tabs.map(tab => {
      const on = activeTab === tab.key;
      return <Pressable key={tab.key} onPress={() => onTab(tab.key)} style={s.tab} accessibilityRole="tab" accessibilityLabel={tabName(tab)} accessibilityState={{ selected: on }}>
        <View style={[s.tabPill, on && s.tabPillOn]}><Icon name={tabGlyph(tab)} size={21} color={on ? palette.green : '#8a9a92'} /></View>
        <Text numberOfLines={1} style={[s.tabLabel, on && s.tabLabelOn]}>{tabName(tab)}</Text>
      </Pressable>;
    })}</View> : null}
  </SafeAreaView>;
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={s.heading}>
    {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
    <View style={s.headingRow}><View style={s.headingText}><Text style={s.pageTitle}>{title}</Text>{subtitle ? <Text style={s.pageSub}>{subtitle}</Text> : null}</View>{action}</View>
  </View>;
}

export function Panel({ children, tint = false, style }: { children: ReactNode; tint?: boolean; style?: object }) {
  return <View style={[s.panel, tint && s.panelTint, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{action}</View>;
}

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, helper }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad'; secureTextEntry?: boolean; helper?: string;
}) {
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor={palette.muted}
    multiline={multiline} keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
    style={[s.input, multiline && s.multiline]} />{helper ? <Text style={s.helper}>{helper}</Text> : null}</View>;
}

export function SelectChips({ label, values, selected, onChange, multi = false }: { label: string; values: string[]; selected: string | string[]; onChange: (value: string | string[]) => void; multi?: boolean }) {
  const current = Array.isArray(selected) ? selected : [selected];
  return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><View style={s.chips}>{values.map(value => {
    const active = current.includes(value);
    return <Pressable key={value} onPress={() => onChange(multi ? (active ? current.filter(item => item !== value) : [...current, value]) : value)} style={[s.chip, active && s.chipOn]}>
      <Text style={[s.chipText, active && s.chipTextOn]}>{value.replaceAll('_', ' ')}</Text>
    </Pressable>;
  })}</View></View>;
}

export function BooleanField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={s.booleanRow}><Text style={s.fieldLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: '#cfd8d4', true: '#91c6ad' }} thumbColor={value ? palette.green : '#fff'} /></View>;
}

export function PrimaryButton({ title, onPress, loading = false, disabled = false }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={loading || disabled} style={[s.primary, (loading || disabled) && s.disabled]}>
    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{title}</Text>}
  </Pressable>;
}

export function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={s.secondary}><Text style={s.secondaryText}>{title}</Text></Pressable>;
}

export function StatusPill({ label, tone = 'green' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'violet' }) {
  return <View style={[s.pill, tone === 'amber' && s.pillAmber, tone === 'red' && s.pillRed, tone === 'blue' && s.pillBlue, tone === 'violet' && s.pillViolet]}><Text style={[s.pillText, tone === 'amber' && s.pillTextAmber, tone === 'red' && s.pillTextRed, tone === 'blue' && s.pillTextBlue, tone === 'violet' && s.pillTextViolet]}>{label.replaceAll('_', ' ')}</Text></View>;
}

export function StatePanel({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return <Panel><Text style={s.stateTitle}>{title}</Text><Text style={s.stateText}>{message}</Text>{retry ? <SecondaryButton title="Try again" onPress={retry} /> : null}</Panel>;
}

export function DataRow({ title, detail, status, onPress, trailing }: { title: string; detail?: string; status?: string; onPress?: () => void; trailing?: ReactNode }) {
  return <Pressable disabled={!onPress} onPress={onPress} style={s.row}>
    <View style={s.rowIcon}><Text style={s.rowIconText}>{title.trim().charAt(0).toUpperCase()}</Text></View>
    <View style={s.rowBody}><Text style={s.rowTitle} numberOfLines={2}>{title}</Text>{detail ? <Text style={s.rowDetail} numberOfLines={2}>{detail}</Text> : null}</View>
    {status ? <StatusPill label={status} tone={/reject|cancel|suspend|declin/i.test(status) ? 'red' : /pending|review|request/i.test(status) ? 'amber' : 'green'} /> : trailing}
  </Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: { minHeight: 58, paddingHorizontal: 12, gap: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  brand: { minWidth: 92 }, back: { width: 36, alignItems: 'center' }, backText: { color: palette.ink, fontSize: 34, lineHeight: 36 },
  headerTitle: { flex: 1 }, headerName: { color: palette.ink, fontSize: 14, fontWeight: '800' }, headerSub: { color: palette.muted, fontSize: 10, marginTop: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  scroll: { flex: 1 }, content: { padding: 16, paddingBottom: 26, gap: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 6, paddingBottom: 6 },
  tabPill: { width: 50, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, tabPillOn: { backgroundColor: palette.greenSoft },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingHorizontal: 2, paddingVertical: 4 }, tabIcon: { fontSize: 17, color: '#9aa8a1' }, tabIconOn: { color: palette.green }, tabLabel: { color: '#8a9a92', fontSize: 11, fontWeight: '700' }, tabLabelOn: { color: palette.green },
  heading: { gap: 4, marginBottom: 2 }, eyebrow: { color: palette.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headingText: { flex: 1 }, pageTitle: { color: palette.ink, fontSize: 25, lineHeight: 31, fontWeight: '800' }, pageSub: { color: palette.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
  panel: { backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 9 }, panelTint: { backgroundColor: palette.greenSoft, borderColor: '#bfe0cf' },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }, sectionTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  field: { gap: 6, marginTop: 8 }, fieldLabel: { color: '#33463f', fontSize: 11, fontWeight: '800' }, input: { minHeight: 46, borderRadius: 12, borderColor: palette.line, borderWidth: 1.5, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 10, color: palette.ink, fontSize: 14 }, multiline: { minHeight: 96, textAlignVertical: 'top' }, helper: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: '#fff' }, chipOn: { backgroundColor: palette.green, borderColor: palette.green }, chipText: { color: palette.body, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }, chipTextOn: { color: '#fff' },
  booleanRow: { minHeight: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  primary: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: palette.green }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' }, disabled: { opacity: 0.55 }, secondary: { minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#eef3f0' }, secondaryText: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  pill: { borderRadius: 8, backgroundColor: palette.greenSoft, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' }, pillAmber: { backgroundColor: palette.amberSoft }, pillRed: { backgroundColor: palette.redSoft }, pillBlue: { backgroundColor: palette.blueSoft }, pillViolet: { backgroundColor: palette.violetSoft }, pillText: { color: palette.greenText, fontSize: 10, fontWeight: '800', textTransform: 'capitalize' }, pillTextAmber: { color: palette.amber }, pillTextRed: { color: palette.red }, pillTextBlue: { color: palette.blue }, pillTextViolet: { color: palette.violet },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: palette.greenSoft, alignItems: 'center', justifyContent: 'center' }, rowIconText: { color: palette.green, fontWeight: '800' }, rowBody: { flex: 1 }, rowTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' }, rowDetail: { color: palette.muted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  stateTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' }, stateText: { color: palette.body, fontSize: 12, lineHeight: 18 },
});
