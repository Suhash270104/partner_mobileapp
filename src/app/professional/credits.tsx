import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Icon } from '../../components/Icon';
import { CashfreeCheckout } from '../../components/studio/CashfreeCheckout';
import { PartnerApiError, partnerApi, PublicPlan, CashfreeOrder } from '../../lib/partnerApi';
import { isValidPhone, sanitizePhoneInput } from '../../lib/authValidation';
import { c } from '../../components/professional/onboardingUi';

// "Buy credits": the partner-app copy of the customer app's Plans & Credits page. Same plan cards, credit
// options, Cashfree checkout and server-side verification; the amount is always priced by the backend.
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function featureText(raw: unknown, credits: number): string {
  const text = typeof raw === 'string' ? raw : (raw as { text?: string; label?: string })?.text ?? (raw as { label?: string })?.label ?? '';
  if (!/AI Studio Credits/i.test(text)) return text;
  return text.replace(/^[\d,]+\s*AI Studio Credits per month\s*\([^)]*\)/i, `${credits.toLocaleString('en-IN')} AI Studio credits per month`);
}

function bestValueCredits(plan: PublicPlan): number | null {
  const tiers = plan.creditTiers || [];
  if (tiers.length < 2) return null;
  return [...tiers].sort((a, b) => a.monthlyPrice / a.credits - b.monthlyPrice / b.credits)[0].credits;
}

