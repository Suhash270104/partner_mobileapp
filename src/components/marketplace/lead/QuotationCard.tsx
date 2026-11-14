import { StyleSheet, View } from 'react-native';
import { formatDate, formatDateTime, formatMoney, humanize } from '../../../lib/marketplace/format';
import type { Quotation } from '../../../lib/marketplace/types';
import { InfoRow, Text, palette } from '../../ui';
import { StatusBadge } from '../StatusBadge';

/** A quotation already sent: price, total, terms and the buyer's response. */
export function QuotationCard({ quote }: { quote: Quotation }) {
  return <View style={s.card}>
    <View style={s.top}>
      <View style={{ flex: 1 }}>
        <Text style={s.price}>{formatMoney(quote.unitPrice)}{quote.priceUnit ? ` per ${humanize(quote.priceUnit).toLowerCase()}` : ''}</Text>
        <Text style={s.date}>Sent {formatDateTime(quote.createdAt)}</Text>
      </View>
      <StatusBadge status={quote.status ?? 'sent'} />
    </View>
    <InfoRow label="Quantity" value={quote.quantity} />
    <InfoRow label="Total" value={quote.totalAmount != null ? formatMoney(quote.totalAmount) : ''} />
    <InfoRow label="GST" value={quote.gstPercentage != null ? `${quote.gstPercentage}%${quote.gstIncluded ? ' (included)' : ' extra'}` : ''} />
    <InfoRow label="Delivery" value={[quote.deliveryCharges != null ? formatMoney(quote.deliveryCharges) : '', quote.deliveryDays != null ? `${quote.deliveryDays} days` : ''].filter(Boolean).join(' · ')} />
    <InfoRow label="Valid until" value={quote.validUntil ? formatDate(quote.validUntil) : ''} />
    <InfoRow label="Payment terms" value={quote.paymentTerms} />
    {quote.notes ? <Text style={s.notes}>{quote.notes}</Text> : null}
    {quote.buyerResponseNote ? <Text style={s.notes}>Buyer: {String(quote.buyerResponseNote)}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: palette.line, borderRadius: 14, padding: 12, gap: 2, marginTop: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }, price: { color: palette.ink, fontSize: 16, fontWeight: '800' }, date: { color: palette.muted, fontSize: 12 },
  notes: { color: palette.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
