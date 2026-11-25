import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../AppText';
import { Icon } from '../Icon';

// Shared look for the project-management screens, taken from docs/project-management/index.html:
// cream canvas, deep-green header, terracotta primary action, soft pills and thin progress bars.
export const pm = {
  green: '#0F382C', green2: '#14483a', cream: '#F6F4EF', line: '#E7E2D6', ink: '#14231D', muted: '#5B6B63', soft: '#8A9189',
  terra: '#C2703D', gold: '#A6822C', ok: '#4C7A5E', okBg: '#EAF1EC', warn: '#B45309', warnBg: '#FFFBEB', bad: '#C0392B', badBg: '#FDECEA',
  blue: '#2F5D9E', blueBg: '#E8EFF8', grayBg: '#EFEDE6', onGreen: '#BFD6C9',
};

export type Tone = 'ok' | 'warn' | 'bad' | 'blue' | 'gray';
const toneColors: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: pm.okBg, fg: pm.ok }, warn: { bg: pm.warnBg, fg: pm.warn }, bad: { bg: pm.badBg, fg: pm.bad }, blue: { bg: pm.blueBg, fg: pm.blue }, gray: { bg: pm.grayBg, fg: pm.muted },
};

// ---------- formatting ----------
/** Integer paise -> "₹5,19,200" (Indian digit grouping, no decimals unless there are paise). */
export function inr(paise?: number | null): string {
  const value = (paise ?? 0) / 100;
  const negative = value < 0;
  const [whole, frac] = Math.abs(value).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '-' : ''}₹${grouped}${frac === '00' ? '' : `.${frac}`}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** ISO date or datetime -> "24 Nov" (adds the year when it is not this year). Date-only values are read in UTC so the day never shifts. */
