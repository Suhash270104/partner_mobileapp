import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Icon } from '../../components/Icon';
import { partnerApi, LeadCreditEntry } from '../../lib/partnerApi';
import { c } from '../../components/professional/onboardingUi';

const SOURCE_LABEL: Record<string, string> = {
  SUBSCRIPTION: 'Plan credits',
  LEAD_PACK_PURCHASE: 'Lead pack purchase',
  WELCOME_BONUS: 'Welcome bonus',
  LEAD_REFUND: 'Refund returned',
  LEAD_UNLOCK: 'Lead unlocked',
};

const dateText = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// "Where did my credits go": the studio's own GRANT / DEBIT lead-credit ledger plus the live balance.
export default function CreditHistoryScreen() {
  const [entries, setEntries] = useState<LeadCreditEntry[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [history, profile] = await Promise.allSettled([partnerApi.leadCreditHistory(), partnerApi.professionalProfile()]);
    if (history.status === 'fulfilled') setEntries(Array.isArray(history.value.entries) ? history.value.entries : []);
    else setError(history.reason instanceof Error ? history.reason.message : 'Could not load your credit history.');
    if (profile.status === 'fulfilled') {
      setCredits(typeof profile.value.leadCredits === 'number' ? profile.value.leadCredits : null);
      setBonus(typeof profile.value.bonusLeadCredits === 'number' ? profile.value.bonusLeadCredits : null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const granted = entries.filter(e => e.type === 'GRANT').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const spent = entries.filter(e => e.type === 'DEBIT').reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/professional/credits' as never))} hitSlop={10} style={st.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color={c.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.eyebrow}>LEAD CREDITS</Text>
          <Text style={st.title}>Credit history</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.green} />}>
        <View style={st.current}>
          <Text style={st.curEyebrow}>CURRENT BALANCE</Text>
          <Text style={st.curValue}>{credits === null ? '—' : credits.toLocaleString('en-IN')}</Text>
          <Text style={st.curCopy}>{bonus === null ? 'Plan lead credits' : `Plan credits · ${bonus} bonus (welcome & refunds) credits that never expire`}</Text>
        </View>

        <View style={st.tiles}>
          <View style={[st.tile, { backgroundColor: c.greenSoft }]}><Text style={st.tileValue}>+{granted.toLocaleString('en-IN')}</Text><Text style={st.tileLabel}>Credits received</Text></View>
          <View style={[st.tile, { backgroundColor: '#fbeee4' }]}><Text style={st.tileValue}>−{spent.toLocaleString('en-IN')}</Text><Text style={st.tileLabel}>Credits spent</Text></View>
        </View>

        <Pressable style={st.cta} onPress={() => router.navigate('/professional/credits' as never)}><Text style={st.ctaText}>Buy more credits</Text></Pressable>

        <View style={st.card}>
          <Text style={st.cardTitle}>Ledger</Text>
          {loading && <ActivityIndicator color={c.green} style={{ marginVertical: 20 }} />}
          {!!error && !loading && (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 14 }}>
              <Text style={st.error}>{error}</Text>
              <Pressable onPress={() => { setLoading(true); void load(); }}><Text style={st.link}>Retry</Text></Pressable>
            </View>
          )}
          {!loading && !error && entries.length === 0 && (
            <View style={{ alignItems: 'center', gap: 4, paddingVertical: 20 }}>
              <Text style={st.emptyTitle}>No credit activity yet.</Text>
              <Text style={st.meta}>Credits you receive or spend unlocking leads will appear here.</Text>
            </View>
          )}
          {entries.map((entry, index) => {
            const isGrant = entry.type === 'GRANT';
            const amount = Math.abs(Number(entry.amount) || 0);
            return (
              <View key={entry._id || `${entry.createdAt}-${index}`} style={st.row}>
                <View style={[st.dot, { backgroundColor: isGrant ? c.mint : '#fbeee4' }]}><Text style={[st.dotText, { color: isGrant ? c.greenText : '#b45a2a' }]}>{isGrant ? '+' : '−'}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.rowTitle}>{SOURCE_LABEL[entry.source] || entry.source}</Text>
                  <Text style={st.meta}>{dateText(entry.createdAt)}{entry.wallet ? ` · ${entry.wallet === 'BONUS' ? 'Bonus' : 'Plan'} wallet` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[st.rowTitle, { color: isGrant ? c.greenText : c.ink }]}>{isGrant ? '+' : '−'}{amount}</Text>
                  <Text style={st.meta}>Balance {entry.balanceAfter}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: c.line },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', color: c.muted, letterSpacing: 0.7 },
  title: { fontSize: 20, fontWeight: '800', color: c.ink },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  current: { backgroundColor: c.green, borderRadius: 20, padding: 18 },
  curEyebrow: { fontSize: 9, fontWeight: '800', color: '#9cc9b6', letterSpacing: 0.6 },
  curValue: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 6 },
  curCopy: { fontSize: 12, color: '#c3dccf', marginTop: 6 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 12, gap: 4 },
  tileValue: { color: c.ink, fontSize: 20, fontWeight: '800' },
  tileLabel: { color: c.body, fontSize: 11.5, fontWeight: '700' },
  cta: { backgroundColor: c.green, borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14 },
  cardTitle: { color: c.ink, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  meta: { color: c.muted, fontSize: 11.5 },
  error: { color: c.red, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  emptyTitle: { color: c.body, fontSize: 13.5, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 16, fontWeight: '800' },
  rowTitle: { color: c.ink, fontSize: 13.5, fontWeight: '800' },
});
