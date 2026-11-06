import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c } from '../../../components/professional/onboardingUi';

interface Transaction {
  orderId: string;
  itemType: string;
  itemId?: string;
  billingInterval?: string;
  grantedCredits?: number;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  fulfilledAt?: string;
}

const ITEM_LABEL: Record<string, string> = { LEAD_UNLOCK: 'Lead Unlock', PROFESSIONAL_UNLOCK: 'Professional Unlock', SUBSCRIPTION: 'Subscription', CREDIT_TOPUP: 'Credit Top-up' };

// What was actually bought, spelled out: plan tier and billing cycle for a subscription, pack name for a top-up.
function describe(txn: Transaction): string {
  if (txn.itemType === 'SUBSCRIPTION') {
    const interval = txn.billingInterval === 'yearly' ? 'Yearly' : 'Monthly';
    const credits = typeof txn.grantedCredits === 'number' ? ` · ${txn.grantedCredits} AI Studio credits/mo` : '';
    return `${txn.itemId || 'Plan'} Subscription (${interval})${credits}`;
  }
  if (txn.itemType === 'CREDIT_TOPUP') return `AI Credit Top-up${txn.itemId ? ` (${txn.itemId})` : ''}`;
  return ITEM_LABEL[txn.itemType] || txn.itemType;
}

// The endpoint only returns rows already filtered to a paid status; this just normalizes the stored value.
function statusLabel(status: string): string {
  const lower = (status || '').toLowerCase();
  if (lower === 'paid' || lower === 'success' || lower === 'fulfilled') return 'Paid';
  return status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Paid';
}

export default function PaymentsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Leads are unlocked by spending a prepaid credit, which never creates its own payment row, so the
  // unlocked count comes from the leads list.
  const [unlocked, setUnlocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const [tx, leads] = await Promise.all([
        partnerApi.call<{ transactions?: Transaction[] }>('/payments/cashfree/transactions'),
        partnerApi.studioLeads().catch(() => []),
      ]);
      setTransactions(Array.isArray(tx.transactions) ? tx.transactions : []);
      setUnlocked(Array.isArray(leads) ? leads.length : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load payment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const total = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const latestPlan = transactions.find(t => t.itemType === 'SUBSCRIPTION');
  const plan = latestPlan?.itemId || 'No Active Plan';
  const credits = transactions.reduce((sum, t) => sum + (Number(t.grantedCredits) || 0), 0);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Payments & Invoices</Text>
      <Text style={s.sub}>Total spent to date: ₹{total.toLocaleString('en-IN')}</Text>

      <View style={s.tiles}>
        <View style={[s.tile, { backgroundColor: c.greenSoft }]}><Text style={s.tileValue}>₹{total.toLocaleString('en-IN')}</Text><Text style={s.tileLabel}>Total Spent</Text><Text style={s.tileFoot}>Across {transactions.length} transaction{transactions.length === 1 ? '' : 's'}</Text></View>
        <View style={[s.tile, { backgroundColor: '#fbeee4' }]}><Text style={s.tileValue}>{plan}</Text><Text style={s.tileLabel}>Active Plan</Text></View>
        <View style={[s.tile, { backgroundColor: c.greenSoft }]}><Text style={s.tileValue}>{unlocked}</Text><Text style={s.tileLabel}>Leads Unlocked</Text><Text style={s.tileFoot}>{credits > 0 ? `${credits} credits granted to date` : 'From prepaid credits'}</Text></View>
      </View>

      <View style={s.card}>
        <View style={s.head}><Text style={s.cardTitle}>Transaction History</Text><Text style={s.meta}>Billed via Cashfree</Text></View>
        {loading && <ActivityIndicator color={c.green} style={{ marginVertical: 20 }} />}
        {!!error && <View style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}><Text style={s.error}>{error}</Text><Pressable onPress={() => { setLoading(true); void load(); }}><Text style={s.link}>Retry</Text></Pressable></View>}
        {!loading && !error && transactions.length === 0 && (
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: 20 }}><Text style={s.emptyTitle}>No transactions yet.</Text><Text style={s.meta}>Lead unlock and subscription charges will appear here.</Text></View>
        )}
        {transactions.map(txn => (
          <View key={txn.orderId} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{describe(txn)}</Text>
              <Text style={s.meta}>{new Date(txn.fulfilledAt || txn.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={s.rowTitle}>₹{Number(txn.amount).toLocaleString('en-IN')}</Text>
              <View style={s.paid}><Text style={s.paidText}>{statusLabel(txn.status)}</Text></View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 14, padding: 12, minHeight: 92, justifyContent: 'space-between', gap: 4 },
  tileValue: { color: c.ink, fontSize: 16, fontWeight: '800' },
  tileLabel: { color: c.body, fontSize: 11, fontWeight: '700' },
  tileFoot: { color: c.muted, fontSize: 10 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  meta: { color: c.muted, fontSize: 11.5 },
  error: { color: c.red, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  emptyTitle: { color: c.body, fontSize: 13.5, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  rowTitle: { color: c.ink, fontSize: 13.5, fontWeight: '800' },
  paid: { backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  paidText: { color: c.greenText, fontSize: 10.5, fontWeight: '800' },
});
