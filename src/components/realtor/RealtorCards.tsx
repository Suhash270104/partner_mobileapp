import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { IconButton, PillButton } from './RealtorControls';
import { Avatar } from './RealtorUi';
import { Data, EDITABLE_STATUSES, LIVE_STATUS, StatusTone, areaLine, formatPriceShort, humanize, leadTone, locationLine, priceOf, statusMeta, timeAgo } from './realtorFormat';

const TONE: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  green: { bg: '#d8f3e6', fg: '#075e3b', border: '#aee3c8' }, amber: { bg: '#ffefd1', fg: '#7a4700', border: '#f3d9a0' }, red: { bg: '#ffe3df', fg: '#8f1d12', border: '#f4bdb6' },
  blue: { bg: '#e1f1fb', fg: '#0b5d86', border: '#b6dbef' }, violet: { bg: '#efeafa', fg: '#5b3fa0', border: '#d9cdf2' }, slate: { bg: '#eef2f5', fg: '#475467', border: '#dbe2e8' },
};

export function Badge({ label, tone = 'slate', icon, upper = false }: { label: string; tone?: StatusTone; icon?: string; upper?: boolean }) {
  const c = TONE[tone];
  return <View style={[s.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
    {icon ? <Icon name={icon} size={14} color={c.fg} /> : null}
    <Text style={[s.badgeText, { color: c.fg }]} numberOfLines={1}>{upper ? label.toUpperCase() : label}</Text>
  </View>;
}

function Note({ title, message }: { title: string; message: string }) {
  return <View style={s.note}><Text style={s.noteTitle}>{title}</Text><Text style={s.noteMsg}>{message}</Text></View>;
}

/** Moderation feedback from the admin that the realtor must act on. */
const moderationOf = (listing?: Data) => {
  const status = String(listing?.status || '');
  const note = String(listing?.moderationNote || '').trim();
  if (!note || !['changes_requested', 'rejected'].includes(status)) return null;
  return <Note title={status === 'rejected' ? 'Rejected by reviewer' : 'Changes requested'} message={note} />;
};

export function PropertyCard({ item, busy, onOpen, onEdit, onDelete, onSubmit, onViewLive }: {
  item: Data; busy?: boolean; onOpen?: () => void; onEdit: () => void; onDelete: () => void; onSubmit: () => void; onViewLive: () => void;
}) {
  const listing: Data | undefined = item.listing && typeof item.listing === 'object' ? item.listing : undefined;
  const status = String(listing?.status || 'draft');
  const meta = statusMeta(status);
  const chips = [item.bhk ? `${item.bhk} BHK` : '', item.furnishing ? humanize(item.furnishing).replace(/ /g, '-') : '', areaLine(item)].filter(Boolean);
  const canSubmit = !!listing && EDITABLE_STATUSES.includes(status);
  const locked = ['pending_review', 'under_review'].includes(status);
  return <Pressable onPress={onOpen} disabled={!onOpen} style={s.card}>
    <View style={s.rowBetween}>
      <View style={s.typeChip}><Text style={s.typeChipText}>{humanize(item.propertyType).toUpperCase() || 'PROPERTY'}</Text></View>
      <Text style={s.price}>{priceOf(item)}</Text>
    </View>
    <Text style={s.title}>{String(item.title || 'Untitled property')}</Text>
    {item.societyName ? <Text style={s.society}>in {String(item.societyName)}</Text> : null}
    {locationLine(item) ? <View style={s.locRow}><Icon name="mapPin" size={17} color="#7b8a83" /><Text style={s.loc}>{locationLine(item)}</Text></View> : null}
    {chips.length ? <View style={s.chips}>{chips.map(chip => <View key={chip} style={s.chip}><Text style={s.chipText}>{chip}</Text></View>)}</View> : null}
    <View style={{ alignSelf: 'flex-start' }}><Badge label={meta.label} tone={meta.tone} icon={meta.icon} upper /></View>
    {moderationOf(listing)}
    <View style={s.footer}>
      <View style={s.footerLeft}>
        <IconButton icon="edit" label="Edit property" onPress={onEdit} disabled={busy || locked} />
        <IconButton icon="trash" label="Delete property" tone="danger" onPress={onDelete} disabled={busy} />
      </View>
      {status === LIVE_STATUS ? <PillButton title="View Live" icon="externalLink" variant="soft" compact onPress={onViewLive} />
        : canSubmit ? <PillButton title="Submit for Review" icon="send" compact onPress={onSubmit} loading={busy} />
          : locked ? <Text style={s.hint}>Editing locked while in review</Text> : null}
    </View>
  </Pressable>;
}

export function ListingCard({ item, busy, onOpen, onSubmit, onDelete, onViewLive }: { item: Data; busy?: boolean; onOpen?: () => void; onSubmit: () => void; onDelete: () => void; onViewLive: () => void }) {
  const status = String(item.status || 'draft');
  const meta = statusMeta(status);
  const editable = EDITABLE_STATUSES.includes(status);
  const subtitle = [humanize(item.listingPurpose), humanize(item.transactionType)].filter(Boolean).join(' · ');
  return <Pressable onPress={onOpen} disabled={!onOpen} style={s.card}>
    <View style={s.rowBetween}>
      <Text style={[s.title, { flex: 1 }]} numberOfLines={3}>{String(item.title || item.propertyTitle || item.projectName || 'Listing')}</Text>
      <Badge label={status === 'published' ? 'Published' : meta.label} tone={meta.tone} />
    </View>
    {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
    {moderationOf(item)}
    <View style={s.btnRow}>
      <PillButton title="Submit" icon="send" grow onPress={onSubmit} disabled={!editable || busy} />
      <PillButton title="Delete" icon="trash" variant="danger" grow onPress={onDelete} disabled={!editable || busy} />
    </View>
    {status === LIVE_STATUS ? <PillButton title="View Live" icon="externalLink" variant="soft" compact onPress={onViewLive} /> : null}
  </Pressable>;
}

export function LeadCard({ item, onOpen }: { item: Data; onOpen: () => void }) {
  const name = String(item.customerName || item.buyerName || 'Buyer enquiry');
  const listingTitle = String(item.listing?.title || item.propertyTitle || '');
  const status = String(item.status || 'unlocked');
  return <Pressable onPress={onOpen} style={[s.card, s.leadCard]}>
    <Avatar label={name} size={42} dark={false} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={s.leadName} numberOfLines={1}>{name}</Text>
      {listingTitle ? <Text style={s.leadSub} numberOfLines={2}>{listingTitle}</Text> : null}
      {item.createdAt || item.unlockedAt ? <Text style={s.time}>{timeAgo(item.unlockedAt || item.createdAt)}</Text> : null}
    </View>
    <Badge label={humanize(status)} tone={leadTone(status)} />
  </Pressable>;
}

export function NotificationCard({ item, onMarkRead }: { item: Data; onMarkRead: () => void }) {
  const unread = !item.read && !item.readAt;
  return <View style={[s.card, s.notif, !unread && { backgroundColor: '#fff', opacity: 0.85 }]}>
    <View style={s.bell}><Icon name="bell" size={20} color="#fff" /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <View style={s.rowBetween}>
        <Text style={[s.leadName, { flex: 1 }]} numberOfLines={2}>{String(item.title || 'Kraftnex update')}</Text>
        {unread ? <Pressable onPress={onMarkRead} hitSlop={8}><Text style={s.markRead}>Mark read</Text></Pressable> : null}
      </View>
      {item.message ? <Text style={s.leadSub}>{String(item.message)}</Text> : null}
      <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
    </View>
  </View>;
}

export function ProjectCard({ item, busy, onOpen, onSubmit }: { item: Data; busy?: boolean; onOpen: () => void; onSubmit: () => void }) {
  const status = String(item.status || 'draft');
  const meta = statusMeta(status);
  const min = formatPriceShort(item.price?.min), max = formatPriceShort(item.price?.max);
  const range = min && max ? `${min} – ${max}` : min || max;
  return <Pressable onPress={onOpen} style={s.card}>
    <View style={s.rowBetween}>
      <View style={s.typeChip}><Text style={s.typeChipText}>{humanize(item.projectType).toUpperCase() || 'PROJECT'}</Text></View>
      {range ? <Text style={s.price}>{range}</Text> : null}
    </View>
    <Text style={s.title}>{String(item.name || 'Untitled project')}</Text>
    {locationLine(item) ? <View style={s.locRow}><Icon name="mapPin" size={17} color="#7b8a83" /><Text style={s.loc}>{locationLine(item)}</Text></View> : null}
    <View style={{ alignSelf: 'flex-start' }}><Badge label={meta.label} tone={meta.tone} icon={meta.icon} upper /></View>
    {moderationOf(item)}
    <View style={s.footer}>
      <IconButton icon="edit" label="Edit project" onPress={onOpen} />
      {EDITABLE_STATUSES.includes(status) ? <PillButton title="Submit for Review" icon="send" compact onPress={onSubmit} loading={busy} /> : null}
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }, badgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 24, padding: 16, gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  typeChip: { backgroundColor: '#eef2f5', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 }, typeChipText: { color: '#344054', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  price: { color: palette.ink, fontSize: 20, fontWeight: '800' }, title: { color: palette.ink, fontSize: 19, fontWeight: '800', lineHeight: 25 },
  society: { color: palette.greenText, fontSize: 15, fontWeight: '700' }, locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, loc: { color: palette.body, fontSize: 15, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f8faf9' }, chipText: { color: '#33463f', fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, paddingTop: 10, marginTop: 2 }, footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hint: { color: palette.muted, fontSize: 12, flexShrink: 1, textAlign: 'right' }, sub: { color: palette.body, fontSize: 15 }, btnRow: { flexDirection: 'row', gap: 10 },
  note: { backgroundColor: '#fff9ec', borderColor: '#f1dfb0', borderWidth: 1, borderRadius: 14, padding: 12, gap: 3 }, noteTitle: { color: '#7a4700', fontSize: 13, fontWeight: '800' }, noteMsg: { color: '#7a4700', fontSize: 13, lineHeight: 19 },
  leadCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20 }, leadName: { color: palette.ink, fontSize: 16, fontWeight: '800' }, leadSub: { color: palette.body, fontSize: 14, lineHeight: 20 }, time: { color: '#8a9a92', fontSize: 12, fontWeight: '700', marginTop: 2 },
  notif: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#f1f5f3', borderRadius: 20 }, bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0d4a38', alignItems: 'center', justifyContent: 'center' }, markRead: { color: palette.green, fontSize: 13, fontWeight: '800' },
});
