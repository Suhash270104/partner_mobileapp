import { View } from 'react-native';
import { formatDate, formatDateTime, humanize } from '../../../lib/marketplace/format';
import type { Lead } from '../../../lib/marketplace/types';
import { InfoRow, SectionCard, Text, palette } from '../../ui';

/** What the buyer asked for, including their answers to the seller's own enquiry-form questions. */
export function LeadRequestCard({ lead }: { lead: Lead }) {
  const answers = lead.answers ?? [];
  return <SectionCard title="Buyer request" subtitle={`Received ${formatDateTime(lead.createdAt)}`}>
    <InfoRow label="Product" value={lead.productId?.title || lead.requirementTitle} />
    <InfoRow label="Quantity" value={lead.quantity ? `${lead.quantity}${lead.unit ? ` ${humanize(lead.unit).toLowerCase()}` : ''}` : ''} />
    <InfoRow label="Deliver to" value={lead.deliveryLocation} />
    <InfoRow label="Required by" value={lead.requiredBy ? formatDate(lead.requiredBy) : ''} />
    {lead.requirements ? <Text style={{ color: palette.ink, fontSize: 14, lineHeight: 21, marginTop: 6 }}>{lead.requirements}</Text> : null}
    {lead.message ? <Text style={{ color: palette.body, fontSize: 14, lineHeight: 21, marginTop: 6 }}>“{lead.message}”</Text> : null}
    {answers.length ? <View style={{ marginTop: 10, gap: 8 }}>
      <Text style={{ color: palette.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>THEIR ANSWERS</Text>
      {answers.map((item, index) => <View key={index}><Text style={{ color: palette.muted, fontSize: 12 }}>{item.question}</Text><Text style={{ color: palette.ink, fontSize: 14, fontWeight: '700' }}>{item.answer || '—'}</Text></View>)}
    </View> : null}
  </SectionCard>;
}