export default function BuyCreditsScreen() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [buying, setBuying] = useState<string | null>(null);
  const [order, setOrder] = useState<CashfreeOrder | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [phoneAsk, setPhoneAsk] = useState<{ plan: PublicPlan; credits: number } | null>(null);
  const [phone, setPhone] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [bonus, setBonus] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    const [pricing, profile] = await Promise.allSettled([partnerApi.publicPricing(), partnerApi.professionalProfile()]);
    if (pricing.status === 'fulfilled') setPlans(Array.isArray(pricing.value.subscriptions) ? pricing.value.subscriptions : []);
    else setError(pricing.reason instanceof Error ? pricing.reason.message : 'Could not load plans.');
    if (profile.status === 'fulfilled') {
      setCredits(typeof profile.value.leadCredits === 'number' ? profile.value.leadCredits : null);
      setBonus(typeof profile.value.bonusLeadCredits === 'number' ? profile.value.bonusLeadCredits : null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const tiersOf = (plan: PublicPlan) => plan.creditTiers || [];
  const selectedCredits = (plan: PublicPlan): number => picked[plan.id] ?? tiersOf(plan)[0]?.credits ?? plan.credits ?? 0;

  function priceFor(plan: PublicPlan, creditCount: number) {
    const tiers = tiersOf(plan);
    const tier = tiers.find(t => t.credits === creditCount) ?? tiers[0];
    const base = tier?.monthlyPrice ?? plan.monthlyPrice ?? 0;
    // A live promo discounts the plan's default option; the server re-prices at checkout regardless.
    const isDefault = !tier || tier === tiers[0];
    const promo = plan.promo?.isLive && isDefault && plan.promo.monthlyPrice != null ? plan.promo.monthlyPrice : null;
    return { base, promo };
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function startCheckout(plan: PublicPlan, creditCount: number, checkoutPhone?: string) {
    setNotice(null);
    setBuying(plan.id);
    try {
      const created = await partnerApi.createCashfreeOrder({
        itemType: 'SUBSCRIPTION', itemId: plan.id, billingInterval: 'monthly', credits: creditCount, buyerType: 'designer',
        ...(checkoutPhone ? { checkoutPhone } : {}),
      });
      if (!created.success || !created.paymentSessionId) throw new Error(created.message || 'Unable to start payment. Please try again.');
      setOrder(created);
    } catch (cause) {
      if (cause instanceof PartnerApiError && cause.code === 'PHONE_REQUIRED') { setPhoneAsk({ plan, credits: creditCount }); setBuying(null); return; }
      const message = cause instanceof PartnerApiError && cause.status === 401
        ? 'You are not signed in, so payment cannot start. Sign in and try again.'
        : cause instanceof Error ? cause.message : 'Unable to start payment.';
      setNotice({ ok: false, text: message });
      Alert.alert('Could not start payment', message);
      setBuying(null);
    }
  }

  // Closing the checkout proves nothing: only the backend's own verification decides the outcome.
  async function onCheckoutClosed() {
    const closing = order;
    setOrder(null);
    if (!closing) return;
    try {
      const result = await partnerApi.verifyCashfreeOrder(closing.orderId, 'designer');
      if (result.status === 'PAID') {
        setNotice({ ok: true, text: 'Payment successful - your plan and credits are updated.' });
        setPicked({});
      } else if (result.status === 'PENDING') {
        setNotice({ ok: true, text: 'Your payment is still processing. Credits will appear once it is confirmed.' });
      } else {
        setNotice({ ok: false, text: 'Payment was not completed. Your plan has not changed.' });
      }
      await load();
    } catch (cause) {
      setNotice({ ok: false, text: cause instanceof Error ? cause.message : 'Could not confirm your payment.' });
    } finally {
      setBuying(null);
    }
  }

  function submitPhone() {
    const ask = phoneAsk;
    if (!ask || !isValidPhone(phone)) { setNotice({ ok: false, text: 'Enter a valid 10-digit mobile number.' }); return; }
    setPhoneAsk(null);
    void startCheckout(ask.plan, ask.credits, phone);
  }

  const creditsLine = useMemo(() => {
    if (credits === null) return 'Credits unavailable right now';
    if (bonus === null) return `${credits.toLocaleString('en-IN')} lead credits available`;
    return `${credits.toLocaleString('en-IN')} lead credits · ${bonus} free welcome unlocks left`;
  }, [credits, bonus]);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <Pressable onPress={() => router.navigate('/professional/clients' as never)} hitSlop={10} style={st.back} accessibilityRole="button" accessibilityLabel="Back to clients">
          <Icon name="chevronLeft" size={22} color={c.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.eyebrow}>LEAD CREDITS</Text>
          <Text style={st.title}>Plans & Credits</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <View style={st.current}>
          <Text style={st.curEyebrow}>YOUR CREDITS</Text>
          <Text style={st.curName}>{credits === null ? '—' : credits.toLocaleString('en-IN')}</Text>
          <Text style={st.curCopy}>{creditsLine}</Text>
        </View>

        {!!notice && <View style={[st.notice, notice.ok ? st.noticeOk : st.noticeBad]}><Text style={st.noticeText}>{notice.text}</Text></View>}

        {loading && <ActivityIndicator color={c.green} style={{ marginTop: 40 }} />}
        {!!error && !loading && (
          <View style={st.errBox}>
            <Text style={st.errText}>{error}</Text>
            <Pressable style={st.retry} onPress={() => { setLoading(true); void load(); }}><Text style={st.retryText}>Try again</Text></Pressable>
          </View>
        )}

        {plans.map(plan => {
          const creditCount = selectedCredits(plan);
          const price = priceFor(plan, creditCount);
          const tiers = tiersOf(plan);
          const leads = plan.projectLeadUnlocksPerMonth;
          const badge = plan.promo?.isLive && plan.promo.label ? plan.promo.label : plan.badge;
          return (
            <View key={plan.id} style={[st.card, plan.isPopular && st.cardPopular]}>
              <View style={st.cardTop}>
                <Text style={st.planName}>{plan.name || plan.id}</Text>
                {!!badge && <Text style={st.badge}>{badge}</Text>}
              </View>
              {!!plan.subtitle && <Text style={st.sub}>{plan.subtitle}</Text>}

              <View style={st.priceRow}>
                <Text style={st.price}>{inr(price.promo ?? price.base)}</Text>
                <Text style={st.per}>/ month</Text>
                {price.promo != null && <Text style={st.strike}>{inr(price.base)}</Text>}
              </View>
              <Text style={st.meta}>
                {creditCount ? `${creditCount.toLocaleString('en-IN')} AI credits per month` : 'Monthly plan'}{leads ? `${creditCount ? ' - ' : ''}${leads} lead unlocks` : ''}
              </Text>

              {tiers.length > 1 && (
                <View style={st.tiers}>
                  <Text style={st.tiersLabel}>CHOOSE YOUR CREDITS</Text>
                  {tiers.map(t => {
                    const on = t.credits === creditCount;
                    const best = t.credits === bestValueCredits(plan);
                    return (
                      <Pressable key={t.credits} style={[st.tier, on && st.tierOn]} onPress={() => setPicked(p => ({ ...p, [plan.id]: t.credits }))} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                        <View style={[st.radio, on && st.radioOn]}>{on && <Icon name="check" size={12} color="#fff" strokeWidth={3.2} />}</View>
                        <View style={{ flex: 1 }}>
                          <View style={st.tierTitleRow}>
                            <Text style={st.tierCredits}>{t.credits.toLocaleString('en-IN')} credits</Text>
                            {best && <Text style={st.bestTag}>BEST VALUE</Text>}
                          </View>
                          <Text style={st.tierSub}>per month</Text>
                        </View>
                        <Text style={[st.tierPrice, on && { color: c.green }]}>{inr(t.monthlyPrice)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {plan.featureSections?.map((section, i) => (
                <View key={i} style={{ marginTop: 10 }}>
                  {!!section.title && <Text style={st.secTitle}>{section.title}</Text>}
                  {(section.items ?? section.features ?? []).map((item, j) => (
                    <View key={j} style={st.featureRow}><Icon name="check" size={14} color={c.greenText} strokeWidth={2.6} /><Text style={st.feature}>{featureText(item, creditCount)}</Text></View>
                  ))}
                </View>
              ))}

              <Pressable style={[st.cta, buying === plan.id && { opacity: 0.6 }]} disabled={!!buying} onPress={() => void startCheckout(plan, creditCount)}>
                <Text style={st.ctaText}>{buying === plan.id ? 'Starting checkout...' : `Get ${plan.name || plan.id}`}</Text>
              </Pressable>
            </View>
          );
        })}
        {!loading && !error && plans.length === 0 && <Text style={st.empty}>No plans are available right now.</Text>}
        <Text style={st.foot}>Prices are set securely by Kraftnex at checkout. Payments are processed by Cashfree.</Text>
      </ScrollView>

      <CashfreeCheckout order={order} onClose={() => void onCheckoutClosed()} />

      <Modal transparent visible={!!phoneAsk} animationType="fade" onRequestClose={() => setPhoneAsk(null)}>
        <View style={st.scrim}>
          <View style={st.sheet}>
            <Text style={st.sheetTitle}>Add a mobile number</Text>
            <Text style={st.sheetCopy}>Payment needs a contact number. We&apos;ll save it to your profile.</Text>
            <TextInput value={phone} onChangeText={value => setPhone(sanitizePhoneInput(value))} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile number" placeholderTextColor="#98a0ab" style={st.input} />
            <View style={st.sheetRow}>
              <Pressable style={st.ghost} onPress={() => setPhoneAsk(null)}><Text style={st.ghostText}>Cancel</Text></Pressable>
              <Pressable style={st.solid} onPress={submitPhone}><Text style={st.solidText}>Continue</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  curName: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 6 },
  curCopy: { fontSize: 12, color: '#c3dccf', marginTop: 6 },
  notice: { borderRadius: 14, padding: 12 },
  noticeOk: { backgroundColor: c.greenSoft },
  noticeBad: { backgroundColor: c.redSoft },
  noticeText: { fontSize: 12, fontWeight: '700', color: c.ink },
  errBox: { backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.line },
  errText: { color: c.red, fontSize: 13, textAlign: 'center' },
  retry: { backgroundColor: c.green, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: c.line },
  cardPopular: { borderColor: c.green, borderWidth: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 20, fontWeight: '800', color: c.ink },
  badge: { fontSize: 10, fontWeight: '800', color: c.amber, backgroundColor: c.amberSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  sub: { fontSize: 12, color: c.muted, marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 },
  price: { fontSize: 30, fontWeight: '800', color: c.ink },
  per: { fontSize: 12, color: c.muted },
  strike: { fontSize: 13, color: c.muted, textDecorationLine: 'line-through' },
  meta: { fontSize: 12, fontWeight: '700', color: c.green, marginTop: 4 },
  tiers: { marginTop: 16, gap: 8 },
  tiersLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, color: c.muted, marginBottom: 2 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  tierOn: { borderColor: c.green, backgroundColor: c.mint },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c3d3cc', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: c.green, borderColor: c.green },
  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tierCredits: { fontSize: 15, fontWeight: '800', color: c.ink },
  tierSub: { fontSize: 11, color: c.muted, marginTop: 2 },
  tierPrice: { fontSize: 16, fontWeight: '800', color: c.ink },
  bestTag: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: '#fff', backgroundColor: c.greenText, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden' },
  secTitle: { fontSize: 10, fontWeight: '800', color: c.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 4 },
  feature: { flex: 1, fontSize: 12, color: '#3d4a52', lineHeight: 18 },
  cta: { backgroundColor: c.green, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { textAlign: 'center', color: c.muted, marginTop: 30 },
  foot: { textAlign: 'center', fontSize: 11, color: c.muted },
  scrim: { flex: 1, backgroundColor: 'rgba(8,20,15,.55)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 22, padding: 22 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: c.ink },
  sheetCopy: { fontSize: 13, color: c.muted, marginTop: 6, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: c.ink },
  sheetRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghost: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.line, paddingVertical: 12, alignItems: 'center' },
  ghostText: { fontWeight: '700', color: c.muted },
  solid: { flex: 1, borderRadius: 12, backgroundColor: c.green, paddingVertical: 12, alignItems: 'center' },
  solidText: { fontWeight: '800', color: '#fff' },
});
