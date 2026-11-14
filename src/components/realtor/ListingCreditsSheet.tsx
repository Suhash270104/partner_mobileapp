import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CashfreeCheckout } from '../studio/CashfreeCheckout';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { BottomSheet, PillButton } from './RealtorControls';
import { AlertBanner, IconTile } from './RealtorUi';
import { CashfreeOrder, PartnerApiError, partnerApi } from '../../lib/partnerApi';

type Data = Record<string, any>;
const rupees = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : ''; };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Buy Listing Credits (REAL_ESTATE_LISTING_PACK). Pack name, credits and price always come from GET /pricing,
 * the server adds the credits once the Cashfree order is PAID, and the caller re-fetches the profile afterwards.
 */
export function ListingCreditsSheet({ visible, title = 'Buy Listing Credits to Post a Property', reason, onClose, onPurchased }: { visible: boolean; title?: string; reason?: string; onClose: () => void; onPurchased: () => void }) {
  const [packs, setPacks] = useState<Data[]>([]);
  const [order, setOrder] = useState<CashfreeOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(''); setInfo('');
    partnerApi.call<Data>('/pricing')
      .then(result => { if (alive) setPacks(Array.isArray(result.realEstateListingPacks) ? result.realEstateListingPacks : []); })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'Could not load listing packs.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible]);

  async function buy(pack: Data) {
    setBusy(true); setError(''); setInfo('');
    try { setOrder(await partnerApi.createCashfreeOrder({ itemType: 'REAL_ESTATE_LISTING_PACK', itemId: String(pack.id || pack._id), buyerType: 'realtor' }) as CashfreeOrder); }
    catch (cause) { setError(cause instanceof PartnerApiError ? cause.message : 'Could not start checkout.'); }
    finally { setBusy(false); }
  }

  async function finishCheckout() {
    const current = order; setOrder(null);
    if (!current) return;
    setBusy(true); setError(''); setInfo('');
    try {
      let status = 'PENDING';
      for (let attempt = 0; attempt < 4 && status === 'PENDING'; attempt += 1) {
        if (attempt) await wait(2500);
        status = (await partnerApi.call<{ status: string }>('/payments/cashfree/verify', 'POST', { orderId: current.orderId, buyerType: 'realtor' })).status;
      }
      if (status === 'PAID') { onClose(); onPurchased(); }
      else if (status === 'PENDING') setInfo('Your payment is still processing. Credits are added automatically once it completes — pull down on the dashboard to refresh.');
      else if (status === 'FAILED') setError('Payment failed. You have not been charged for credits — please try again.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not verify payment.'); }
    finally { setBusy(false); }
  }

  return <>
    <BottomSheet visible={visible} onClose={onClose} title="" tall>
      <View style={s.center}>
        <IconTile icon="coins" tone="green" size={72} />
        <Text style={s.title}>{title}</Text>
        <Text style={s.copy}>Each property or project listing uses 1 credit. Credits never expire and activate instantly upon payment.</Text>
      </View>
      {reason ? <AlertBanner tone="amber" icon="zap" title={reason} /> : null}
      {error ? <AlertBanner tone="red" icon="shield" title="Something went wrong" message={error} /> : null}
      {info ? <AlertBanner tone="blue" icon="clock" title="Payment processing" message={info} /> : null}
      {loading ? <Text style={s.copy}>Loading listing packs…</Text> : null}
      {!loading && !packs.length && !error ? <Text style={s.copy}>No listing packs are available right now.</Text> : null}
      {packs.map(pack => {
        const credits = Number(pack.credits), price = Number(pack.price);
        const per = credits > 0 && price > 0 ? Math.round(price / credits) : 0;
        return <View key={String(pack.id || pack._id)} style={s.pack}>
          <View style={s.packTop}>
            <View style={{ flex: 1, gap: 6 }}>
              {pack.badge ? <View style={s.badge}><Icon name="sparkles" size={14} color={palette.greenText} /><Text style={s.badgeText}>{String(pack.badge).toUpperCase()}</Text></View> : null}
              <Text style={s.packName}>{String(pack.name || 'Listing pack')}</Text>
              {pack.promo || pack.description ? <Text style={s.copyLeft}>{String(pack.promo || pack.description)}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={s.price}>{rupees(price)}</Text>
              {per ? <View style={s.per}><Text style={s.perText}>{rupees(per)} / listing</Text></View> : null}
            </View>
          </View>
          <View style={s.divider} />
          {[`${credits} Postings: List up to ${credits} properties or projects`, 'No Expiration: Credits remain in your wallet until used', 'Direct Leads: Buyer contact info, phone and WhatsApp enquiries', 'Verified Badge: Higher visibility on the Kraftnex marketplace'].map(line => {
            const [head, ...rest] = line.split(': ');
            return <View key={line} style={s.bullet}><Icon name="check" size={18} color={palette.greenText} /><Text style={s.bulletText}><Text style={{ fontWeight: '800' }}>{head}:</Text> {rest.join(': ')}</Text></View>;
          })}
          <PillButton title={`Pay ${rupees(price)} & Unlock ${credits} Credits`} icon="lock" onPress={() => void buy(pack)} loading={busy} />
        </View>;
      })}
      <View style={s.secure}><Icon name="shield" size={18} color={palette.greenText} /><Text style={s.secureText}>100% Secure Checkout via Cashfree · Instant Activation</Text></View>
      <Text style={s.copy}>Supports UPI (GPay, PhonePe, Paytm), Credit/Debit Cards and Net Banking.</Text>
    </BottomSheet>
    <CashfreeCheckout order={order} onClose={() => void finishCheckout()} />
  </>;
}

const s = StyleSheet.create({
  center: { alignItems: 'center', gap: 10 }, title: { color: palette.ink, fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 30 }, copy: { color: palette.body, fontSize: 14, lineHeight: 21, textAlign: 'center' }, copyLeft: { color: palette.body, fontSize: 14, lineHeight: 20 },
  pack: { borderWidth: 2, borderColor: '#8fd3b3', borderRadius: 24, backgroundColor: '#f6fcf9', padding: 16, gap: 12 }, packTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ecf8f2', borderWidth: 1, borderColor: '#bfe9d6', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }, badgeText: { color: palette.greenText, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  packName: { color: palette.ink, fontSize: 21, fontWeight: '800' }, price: { color: palette.ink, fontSize: 28, fontWeight: '800' }, per: { backgroundColor: '#ecf8f2', borderWidth: 1, borderColor: '#bfe9d6', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }, perText: { color: palette.greenText, fontSize: 12, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#bfe0cf' }, bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, bulletText: { flex: 1, color: '#33463f', fontSize: 15, lineHeight: 22 },
  secure: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, secureText: { color: palette.greenText, fontSize: 14, fontWeight: '800', flexShrink: 1 },
});
