import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { router } from 'expo-router';
import { partnerApi, StudioDashboardResponse } from '../../../lib/partnerApi';
import { formatRevenue } from '../../../lib/studioMoney';
import { c, ErrorText } from '../../../components/professional/onboardingUi';

type Row = NonNullable<StudioDashboardResponse['revenueBreakdown']>[number];

const dateOf = (iso?: string | null) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};

// Where the "Revenue earned" number on the dashboard comes from: one row per won project, with the
// amount counted for it. The rows always add up to the total because the server builds both together.
export default function RevenueScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const data = await partnerApi.studioDashboard();
      setRows(Array.isArray(data.revenueBreakdown) ? data.revenueBreakdown : []);
      setTotal(Number(data.revenueEarned || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your revenue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const average = rows.length > 0 ? total / rows.length : 0;
  const largest = rows.reduce<Row | null>((best, row) => (!best || row.amountLakhs > best.amountLakhs ? row : best), null);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Revenue</Text>
      <Text style={s.sub}>What makes up the revenue shown on your dashboard.</Text>

      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}
      {!!error && <ErrorText>{error}</ErrorText>}

      {!loading && !error && (
        <>
          <View style={s.hero}>
            <Text style={s.heroLabel}>TOTAL REVENUE</Text>
            <Text style={s.heroValue}>{formatRevenue(total)}</Text>
            <Text style={s.heroFoot}>From {rows.length} won project{rows.length === 1 ? '' : 's'}</Text>
          </View>

          <View style={s.tiles}>
            <View style={s.tile}><Text style={s.tileValue}>{rows.length}</Text><Text style={s.tileLabel}>Won projects</Text></View>
            <View style={s.tile}><Text style={s.tileValue}>{formatRevenue(average)}</Text><Text style={s.tileLabel}>Average per project</Text></View>
            <View style={s.tile}><Text style={s.tileValue}>{largest ? formatRevenue(largest.amountLakhs) : '₹0'}</Text><Text style={s.tileLabel}>Largest project</Text></View>
          </View>

          <Text style={s.section}>Won projects</Text>
          {rows.length === 0 ? (
            <View style={s.card}><Text style={s.empty}>No won projects yet. When a client accepts one of your proposals it is counted here.</Text></View>
          ) : rows.map(row => (
            <Pressable
              key={row.id || row.projectId}
              style={s.row}
              disabled={!row.projectId}
              onPress={() => router.navigate({ pathname: '/professional/project-details', params: { id: row.projectId } } as never)}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={2}>{row.title}</Text>
                <Text style={s.meta} numberOfLines={1}>{[row.clientName, dateOf(row.at), row.status].filter(Boolean).join(' · ')}</Text>
                <Text style={s.basis}>{row.basis === 'quote' ? `Your quote: ${row.quote || '—'}` : `Client budget: ${row.quote || '—'}`}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={s.amount}>{formatRevenue(row.amountLakhs)}</Text>
                {!!row.projectId && <Icon name="chevronRight" size={16} color={c.muted} />}
              </View>
            </Pressable>
          ))}

          <Text style={s.note}>
            Amounts come from the quote on each accepted proposal. For a project assigned to your studio without a proposal, the
            client&apos;s budget is used. Payments between you and your clients are not tracked here.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  title: { color: c.ink, fontSize: 22, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5 },
  hero: { backgroundColor: c.green, borderRadius: 18, padding: 18, gap: 4 },
  heroLabel: { color: '#bfe0cf', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  heroValue: { color: '#fff', fontSize: 30, fontWeight: '800' },
  heroFoot: { color: '#d7ece0', fontSize: 12.5 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12 },
  tileValue: { color: c.ink, fontSize: 16, fontWeight: '800' },
  tileLabel: { color: c.muted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  section: { color: c.ink, fontSize: 15, fontWeight: '800', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  empty: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  rowTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: c.muted, fontSize: 11.5, marginTop: 2 },
  basis: { color: c.greenText, fontSize: 11.5, fontWeight: '700', marginTop: 3 },
  amount: { color: c.ink, fontSize: 15, fontWeight: '800' },
  note: { color: c.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
});
