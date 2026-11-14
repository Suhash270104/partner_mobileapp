import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';

// Reusable building blocks for the realtor / seller workspace. They mirror the website's cards
// (stat tiles, alert banner, credits hero, navigation cards, section cards with "View all",
// empty states and the "Realtor workspace" menu sheet) so every screen is assembled from the same parts.

export type Tone = 'green' | 'blue' | 'amber' | 'violet' | 'red';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: palette.greenSoft, fg: palette.greenText },
  blue: { bg: palette.blueSoft, fg: palette.blue },
  amber: { bg: palette.amberSoft, fg: palette.amber },
  violet: { bg: palette.violetSoft, fg: palette.violet },
  red: { bg: palette.redSoft, fg: palette.red },
};
export const toneOf = (tone: Tone) => TONES[tone];

export function IconTile({ icon, tone = 'green', size = 44 }: { icon: string; tone?: Tone; size?: number }) {
  return <View style={[s.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: TONES[tone].bg }]}>
    <Icon name={icon} size={size * 0.46} color={TONES[tone].fg} />
  </View>;
}

export function Avatar({ label, size = 40, dark = true }: { label: string; size?: number; dark?: boolean }) {
  const letters = label.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('') || 'R';
  return <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, !dark && { backgroundColor: palette.greenSoft }]}>
    <Text style={[s.avatarText, { fontSize: size * 0.36 }, !dark && { color: palette.green }]}>{letters}</Text>
  </View>;
}

export function ProgressBar({ value, onDark = false }: { value: number; onDark?: boolean }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return <View style={[s.track, onDark && s.trackDark]}><View style={[s.fill, onDark && s.fillDark, { width: `${pct}%` }]} /></View>;
}

/** Coloured notice with an optional full-width action, e.g. "Account pending verification → Review KYC". */
export function AlertBanner({ tone = 'amber', icon = 'shield', title, message, actionLabel, onAction }: {
  tone?: 'amber' | 'red' | 'green' | 'blue'; icon?: string; title: string; message?: string; actionLabel?: string; onAction?: () => void;
}) {
  const colors = { amber: { bg: '#fff9ec', border: '#f1dfb0', fg: palette.amber }, red: { bg: '#fff1f0', border: '#f4c7c2', fg: palette.red }, green: { bg: '#ecf8f2', border: '#bfe0cf', fg: palette.greenText }, blue: { bg: palette.blueSoft, border: '#c6d8f1', fg: palette.blue } }[tone];
  return <View style={[s.alert, { backgroundColor: colors.bg, borderColor: colors.border }]}>
    <View style={s.alertTop}>
      <Icon name={icon} size={22} color={colors.fg} />
      <View style={s.flex}><Text style={s.alertTitle}>{title}</Text>{message ? <Text style={[s.alertMsg, { color: colors.fg }]}>{message}</Text> : null}</View>
    </View>
    {actionLabel && onAction ? <Pressable onPress={onAction} style={s.alertBtn}><Text style={s.alertBtnText}>{actionLabel}</Text><Icon name="arrowRight" size={16} color="#fff" /></Pressable> : null}
  </View>;
}

/** Two-up grid wrapper for StatCard. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

export function StatCard({ label, value, caption, icon, tone = 'green', onPress }: { label: string; value: string | number | null | undefined; caption?: string; icon: string; tone?: Tone; onPress?: () => void }) {
  return <Pressable disabled={!onPress} onPress={onPress} style={s.stat}>
    <View style={s.statTop}><Text style={s.statLabel}>{label.toUpperCase()}</Text><IconTile icon={icon} tone={tone} size={38} /></View>
    <Text style={s.statValue}>{value == null || value === '' ? '—' : String(value)}</Text>
    {caption ? <View style={s.statFoot}><Text style={s.statCaption} numberOfLines={2}>{caption}</Text></View> : null}
  </Pressable>;
}

/** Dark-green promotional card, used for "Out of credits — buy a listing pack". */
export function CreditsHero({ eyebrow, title, message, actionLabel, onAction }: { eyebrow: string; title: string; message?: string; actionLabel: string; onAction: () => void }) {
  return <View style={s.hero}>
    <Text style={s.heroEyebrow}>{eyebrow.toUpperCase()}</Text>
    <Text style={s.heroTitle}>{title}</Text>
    {message ? <Text style={s.heroMsg}>{message}</Text> : null}
    <Pressable onPress={onAction} style={s.heroBtn}><Icon name="sparkles" size={17} color={palette.green} /><Text style={s.heroBtnText}>{actionLabel}</Text></Pressable>
  </View>;
}

