import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LeadCard } from '../../../components/marketplace/LeadCard';
import { ResponseStatsCard } from '../../../components/marketplace/ResponseStatsCard';
import { EmptyState, FilterChips, LoadMoreButton, PillButton, Screen, Text, palette } from '../../../components/ui';
import { usePagedList } from '../../../hooks/usePagedList';
import { merchantApi } from '../../../lib/marketplace/api';
import { LEAD_STATUSES, LIMITS } from '../../../lib/marketplace/constants';
import { humanize } from '../../../lib/marketplace/format';
import type { Json, Lead, ListResponse } from '../../../lib/marketplace/types';

export default function LeadsScreen() {
  const [status, setStatus] = useState('');
  const list = usePagedList<Lead, ListResponse<Lead> & { responseStats?: Json }>(async page => {
    // Response-rate stats live on the store profile; failing to load them must not hide the leads.
    const [leads, store] = await Promise.all([merchantApi.leads({ status: status || undefined, page, limit: LIMITS.listPageSize }), page === 1 ? merchantApi.store().catch(() => null) : Promise.resolve(null)]);
    return { ...leads, responseStats: store?.responseStats };
  }, lead => lead._id, [status], { refetchOnFocus: true });

  const counts = list.data?.counts ?? {};
  const allCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const options = [{ value: '', label: 'All', count: allCount }, ...LEAD_STATUSES.map(value => ({ value, label: humanize(value), count: counts[value] ?? 0 }))];

  return <Screen title="Leads & enquiries" subtitle="Buyers asking about your products" refreshing={list.refreshing} onRefresh={() => void list.refresh()}
    error={list.error && !list.data ? list.error : ''} onRetry={() => void list.reload()}
    action={<PillButton compact variant="soft" icon="fileText" title="Form" onPress={() => router.push('/store/questions' as never)} />}>
    <ResponseStatsCard stats={list.data?.responseStats} />
    <FilterChips options={options} value={status} onChange={setStatus} />
    {list.loading ? <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 30 }}>Loading enquiries…</Text>
      : list.items.length ? <View style={{ gap: 12 }}>
        {list.items.map(lead => <LeadCard key={lead._id} lead={lead} onOpen={() => router.push({ pathname: '/store/lead/[id]', params: { id: lead._id } } as never)} />)}
        <LoadMoreButton shown={list.items.length} total={list.total} loading={list.loadingMore} onPress={() => void list.loadMore()} />
      </View>
      : <EmptyState icon="inbox" title={status ? `No ${humanize(status).toLowerCase()} enquiries` : 'No enquiries yet'}
        message={status ? 'Try another status.' : 'When a buyer enquires about one of your products, it shows up here and you get an SMS or email alert.'} />}
  </Screen>;
}