export function shortDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year === new Date().getUTCFullYear() ? '' : ` ${year}`}`;
}
/** "24-11-2026" (DateField) -> "2026-11-24" for the API. */
export function isoFromField(value: string): string | undefined {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim());
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}
export const todayField = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; };
export const LONG_AGO = new Date(2020, 0, 1);

export const HEALTH: Record<string, { label: string; tone: Tone }> = {
  on_track: { label: 'On track', tone: 'ok' }, at_risk: { label: 'At risk', tone: 'warn' }, delayed: { label: 'Delayed', tone: 'bad' },
};
export const STAGES = ['planning', 'designing', 'execution', 'installation', 'handover', 'closed'] as const;
export const stageLabel = (stage?: string) => (stage ? stage.replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase()) : '');

/** Server errors carry a readable message; anything else gets the fallback. */
export const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

// ---------- data loading ----------
export function usePmLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const loader = useRef(load);
  useEffect(() => { loader.current = load; });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(async (manual: boolean) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const result = await loader.current();
      if (alive.current) setData(result);
    } catch (e) {
      if (alive.current) setError(errorText(e, 'Could not load this. Pull down to try again.'));
    } finally {
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  // Reloads when the inputs change (e.g. another project). Deferred one tick so it runs after the latest loader is stored.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = setTimeout(() => { setLoading(true); void run(false); }, 0); return () => clearTimeout(timer); }, deps);
  return { data, error, loading, refreshing, reload: () => run(true), silentReload: () => run(false) };
}

// ---------- layout ----------
/** Goes back, or to `fallback` when there is nothing to go back to (e.g. opened from a notification). */
export function goBack(fallback = '/professional/project-management') {
  if (router.canGoBack()) router.back(); else router.replace(fallback as never);
}

export function PmScreen({ title, subtitle, onBack, right, hero, children, loading, error, refreshing, onRefresh, fab }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; hero?: ReactNode; children?: ReactNode;
  loading?: boolean; error?: string; refreshing?: boolean; onRefresh?: () => void; fab?: ReactNode;
}) {
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack || (() => goBack())} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={pm.green} size="large" /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={pm.green} /> : undefined}>
          {hero}
          {!!error && <Alert tone="bad" text={error} action={onRefresh ? { label: 'Retry', onPress: onRefresh } : undefined} />}
          {children}
        </ScrollView>
      )}
      {fab}
    </View>
  );
}

export function HeaderAction({ icon, label, onPress }: { icon: 'plus' | 'edit'; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} hitSlop={10} style={s.headerAction} accessibilityRole="button" accessibilityLabel={label}><Icon name={icon} size={20} color="#fff" /></Pressable>;
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: object }) {
  const body = <View style={[s.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}
export const SectionTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <View style={s.sectionRow}><Text style={s.section}>{children}</Text>{right}</View>
);
export const Muted = ({ children, style }: { children: ReactNode; style?: object }) => <Text style={[s.muted, style]}>{children}</Text>;

export function Pill({ text, tone = 'gray' }: { text: string; tone?: Tone }) {
  const t = toneColors[tone];
  return <View style={[s.pill, { backgroundColor: t.bg }]}><Text style={[s.pillText, { color: t.fg }]}>{text}</Text></View>;
}

export function Bar({ pct, tone = 'ok' }: { pct: number; tone?: 'ok' | 'terra' | 'warn' | 'bad' }) {
  const color = tone === 'terra' ? pm.terra : tone === 'warn' ? '#D9A441' : tone === 'bad' ? pm.bad : pm.ok;
  return <View style={s.bar}><View style={[s.barFill, { width: `${Math.max(0, Math.min(100, pct || 0))}%`, backgroundColor: color }]} /></View>;
}

export function Alert({ tone, text, action }: { tone: 'bad' | 'warn' | 'info'; text: string; action?: { label: string; onPress: () => void } }) {
  const palette = tone === 'bad' ? { bg: pm.badBg, border: '#F3C6C0' } : tone === 'warn' ? { bg: pm.warnBg, border: '#F1DDA8' } : { bg: pm.blueBg, border: '#C9D8EC' };
  const Wrapper: any = action ? Pressable : View;
  return (
    <Wrapper onPress={action?.onPress} style={[s.alert, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={s.alertText}>{text}</Text>
      {!!action && <Text style={s.alertAction}>{action.label} ›</Text>}
    </Wrapper>
  );
}

export function Btn({ label, onPress, kind = 'primary', busy, disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'green' | 'ghost' | 'danger'; busy?: boolean; disabled?: boolean; small?: boolean }) {
  const bg = kind === 'primary' ? pm.terra : kind === 'green' ? pm.green : kind === 'danger' ? pm.badBg : '#fff';
  const fg = kind === 'ghost' ? pm.ink : kind === 'danger' ? pm.bad : '#fff';
  const border = kind === 'ghost' ? pm.line : kind === 'danger' ? '#F3C6C0' : bg;
  const off = busy || disabled;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" style={[s.btn, small && s.btnSmall, { backgroundColor: bg, borderColor: border }, off && { opacity: 0.55 }]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, small && { fontSize: 12 }, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (key: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
      {options.map(option => (
        <Pressable key={option.key} onPress={() => onChange(option.key)} style={[s.chip, value === option.key && s.chipOn]} accessibilityState={{ selected: value === option.key }}>
          <Text style={[s.chipText, value === option.key && { color: '#fff' }]}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function VisibilityToggle({ value, onChange, disabled }: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: '#CFC9B8', true: pm.ok }} thumbColor="#fff" accessibilityLabel="Visible to client" />;
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text>{!!text && <Text style={[s.muted, { textAlign: 'center' }]}>{text}</Text>}</View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: pm.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: pm.green, paddingHorizontal: 12, paddingVertical: 10 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSub: { color: pm.onGreen, fontSize: 11.5, marginTop: 1 },
  headerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: pm.terra, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14, paddingBottom: 40, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: pm.line, padding: 12, gap: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  section: { color: pm.ink, fontSize: 13.5, fontWeight: '800' },
  muted: { color: pm.muted, fontSize: 11.5, lineHeight: 16 },
  pill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  bar: { height: 6, borderRadius: 9, backgroundColor: '#EEE9DD', overflow: 'hidden' },
  barFill: { height: '100%' },
  alert: { borderRadius: 11, borderWidth: 1, padding: 10, gap: 4 },
  alertText: { color: pm.ink, fontSize: 12, lineHeight: 17 },
  alertAction: { color: pm.green, fontSize: 12, fontWeight: '800' },
  btn: { minHeight: 46, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnSmall: { minHeight: 36, borderRadius: 10, paddingHorizontal: 12 },
  btnText: { fontSize: 13.5, fontWeight: '800' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: '#fff', borderWidth: 1, borderColor: pm.line },
  chipOn: { backgroundColor: pm.green, borderColor: pm.green },
  chipText: { color: pm.muted, fontSize: 11.5, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: 20 },
  emptyTitle: { color: pm.ink, fontSize: 14, fontWeight: '800' },
});
