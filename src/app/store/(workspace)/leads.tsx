import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { DatePickerField } from '../../../components/realtor/DatePickerField';
import { LeadCard } from '../../../components/marketplace/LeadCard';
import { ResponseStatsCard } from '../../../components/marketplace/ResponseStatsCard';
import { EmptyState, FilterChips, LoadMoreButton, PillButton, Screen, SearchField, Text, palette } from '../../../components/ui';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { usePagedList } from '../../../hooks/usePagedList';
import { merchantApi } from '../../../lib/marketplace/api';
import { LEAD_STATUSES, LIMITS } from '../../../lib/marketplace/constants';
import { humanize } from '../../../lib/marketplace/format';
import { DateField, MAX_FILTERED_PAGES, fetchLeadsForFiltering, matchesDateRange, matchesSearch } from '../../../lib/marketplace/leadFilters';
import type { Json, Lead, ListResponse } from '../../../lib/marketplace/types';

export default function LeadsScreen() {
  const [status, setStatus] = useState('');
  const list = usePagedList<Lead, ListResponse<Lead> & { responseStats?: Json }>(async page => {
    // Response-rate stats live on the store profile; failing to load them must not hide the leads.
    const [leads, store] = await Promise.all([merchantApi.leads({ status: status || undefined, page, limit: LIMITS.listPageSize }), page === 1 ? merchantApi.store().catch(() => null) : Promise.resolve(null)]);
    return { ...leads, responseStats: store?.responseStats };
  }, lead => lead._id, [status], { refetchOnFocus: true });

  // The leads request only filters by status, so search and dates are applied here, over every page loaded while one is on.
  const [query, setQuery] = useState('');
  const [dateField, setDateField] = useState<DateField>('createdAt');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const badRange = !!from && !!to && to < from;
  const filtering = !!query || !!from || !!to;
  const all = useAsyncData(async () => (filtering ? fetchLeadsForFiltering(status) : null), [filtering, status], { refetchOnFocus: true });
  const shown = !filtering ? list.items : badRange ? [] : (all.data?.items ?? []).filter(lead => matchesSearch(lead, query) && matchesDateRange(lead, dateField, from, to));
  const busy = filtering ? all.loading : list.loading;
  const dateMeaning = dateField === 'createdAt' ? 'the day the enquiry was received' : 'the day the buyer needs the supply';
  const dateHint = from || to ? `Dates are matched against ${dateMeaning}.` : `Choose From or To below. Dates will be matched against ${dateMeaning}.`;
  const clearFilters = () => { setQuery(''); setFrom(''); setTo(''); };

  const counts = list.data?.counts ?? {};
  const allCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const options = [{ value: '', label: 'All', count: allCount }, ...LEAD_STATUSES.map(value => ({ value, label: humanize(value), count: counts[value] ?? 0 }))];

  return <Screen title="Leads & enquiries" subtitle="Buyers asking about your products" refreshing={list.refreshing || all.refreshing} onRefresh={() => { void list.refresh(); if (filtering) void all.refresh(); }}
    error={list.error && !list.data ? list.error : ''} onRetry={() => void list.reload()}
    action={<PillButton compact variant="soft" icon="fileText" title="Form" onPress={() => router.push('/store/questions' as never)} />}>
    <ResponseStatsCard stats={list.data?.responseStats} />
    <SearchField value={query} onChange={setQuery} placeholder="Search buyer, product, phone, location" />
    <FilterChips options={options} value={status} onChange={setStatus} />
    <FilterChips options={[{ value: 'createdAt', label: 'Received date' }, { value: 'requiredBy', label: 'Required-by date' }]} value={dateField} onChange={value => setDateField(value as DateField)} />
    <Text style={{ color: palette.body, fontSize: 12.5, lineHeight: 18 }}>{dateHint}</Text>
    <DatePickerField label="From" value={from} onChange={setFrom} placeholder="Any date" />
    <DatePickerField label="To" value={to} onChange={setTo} placeholder="Any date" />
    {badRange ? <Text style={{ color: palette.red, fontSize: 12.5, fontWeight: '700' }}>The “To” date is earlier than the “From” date.</Text> : null}
    {filtering ? <PillButton compact variant="soft" icon="x" title="Clear search and dates" onPress={clearFilters} /> : null}
    {filtering && all.data?.truncated ? <Text style={{ color: palette.muted, fontSize: 11.5 }}>Only the latest {MAX_FILTERED_PAGES * LIMITS.listMaxPageSize} enquiries are searched.</Text> : null}
    {busy ? <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 30 }}>Loading enquiries…</Text>
      : filtering && all.error ? <EmptyState icon="inbox" title="Could not search enquiries" message={all.error} actionLabel="Try again" onAction={() => void all.reload()} />
      : shown.length ? <View style={{ gap: 12 }}>
        {shown.map(lead => <LeadCard key={lead._id} lead={lead} onOpen={() => router.push({ pathname: '/store/lead/[id]', params: { id: lead._id } } as never)} />)}
        {filtering ? null : <LoadMoreButton shown={list.items.length} total={list.total} loading={list.loadingMore} onPress={() => void list.loadMore()} />}
      </View>
      : filtering ? <EmptyState icon="inbox" title="No enquiries match" message="Try a different search or date range." />
      : <EmptyState icon="inbox" title={status ? `No ${humanize(status).toLowerCase()} enquiries` : 'No enquiries yet'}
        message={status ? 'Try another status.' : 'When a buyer enquires about one of your products, it shows up here and you get an SMS or email alert.'} />}
  </Screen>;
}
