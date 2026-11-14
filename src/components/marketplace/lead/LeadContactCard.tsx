import { Linking, View } from 'react-native';
import { whatsappUrl } from '../../../lib/marketplace/contact';
import type { Lead } from '../../../lib/marketplace/types';
import { Avatar, InfoRow, PillButton, SectionCard, Text, palette } from '../../ui';

/** Buyer identity plus one-tap Call, WhatsApp and Email. Sellers always see the buyer's full contact (hand-off §1). */
export function LeadContactCard({ lead }: { lead: Lead }) {
  const name = lead.buyerName || 'Buyer';
  return <SectionCard title="Buyer">
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <Avatar label={name} size={48} dark={false} />
      <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontSize: 17, fontWeight: '800' }}>{name}</Text></View>
    </View>
    <InfoRow label="Phone" value={lead.buyerPhone} />
    <InfoRow label="Email" value={lead.buyerEmail} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {lead.buyerPhone ? <PillButton compact icon="phone" title="Call" variant="soft" onPress={() => void Linking.openURL(`tel:${lead.buyerPhone}`)} /> : null}
      {lead.buyerPhone ? <PillButton compact icon="message" title="WhatsApp" variant="soft" onPress={() => void Linking.openURL(whatsappUrl(lead.buyerPhone!, `Hi ${name}, regarding your enquiry on Kraftnex.`))} /> : null}
      {lead.buyerEmail ? <PillButton compact icon="mail" title="Email" variant="soft" onPress={() => void Linking.openURL(`mailto:${lead.buyerEmail}`)} /> : null}
    </View>
  </SectionCard>;
}