/** Tappable card with a tinted icon tile, title, detail and chevron ("My properties", "Published listings"…). */
export function NavCard({ icon, tone = 'green', title, detail, onPress, badge }: { icon: string; tone?: Tone; title: string; detail?: string; onPress: () => void; badge?: number }) {
  return <Pressable onPress={onPress} style={s.navCard} accessibilityRole="button">
    <IconTile icon={icon} tone={tone} size={48} />
    <View style={s.flex}><Text style={s.navTitle}>{title}</Text>{detail ? <Text style={s.navDetail}>{detail}</Text> : null}</View>
    {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    <Icon name="arrowRight" size={18} color="#9aa8a1" />
  </Pressable>;
}

/** White card with a header row (title + "View all →") and a body. */
export function SectionCard({ title, subtitle, actionLabel, onAction, children }: { title: string; subtitle?: string; actionLabel?: string; onAction?: () => void; children: ReactNode }) {
  return <View style={s.section}>
    <View style={s.sectionHead}>
      <View style={s.flex}><Text style={s.sectionTitle}>{title}</Text>{subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}</View>
      {actionLabel && onAction ? <Pressable onPress={onAction} style={s.sectionAction}><Text style={s.sectionActionText}>{actionLabel}</Text><Icon name="arrowRight" size={14} color={palette.greenText} /></Pressable> : null}
    </View>
    <View style={s.sectionBody}>{children}</View>
  </View>;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: { icon: string; title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={s.empty}>
    <IconTile icon={icon} tone="green" size={56} />
    <Text style={s.emptyTitle}>{title}</Text>
    {message ? <Text style={s.emptyMsg}>{message}</Text> : null}
    {actionLabel && onAction ? <Pressable onPress={onAction} style={s.emptyBtn}><Text style={s.emptyBtnText}>{actionLabel}</Text></Pressable> : null}
  </View>;
}

/** Compact row used inside SectionCard for leads / notifications. */
export function ListRow({ title, detail, trailing, onPress, unread = false }: { title: string; detail?: string; trailing?: ReactNode; onPress?: () => void; unread?: boolean }) {
  return <Pressable disabled={!onPress} onPress={onPress} style={s.listRow}>
    {unread ? <View style={s.dot} /> : null}
    <View style={s.flex}><Text style={s.listTitle} numberOfLines={1}>{title}</Text>{detail ? <Text style={s.listDetail} numberOfLines={2}>{detail}</Text> : null}</View>
    {trailing}
  </Pressable>;
}

export type MenuItem = { key: string; label: string; icon: string; onPress: () => void; badge?: number };

/** The website's "Realtor workspace" bottom sheet: profile, menu, listing credits and account status. */
export function WorkspaceSheet({ visible, onClose, name, role, items, activeKey, credits, onBuyCredits, statusLabel, statusTone = 'amber', completeness, onSignOut }: {
  visible: boolean; onClose: () => void; name: string; role: string; items: MenuItem[]; activeKey?: string;
  credits: number | null | undefined; onBuyCredits: () => void; statusLabel: string; statusTone?: 'amber' | 'green' | 'red'; completeness?: number | null; onSignOut: () => void;
}) {
  const out = credits != null && credits <= 0;
  const pill = { amber: { bg: 'rgba(250,204,21,0.18)', fg: '#facc15' }, green: { bg: 'rgba(52,211,153,0.2)', fg: '#6ee7b7' }, red: { bg: 'rgba(248,113,113,0.2)', fg: '#fca5a5' } }[statusTone];
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose}><Pressable style={s.sheet} onPress={() => undefined}>
      <ScrollView contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false}>
        <View style={s.sheetHead}><Text style={s.sheetTitle}>Realtor workspace</Text><Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={24} color="#4d5f57" /></Pressable></View>
        <View style={s.profile}><Avatar label={name} size={52} /><View style={s.flex}><Text style={s.profileName} numberOfLines={1}>{name}</Text><Text style={s.profileRole}>{role}</Text></View></View>
        {items.map(item => {
          const on = item.key === activeKey;
          return <Pressable key={item.key} onPress={() => { onClose(); item.onPress(); }} style={[s.menuItem, on && s.menuItemOn]}>
            <Icon name={item.icon} size={22} color={on ? palette.green : '#33463f'} />
            <Text style={[s.menuLabel, on && { color: palette.green }]}>{item.label}</Text>
            {item.badge ? <View style={s.badge}><Text style={s.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text></View> : null}
          </Pressable>;
        })}
        <View style={s.dark}>
          <View style={s.darkCard}>
            <View style={s.darkRow}><Icon name="creditCard" size={18} color="#9be3c4" /><Text style={s.darkLabel}>Listing Credits</Text><Text style={s.darkCredits}>{credits == null ? '—' : credits}</Text></View>
            <Text style={s.darkMsg}>{out ? "You're out of credits — buy a pack to post a new project or property." : 'Each property or project you post uses one credit. Credits never expire.'}</Text>
            <Pressable onPress={() => { onClose(); onBuyCredits(); }} style={s.darkBtn}><Icon name="sparkles" size={17} color="#04271c" /><Text style={s.darkBtnText}>Buy Listing Pack</Text></Pressable>
          </View>
          <View style={s.darkCard}>
            <View style={s.darkRow}><Text style={[s.darkLabel, { marginLeft: 0, fontSize: 15 }]}>Account status</Text><View style={[s.statusPill, { backgroundColor: pill.bg }]}><Text style={[s.statusPillText, { color: pill.fg }]}>{statusLabel}</Text></View></View>
            {completeness != null ? <>
              <View style={s.darkRow}><Text style={s.darkMsg}>Profile completeness</Text><Text style={s.darkPct}>{Math.round(completeness)}%</Text></View>
              <ProgressBar value={completeness} onDark />
            </> : null}
          </View>
        </View>
        <Pressable onPress={onSignOut} style={s.signOut}><Icon name="logOut" size={20} color={palette.red} /><Text style={s.signOutText}>Sign out</Text></Pressable>
      </ScrollView>
    </Pressable></Pressable>
  </Modal>;
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  avatar: { backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontWeight: '800' },
  track: { height: 8, borderRadius: 4, backgroundColor: palette.line, overflow: 'hidden' }, trackDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: palette.green }, fillDark: { backgroundColor: '#3ddc9a' },
  alert: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 }, alertTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  alertTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' }, alertMsg: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  alertBtn: { minHeight: 48, borderRadius: 14, backgroundColor: palette.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, alertBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { width: '47.8%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 8 },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }, statLabel: { flex: 1, color: palette.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, lineHeight: 16 },
  statValue: { color: palette.ink, fontSize: 28, fontWeight: '800' }, statFoot: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 8 }, statCaption: { color: palette.body, fontSize: 12, lineHeight: 17 },
  hero: { backgroundColor: '#0f5a3f', borderRadius: 22, padding: 18, gap: 8 }, heroEyebrow: { color: '#9be3c4', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '800', lineHeight: 29 }, heroMsg: { color: '#cfe8dc', fontSize: 14, lineHeight: 20 },
  heroBtn: { marginTop: 6, minHeight: 50, borderRadius: 25, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, heroBtnText: { color: palette.green, fontSize: 15, fontWeight: '800' },
  navCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  navTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' }, navDetail: { color: palette.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  section: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' }, sectionSub: { color: palette.muted, fontSize: 12, marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 5 }, sectionActionText: { color: palette.greenText, fontSize: 13, fontWeight: '800' }, sectionBody: { padding: 14, gap: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 22, paddingHorizontal: 10 }, emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginTop: 4 },
  emptyMsg: { color: palette.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyBtn: { marginTop: 8, minHeight: 46, paddingHorizontal: 24, borderRadius: 23, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' }, emptyBtnText: { color: palette.green, fontSize: 14, fontWeight: '800' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  listTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' }, listDetail: { color: palette.body, fontSize: 12, lineHeight: 17, marginTop: 2 }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.green },
  backdrop: { flex: 1, backgroundColor: 'rgba(16,35,28,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28 }, sheetContent: { padding: 18, gap: 6, paddingBottom: 28 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, sheetTitle: { color: palette.ink, fontSize: 21, fontWeight: '800' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.bg, marginBottom: 6 },
  profileName: { color: palette.ink, fontSize: 17, fontWeight: '800' }, profileRole: { color: palette.muted, fontSize: 14, marginTop: 2 },
  menuItem: { minHeight: 52, borderRadius: 26, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, menuItemOn: { backgroundColor: palette.greenSoft },
  menuLabel: { flex: 1, color: '#22332c', fontSize: 16, fontWeight: '700' },
  dark: { backgroundColor: '#0d3a2b', borderRadius: 24, padding: 12, gap: 10, marginTop: 8 }, darkCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 14, gap: 10 },
  darkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, darkLabel: { flex: 1, color: '#bff0da', fontSize: 14, fontWeight: '800', marginLeft: 2 }, darkCredits: { color: '#facc15', fontSize: 20, fontWeight: '800' },
  darkMsg: { flex: 1, color: '#a9d6c3', fontSize: 13, lineHeight: 19 }, darkPct: { color: '#fff', fontSize: 15, fontWeight: '800' },
  darkBtn: { minHeight: 48, borderRadius: 24, backgroundColor: '#12d68c', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, darkBtnText: { color: '#04271c', fontSize: 15, fontWeight: '800' },
  statusPill: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }, statusPillText: { fontSize: 13, fontWeight: '800' },
  signOut: { minHeight: 52, marginTop: 8, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.redSoft }, signOutText: { color: palette.red, fontSize: 15, fontWeight: '800' },
});
