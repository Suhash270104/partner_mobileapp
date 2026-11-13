import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DataRow, PageHeading, Panel, SectionTitle, StatePanel, StatusPill, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { InfoLine, Row, SellerFrame, fmtDate, humanize, money } from '../../components/vertical/SellerParts';
import { merchantApi } from '../../lib/partnerVerticalApi';

export default function ReturnDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [ret, setRet] = useState<Row | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    if (!id) return;
    merchantApi.returnById(String(id)).then(r => { if (alive) setRet(r.returnRequest as Row); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load this return.'); });
    return () => { alive = false; };
  }, [id]);
  if (error) return <SellerFrame title="Return" activeTab="orders"><StatePanel title="Return unavailable" message={error} /></SellerFrame>;
  if (!ret) return <SellerFrame title="Return" activeTab="orders"><Panel><Text style={{ color: palette.body }}>Loading…</Text></Panel></SellerFrame>;
  const photos: string[] = Array.isArray(ret.photos) ? ret.photos : [];
  const steps = [['Requested', ret.createdAt], ['Approved', ret.approvedAt], ['Pickup scheduled', ret.pickupScheduledAt], ['Picked up', ret.pickedUpAt], ['Refunded', ret.refundedAt], ['Completed', ret.completedAt]].filter(([, at]) => at);
  return <SellerFrame title={`Return · ${ret.orderNumber || ''}`} subtitle="Return details" activeTab="orders">
    <PageHeading eyebrow="RETURN" title={`Order ${ret.orderNumber || ''}`} subtitle={`Requested ${fmtDate(ret.createdAt)}`} action={<StatusPill label={String(ret.status)} tone={ret.status === 'rejected' ? 'red' : ret.status === 'requested' ? 'amber' : 'green'} />} />
    <Panel tint>
      <Text style={{ color: palette.green, fontWeight: '800', fontSize: 15 }}>{humanize(ret.reason)}</Text>
      {ret.reasonNote ? <Text style={{ color: palette.body, fontSize: 13, lineHeight: 19 }}>{ret.reasonNote}</Text> : null}
      <InfoLine label="Customer" value={ret.customerName} /><InfoLine label="Phone" value={ret.customerPhone} />
      <InfoLine label="Refund amount" value={Number(ret.refundAmount) > 0 ? money(ret.refundAmount) : ''} />
      <InfoLine label="Courier" value={ret.courierPartner} /><InfoLine label="AWB" value={ret.awbNumber} />
      {ret.rejectionNote ? <InfoLine label="Rejection note" value={ret.rejectionNote} /> : null}
    </Panel>
    <SectionTitle title="Items to return" />
    <Panel>{(ret.items || []).map((item: Row, i: number) => <DataRow key={i} title={String(item.title)} detail={`${item.quantity} × ${money(item.unitPrice)}`} trailing={<Text style={{ fontWeight: '800', color: palette.ink, fontSize: 13 }}>{money(item.lineTotal)}</Text>} />)}</Panel>
    <SectionTitle title={`Photos from buyer · ${photos.length}`} />
    <Panel>{photos.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{photos.map((uri, i) => <Image key={`${uri}:${i}`} source={{ uri }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: palette.greenSoft }} />)}</View> : <Text style={{ color: palette.muted }}>The buyer did not attach photos.</Text>}</Panel>
    <SectionTitle title="Progress" />
    <Panel>{steps.map(([label, at]) => <DataRow key={String(label)} title={String(label)} detail={fmtDate(at)} />)}</Panel>
  </SellerFrame>;
}
