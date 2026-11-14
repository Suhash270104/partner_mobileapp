import { useState } from 'react';
import { router } from 'expo-router';
import { BarChart, EmptyState, FilterChips, InfoRow, ListRow, Screen, SectionCard, StatCard, StatGrid, Text, palette } from '../../../components/ui';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { merchantApi } from '../../../lib/marketplace/api';
import { formatCompactMoney, formatMoney, formatNumber, isoDay } from '../../../lib/marketplace/format';
import type { Json } from '../../../lib/marketplace/types';

// Ranges are expressed in days back from today (IST). The custom set is intentionally short: a phone screen needs presets, not a calendar.
const RANGES = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }];
const shortDay = (iso: string) => iso.slice(8, 10);

interface Report { range?: { from: string; to: string }; sales?: Json; orders?: Json; topProducts?: Json[] }

/** Delivered-sales analytics. Legacy-order based: checkout is retired, so a store without older orders will show zeros. */
export default function AnalyticsScreen() {
  const [days, setDays] = useState('30');
  const { data, loading, error, reload, refresh, refreshing } = useAsyncData(() => merchantApi.analytics(isoDay(-(Number(days) - 1)), isoDay(0)) as Promise<Report>, [days]);
  const sales = data?.sales ?? {};
  const trend = ((sales.trend ?? []) as Json[]).map(point => ({ label: shortDay(String(point._id)), value: Number(point.grossSales) || 0 }));
  const orderTrend = (((data?.orders ?? {}) as Json).trend ?? []) as Json[];
  const top = data?.topProducts ?? [];
  const empty = !loading && !Number(sales.grossSales) && !Number((data?.orders as Json | undefined)?.total);

  return <Screen title="Analytics & reports" subtitle={data?.range ? `${data.range.from} to ${data.range.to}` : undefined} onBack={() => router.back()} refreshing={refreshing} onRefresh={() => void refresh()}
    loading={loading && !data} error={error && !data ? error : ''} onRetry={() => void reload()}>
    <FilterChips options={RANGES} value={days} onChange={setDays} />
    {loading ? null : empty ? <EmptyState icon="barChart" title="No sales in this period" message="Analytics are based on delivered orders. Try a longer range." /> : <>
      <StatGrid>
        <StatCard label="Gross sales" value={formatCompactMoney(sales.grossSales)} icon="rupee" tone="green" caption={`${formatNumber(sales.deliveredOrders)} delivered orders`} />
        <StatCard label="Orders placed" value={formatNumber((data?.orders as Json | undefined)?.total)} icon="clipboard" tone="blue" caption={`${orderTrend.filter(p => Number(p.orders) > 0).length} active days`} />
      </StatGrid>
      <SectionCard title="Daily sales">
        <BarChart data={trend} format={formatCompactMoney} />
      </SectionCard>
      <SectionCard title="Sales breakdown">
        <InfoRow label="Product subtotal" value={formatMoney(sales.subtotal)} />
        <InfoRow label="GST" value={formatMoney(sales.gst)} />
        <InfoRow label="Delivery charges" value={formatMoney(sales.deliveryCharges)} />
        <InfoRow label="Discounts" value={formatMoney(sales.discounts)} />
      </SectionCard>
      <SectionCard title="Top products">
        {top.length ? top.map((product, index) => <ListRow key={index} title={String(product.title ?? 'Product')} detail={`${formatNumber(product.quantity)} sold${product.sku ? ` · ${product.sku}` : ''}`} trailing={<Text style={{ color: palette.ink, fontSize: 14, fontWeight: '800' }}>{formatCompactMoney(product.salesValue)}</Text>} />)
          : <EmptyState icon="layers" title="No product sales yet" />}
      </SectionCard>
    </>}
  </Screen>;
}
