import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBadge } from '../../../components/marketplace/StatusBadge';
import { AlertBanner, Badge, EmptyState, ListRow, PillButton, Screen, SectionCard, StatCard, StatGrid, Text, palette } from '../../../components/ui';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useStoreSession } from '../../../hooks/useStoreSession';
import { merchantApi } from '../../../lib/marketplace/api';
import { SUPPORT } from '../../../lib/marketplace/constants';
import { formatCompactMoney, formatNumber, isOpenNow, priceText, timeAgo } from '../../../lib/marketplace/format';
import type { DashboardMetrics, Lead, Product, Store } from '../../../lib/marketplace/types';

interface OverviewData { metrics: DashboardMetrics | null; store: Store | null; leads: Lead[]; newLeads: number; lowStock: Product[] }

const settle = <T,>(result: PromiseSettledResult<T>): T | null => (result.status === 'fulfilled' ? result.value : null);

export default function OverviewScreen() {
  const { merchant } = useStoreSession();
  const { data, loading, refreshing, error, reload, refresh } = useAsyncData<OverviewData>(async () => {
    const [metrics, store, leads, products] = await Promise.allSettled([
      merchantApi.metrics(), merchantApi.store(), merchantApi.leads({ limit: 5 }), merchantApi.products({ status: 'published', limit: 50 }),
    ]);
    // Overview is built from four calls; it only fails outright when every one of them does.
    if ([metrics, store, leads, products].every(r => r.status === 'rejected')) throw (metrics as PromiseRejectedResult).reason;
    const leadList = settle(leads);
    return {
      metrics: settle(metrics), store: settle(store), leads: leadList?.items ?? [], newLeads: leadList?.counts?.new ?? 0,
      lowStock: (settle(products)?.items ?? []).filter(p => p.isLowStock).slice(0, 5),
    };
  }, [], { refetchOnFocus: true });

  const kpis = data?.metrics?.kpis;
  const open = isOpenNow(data?.store?.operatingHours);
  const hasOrders = (data?.metrics?.orderTabs?.ALL ?? 0) > 0;
  const publicUrl = SUPPORT.siteUrl && (data?.store?.slug ?? merchant?.slug) ? `${SUPPORT.siteUrl}/store/${data?.store?.slug ?? merchant?.slug}` : '';
  const noLogo = !!data?.store && !data.store.logoUrl;

  return <Screen loading={loading} error={error && !data ? error : ''} onRetry={() => void reload()} refreshing={refreshing} onRefresh={() => void refresh()}>
    <View style={{ gap: 6 }}>
      <Text style={{ color: palette.ink, fontSize: 24, fontWeight: '800' }}>Welcome back</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {open !== null ? <Badge label={open ? 'Open now' : 'Closed now'} tone={open ? 'green' : 'slate'} icon="clock" /> : null}
        {publicUrl ? <PillButton compact variant="soft" icon="externalLink" title="View public store" onPress={() => void Linking.openURL(publicUrl)} /> : null}
      </View>
    </View>

    {data?.newLeads ? <AlertBanner tone="amber" icon="users" title={`${data.newLeads} new ${data.newLeads === 1 ? 'enquiry' : 'enquiries'} waiting`}
      message="Buyers wait for replies. Respond quickly to improve your response rate." actionLabel="Open leads" onAction={() => router.push('/store/leads' as never)} /> : null}
    {noLogo ? <AlertBanner tone="blue" icon="image" title="Add your store logo" message="Stores with a logo look more trustworthy to buyers." actionLabel="Add logo" onAction={() => router.push('/store/settings' as never)} /> : null}

    <StatGrid>
      <StatCard label="New enquiries" value={formatNumber(data?.newLeads ?? 0)} icon="users" tone="amber" caption="Waiting for your reply" onPress={() => router.push('/store/leads' as never)} />
      <StatCard label="Products listed" value={formatNumber(kpis?.totalListedProducts)} icon="layers" tone="green" caption={data?.metrics?.draftProducts ? `${data.metrics.draftProducts} drafts` : 'All published'} onPress={() => router.push('/store/products' as never)} />
      <StatCard label="Low-stock alerts" value={formatNumber(kpis?.lowStockCount)} icon="zap" tone="red" caption={data?.metrics?.outOfStockCount ? `${data.metrics.outOfStockCount} out of stock` : 'Stock looks healthy'} />
      {hasOrders ? <StatCard label="Total sales" value={formatCompactMoney(kpis?.totalRevenue)} icon="rupee" tone="blue" caption={`${formatNumber(kpis?.activeOrdersCount)} active orders`} onPress={() => router.push('/store/orders' as never)} /> : null}
    </StatGrid>

    <SectionCard title="Recent enquiries" actionLabel="View all" onAction={() => router.push('/store/leads' as never)}>
      {data?.leads.length ? data.leads.map(lead => <ListRow key={lead._id} title={lead.buyerName || 'Buyer'} detail={`${lead.productId?.title || lead.requirementTitle || 'Requirement'} · ${timeAgo(lead.createdAt)}`}
        trailing={<StatusBadge status={lead.status} />} unread={lead.status === 'new'} onPress={() => router.push({ pathname: '/store/lead/[id]', params: { id: lead._id } } as never)} />)
        : <EmptyState icon="inbox" title="No enquiries yet" message="When a buyer sends an enquiry for one of your products it appears here." />}
    </SectionCard>

    <SectionCard title="Low stock" subtitle="Products at or below their alert level">
      {data?.lowStock.length ? data.lowStock.map(product => <ListRow key={product._id} title={product.title} detail={`${product.stockQuantity ?? 0} left · ${priceText(product)}`}
        trailing={<PillButton compact variant="soft" title="Restock" onPress={() => router.push({ pathname: '/store/product/[id]', params: { id: product._id } } as never)} />} />)
        : <Text style={{ color: palette.body, fontSize: 13, paddingVertical: 8 }}>All published products are well stocked.</Text>}
    </SectionCard>
  </Screen>;
}
