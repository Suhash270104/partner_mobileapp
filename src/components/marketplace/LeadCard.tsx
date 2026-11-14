import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Icon, PillButton, Text, palette } from '../ui';
import { StatusBadge } from './StatusBadge';
import { formatDate, humanize, timeAgo } from '../../lib/marketplace/format';
import { whatsappUrl } from '../../lib/marketplace/contact';
import type { Lead } from '../../lib/marketplace/types';

/** One enquiry in the list: buyer, product, request summary and one-tap call / WhatsApp. */
export function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const product = lead.productId?.title || lead.requirementTitle || 'Buyer requirement';
  const request = [lead.quantity ? `${lead.quantity}${lead.unit ? ` ${humanize(lead.unit).toLowerCase()}` : ''}` : '', lead.deliveryLocation, lead.requiredBy ? `by ${formatDate(lead.requiredBy)}` : ''].filter(Boolean).join(' · ');
  return <Pressable onPress={onOpen} style={s.card} accessibilityRole="button" accessibilityLabel={`Open enquiry from ${lead.buyerName ?? 'buyer'}`}>
    <View style={s.top}>
      <Avatar label={lead.buyerName || 'B'} size={42} dark={false} />
      <View style={s.flex}>
        <Text style={s.name} numberOfLines={1}>{lead.buyerName || 'Buyer'}</Text>
        <Text style={s.time}>{timeAgo(lead.createdAt)}</Text>
      </View>
      <StatusBadge status={lead.status} />
    </View>
    <Text style={s.product} numberOfLines={2}>{product}</Text>
    {request ? <Text style={s.request} numberOfLines={2}>{request}</Text> : null}
    {lead.requirements ? <Text style={s.body} numberOfLines={2}>{lead.requirements}</Text> : null}
    <View style={s.actions}>
      {lead.buyerPhone ? <>
        <PillButton compact variant="soft" icon="phone" title="Call" onPress={() => void Linking.openURL(`tel:${lead.buyerPhone}`)} />
        <PillButton compact variant="soft" icon="message" title="WhatsApp" onPress={() => void Linking.openURL(whatsappUrl(lead.buyerPhone!, `Hi ${lead.buyerName ?? ''}, regarding your enquiry for ${product}.`))} />
      </> : null}
      <View style={s.flex} /><Icon name="arrowRight" size={18} color="#9aa8a1" />
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 8 },
  flex: { flex: 1, minWidth: 0 }, top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: palette.ink, fontSize: 15, fontWeight: '800' }, time: { color: palette.muted, fontSize: 12 },
  product: { color: palette.ink, fontSize: 15, fontWeight: '700', lineHeight: 20 }, request: { color: palette.greenText, fontSize: 13, fontWeight: '700' }, body: { color: palette.body, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
});
