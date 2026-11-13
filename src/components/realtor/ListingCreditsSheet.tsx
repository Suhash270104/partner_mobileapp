import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CashfreeCheckout } from '../studio/CashfreeCheckout';
import { DataRow, Panel, PrimaryButton, StatePanel, palette } from '../vertical/VerticalUi';
import { Text } from '../AppText';
import { CashfreeOrder, PartnerApiError, partnerApi } from '../../lib/partnerApi';

type Data = Record<string, unknown>;
const entries = (value: unknown): Data[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Data[] : [];

export function ListingCreditsSheet({ visible, title, onClose, onPurchased }: { visible: boolean; title: string; onClose: () => void; onPurchased: () => void }) {
  const [packs, setPacks] = useState<Data[]>([]);
  const [order, setOrder] = useState<CashfreeOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    void partnerApi.call<Data>('/pricing').then(result => setPacks(entries(result.realEstateListingPacks))).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load listing packs.'));
  }, [visible]);

  async function buy(pack: Data) {
    setBusy(true); setError('');
    try { setOrder(await partnerApi.createCashfreeOrder({ itemType: 'REAL_ESTATE_LISTING_PACK', itemId: String(pack.id || pack._id) }) as CashfreeOrder); }
    catch (cause) { setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not start checkout.'); }
    finally { setBusy(false); }
  }

  async function finishCheckout() {
    const currentOrder = order; setOrder(null);
    if (!currentOrder) return;
    setBusy(true); setError('');
    try {
      const result = await partnerApi.call<{ status: string }>('/payments/cashfree/verify', 'POST', { orderId: currentOrder.orderId });
      if (result.status === 'PAID') { onClose(); onPurchased(); }
      else if (result.status !== 'USER_DROPPED') setError(`Payment status: ${result.status.toLowerCase()}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not verify payment.'); }
    finally { setBusy(false); }
  }

  return <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}><View style={s.sheet}>
        <View style={s.header}><Text style={s.title}>{title}</Text><Pressable onPress={onClose}><Text style={s.close}>×</Text></Pressable></View>
        <Text style={s.copy}>Each property or project post uses one credit. Available packs and prices are loaded from Kraftnex.</Text>
        {error ? <StatePanel title="Couldn’t load listing packs" message={error} /> : null}
        {packs.map(pack => <Panel key={String(pack.id || pack._id)}>
          <DataRow title={String(pack.name || '')} detail={`${String(pack.credits || '')} postings · ₹${String(pack.price || '')}`} status={pack.badge ? String(pack.badge) : undefined} />
          <PrimaryButton title="Buy pack" onPress={() => void buy(pack)} loading={busy} />
        </Panel>)}
        {!packs.length && !error ? <Text style={s.empty}>No listing packs are available right now.</Text> : null}
      </View></View>
    </Modal>
    <CashfreeCheckout order={order} onClose={() => void finishCheckout()} />
  </>;
}

const s = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,35,28,0.48)' }, sheet: { maxHeight: '85%', backgroundColor: palette.bg, padding: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { color: palette.ink, fontSize: 17, fontWeight: '800', flex: 1 }, close: { color: palette.muted, fontSize: 28 }, copy: { color: palette.body, fontSize: 12, lineHeight: 18 }, empty: { color: palette.muted, padding: 18, textAlign: 'center', fontSize: 12 } });
