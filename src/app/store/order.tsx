import { useMemo } from 'react';
import { Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DataRow, PageHeading, Panel, SectionTitle, StatePanel, StatusPill, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { InfoLine, Row, SellerFrame, fmtDate, humanize, money } from '../../components/vertical/SellerParts';

const payTone = (s: string) => (s === 'paid' || s === 'refunded' ? 'green' : s === 'failed' ? 'red' : 'amber');

export default function OrderDetail() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const order = useMemo<Row | null>(() => { try { return data ? JSON.parse(String(data)) : null; } catch { return null; } }, [data]);
  if (!order) return <SellerFrame title="Order" activeTab="orders"><StatePanel title="Order unavailable" message="Open this order again from the Orders list." /></SellerFrame>;
  const a = order.shippingAddress || {};
  const p = order.pricing || {};
  const ship = order.shipment || {};
  const history: Row[] = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  return <SellerFrame title={String(order.orderNumber || 'Order')} subtitle="Order details" activeTab="orders">
    <PageHeading eyebrow="ORDER" title={String(order.orderNumber || 'Order')} subtitle={`Placed ${fmtDate(order.createdAt)}`} />
    <Panel tint>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><StatusPill label={String(order.status || 'placed')} tone={order.status === 'cancelled' ? 'red' : order.status === 'delivered' ? 'green' : 'blue'} />
        <StatusPill label={`Payment ${humanize(order.paymentStatus || 'pending')}`} tone={payTone(String(order.paymentStatus))} />
        <StatusPill label={order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'} tone="violet" /></View>
      <Text style={{ color: palette.ink, fontWeight: '800', fontSize: 22 }}>{money(p.grandTotal)}</Text>
    </Panel>
    <SectionTitle title="Items" />
    <Panel>{(order.items || []).map((item: Row, i: number) => <View key={`${item.productId}:${i}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }}>
      {item.photo ? <Image source={{ uri: String(item.photo) }} style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: palette.greenSoft }} /> : <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: palette.greenSoft }} />}
      <View style={{ flex: 1 }}><Text style={{ color: palette.ink, fontWeight: '800', fontSize: 13 }} numberOfLines={2}>{item.title}</Text>
        <Text style={{ color: palette.muted, fontSize: 11 }}>{item.quantity} × {money(item.unitPrice)}{item.sku ? ` · ${item.sku}` : ''}</Text></View>
      <Text style={{ color: palette.ink, fontWeight: '800', fontSize: 13 }}>{money(item.lineTotal)}</Text>
    </View>)}</Panel>
    <SectionTitle title="Payment summary" />
    <Panel>
      <InfoLine label="Subtotal" value={money(p.subtotal)} /><InfoLine label="Tax" value={money(p.taxTotal)} />
      <InfoLine label="Shipping" value={money(p.shippingFee)} />{Number(p.discount) > 0 ? <InfoLine label={`Discount${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`-${money(p.discount)}`} /> : null}
      <InfoLine label="Total" value={money(p.grandTotal)} />
    </Panel>
    <SectionTitle title="Delivery address" />
    <Panel>
      <Text style={{ color: palette.ink, fontWeight: '800' }}>{a.fullName || 'Buyer'}</Text>
      <Text style={{ color: palette.body, fontSize: 13, lineHeight: 19 }}>{[a.streetAddress, a.locality, a.city, a.state, a.pinCode, a.country].filter(Boolean).join(', ') || 'No address on record'}</Text>
      <InfoLine label="Phone" value={a.phone} />
    </Panel>
    {(ship.courierPartner || ship.trackingNumber) ? <><SectionTitle title="Shipment" /><Panel>
      <InfoLine label="Courier" value={ship.courierPartner} /><InfoLine label="Tracking / AWB" value={ship.trackingNumber} />
      <InfoLine label="Shipped" value={ship.shippedAt ? fmtDate(ship.shippedAt) : ''} /><InfoLine label="Delivered" value={ship.deliveredAt ? fmtDate(ship.deliveredAt) : ''} />
    </Panel></> : null}
    {order.cancellationReason ? <Panel><Text style={{ color: palette.red, fontWeight: '800' }}>Cancellation reason</Text><Text style={{ color: palette.body }}>{order.cancellationReason}</Text></Panel> : null}
    <SectionTitle title="Status timeline" />
    <Panel>{history.length ? history.map((h, i) => <DataRow key={i} title={humanize(h.status)} detail={`${fmtDate(h.at)}${h.note ? ` · ${h.note}` : ''}`} />) : <Text style={{ color: palette.muted }}>No status history recorded yet.</Text>}</Panel>
  </SellerFrame>;
}
