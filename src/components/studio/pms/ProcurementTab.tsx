import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../AppText';
import * as ImagePicker from 'expo-image-picker';
import { partnerApi } from '../../../lib/partnerApi';
import { generatedFileName, normalizeMime } from '../../../lib/professionalOnboarding';
import { c, ErrorText, Field } from '../../professional/onboardingUi';

// Designer side of the desktop ProcurementWorkspace. A procurement request and a purchase order are the
// same PurchaseOrder record at different statuses: request → approve → order → delivered.
interface Vendor { _id: string; name: string; category?: string; contactPhone?: string }
type POStatus = 'requested' | 'approved' | 'ordered' | 'delivered' | 'cancelled';
interface Line { name: string; qty: number; unitPrice: number; total: number }
interface Order { _id: string; vendorId?: { _id: string; name: string; category?: string } | null; lineItems: Line[]; totalAmount: number; status: POStatus; expectedDate?: string | null; deliveredAt?: string | null; deliveryPhotos?: string[]; notes?: string }

const STATUS: Record<POStatus, { bg: string; fg: string }> = {
  requested: { bg: '#eef1f0', fg: c.body }, approved: { bg: '#e6eefc', fg: '#2c5fb3' }, ordered: { bg: c.amberSoft, fg: c.amber }, delivered: { bg: c.mint, fg: c.greenText }, cancelled: { bg: c.redSoft, fg: c.red },
};
const NEXT: Partial<Record<POStatus, { next: POStatus; label: string }>> = { requested: { next: 'approved', label: 'Approve' }, approved: { next: 'ordered', label: 'Mark Ordered' } };
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const digits = (value: string) => value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

export function ProcurementTab({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorForm, setVendorForm] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);
  const [poForm, setPoForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [draft, setDraft] = useState<Line[]>([]);
  const [savingPo, setSavingPo] = useState(false);
  const [busyOrder, setBusyOrder] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [orderRes, vendorRes] = await Promise.all([
        partnerApi.call<{ orders?: Order[] }>(`/execution/projects/${projectId}/purchase-orders`),
        partnerApi.call<{ vendors?: Vendor[] }>('/execution/vendors'),
      ]);
      setOrders(orderRes.orders || []);
      setVendors(vendorRes.vendors || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load procurement.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function addVendor() {
    if (!vendorName.trim()) return;
    setSavingVendor(true);
    try {
      const res = await partnerApi.call<{ vendor?: Vendor }>('/execution/vendors', 'POST', { name: vendorName.trim(), category: vendorCategory.trim() || undefined });
      if (res.vendor) setVendors(list => [...list, res.vendor!].sort((a, b) => a.name.localeCompare(b.name)));
      setVendorName(''); setVendorCategory(''); setVendorForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add vendor.');
    } finally {
      setSavingVendor(false);
    }
  }

  function addItem() {
    if (!itemName.trim()) return;
    const qty = Number(itemQty) || 1;
    const unitPrice = Number(itemPrice) || 0;
    setDraft(list => [...list, { name: itemName.trim(), qty, unitPrice, total: qty * unitPrice }]);
    setItemName(''); setItemQty('1'); setItemPrice('');
  }

  async function createOrder() {
    if (!draft.length) return;
    setSavingPo(true);
    setError('');
    try {
      const res = await partnerApi.call<{ order?: Order }>(`/execution/projects/${projectId}/purchase-orders`, 'POST', { lineItems: draft.map(line => ({ name: line.name, qty: line.qty, unitPrice: line.unitPrice })) });
      if (res.order) setOrders(list => [res.order!, ...list]);
      setDraft([]); setPoForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to raise the purchase order.');
    } finally {
      setSavingPo(false);
    }
  }

  async function patchOrder(orderId: string, body: Record<string, unknown>, failure: string) {
    setBusyOrder(orderId);
    try {
      const res = await partnerApi.call<{ order?: Order }>(`/execution/purchase-orders/${orderId}`, 'PATCH', body);
      if (res.order) setOrders(list => list.map(order => (order._id === orderId ? res.order! : order)));
    } catch (e) {
      setError(e instanceof Error ? e.message : failure);
    } finally {
      setBusyOrder('');
    }
  }

  async function confirmDelivery(orderId: string) {
    setBusyOrder(orderId);
    setError('');
    try {
      let photoUrl: string | undefined;
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.granted) {
        const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
        if (!shot.canceled) {
          const asset = shot.assets[0];
          const name = asset.fileName || generatedFileName('delivery');
          photoUrl = (await partnerApi.uploadMedia({ uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name) }, 'progress')).publicUrl;
        }
      }
      const res = await partnerApi.call<{ order?: Order }>(`/execution/purchase-orders/${orderId}/delivery-confirm`, 'POST', { deliveryPhotos: photoUrl ? [photoUrl] : [] });
      if (res.order) setOrders(list => list.map(order => (order._id === orderId ? res.order! : order)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to confirm delivery.');
    } finally {
      setBusyOrder('');
    }
  }

  if (loading) return <ActivityIndicator color={c.green} style={{ marginTop: 30 }} />;

  return (
    <View style={{ gap: 16 }}>
      {!!error && <ErrorText>{error}</ErrorText>}

      <View style={s.card}>
        <View style={s.head}>
          <View style={{ flex: 1 }}><Text style={s.title}>Vendors</Text><Text style={s.sub}>Suppliers you can assign to purchase orders</Text></View>
          <Pressable style={s.add} onPress={() => setVendorForm(open => !open)}><Text style={s.addText}>{vendorForm ? 'Close' : '＋ Vendor'}</Text></Pressable>
        </View>
        {vendorForm && (
          <View>
            <Field value={vendorName} onChangeText={setVendorName} placeholder="Vendor name" />
            <Field value={vendorCategory} onChangeText={setVendorCategory} placeholder="Category (e.g. Plywood)" />
            <Pressable style={[s.solid, (savingVendor || !vendorName.trim()) && { opacity: 0.6 }]} disabled={savingVendor || !vendorName.trim()} onPress={() => void addVendor()}>{savingVendor ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Save Vendor</Text>}</Pressable>
          </View>
        )}
        {vendors.length === 0 ? <Text style={s.empty}>No vendors yet.</Text> : vendors.map(vendor => (
          <View key={vendor._id} style={s.row}><Text style={s.rowTitle}>{vendor.name}</Text>{!!vendor.category && <Text style={s.sub}>{vendor.category}</Text>}</View>
        ))}
      </View>

      <View style={s.card}>
        <View style={s.head}>
          <View style={{ flex: 1 }}><Text style={s.title}>Procurement & Purchase Orders</Text><Text style={s.sub}>Request, approve, order and confirm delivery</Text></View>
          <Pressable style={s.add} onPress={() => setPoForm(open => !open)}><Text style={s.addText}>{poForm ? 'Close' : '＋ Request'}</Text></Pressable>
        </View>
        {poForm && (
          <View>
            <Field value={itemName} onChangeText={setItemName} placeholder="Item — e.g. 18mm BWP plywood" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field value={itemQty} onChangeText={value => setItemQty(digits(value))} placeholder="Qty" keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field value={itemPrice} onChangeText={value => setItemPrice(digits(value))} placeholder="Unit price (₹)" keyboardType="decimal-pad" /></View>
            </View>
            <Pressable style={[s.outline, !itemName.trim() && { opacity: 0.5 }]} disabled={!itemName.trim()} onPress={addItem}><Text style={s.outlineText}>＋ Add item</Text></Pressable>
            {draft.map((line, index) => (
              <View key={`${line.name}-${index}`} style={[s.row, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}><Text style={s.rowTitle}>{line.name}</Text><Text style={s.sub}>{line.qty} × {inr(line.unitPrice)} = {inr(line.total)}</Text></View>
                <Pressable onPress={() => setDraft(list => list.filter((_, position) => position !== index))}><Text style={s.delete}>Remove</Text></Pressable>
              </View>
            ))}
            {draft.length > 0 && <Pressable style={[s.solid, savingPo && { opacity: 0.6 }]} disabled={savingPo} onPress={() => void createOrder()}>{savingPo ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Raise Purchase Order · {inr(draft.reduce((sum, line) => sum + line.total, 0))}</Text>}</Pressable>}
          </View>
        )}

        {orders.length === 0 ? <Text style={s.empty}>No purchase orders yet.</Text> : orders.map(order => {
          const tone = STATUS[order.status] || STATUS.requested;
          const next = NEXT[order.status];
          const busy = busyOrder === order._id;
          return (
            <View key={order._id} style={s.order}>
              <View style={s.head}>
                <Text style={s.rowTitle}>{order.vendorId?.name || 'No vendor assigned'}</Text>
                <View style={[s.pill, { backgroundColor: tone.bg }]}><Text style={[s.pillText, { color: tone.fg }]}>{order.status.toUpperCase()}</Text></View>
              </View>
              <Text style={s.grand}>{inr(order.totalAmount)}</Text>
              {order.lineItems.map((line, index) => <Text key={`${line.name}-${index}`} style={s.sub}>{line.qty} × {line.name} — {inr(line.total)}</Text>)}
              {!!order.expectedDate && <Text style={s.sub}>Expected {new Date(order.expectedDate).toLocaleDateString()}</Text>}
              {!!order.deliveredAt && <Text style={s.sub}>Delivered {new Date(order.deliveredAt).toLocaleDateString()}</Text>}
              {!!order.deliveryPhotos?.length && <View style={s.photos}>{order.deliveryPhotos.map(uri => <Image key={uri} source={{ uri }} style={s.photo} />)}</View>}

              {!order.vendorId && order.status === 'requested' && vendors.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={s.label}>ASSIGN VENDOR</Text>
                  <View style={s.chips}>{vendors.map(vendor => <Pressable key={vendor._id} style={s.chip} disabled={busy} onPress={() => void patchOrder(order._id, { vendorId: vendor._id }, 'Unable to assign vendor.')}><Text style={s.chipText}>{vendor.name}</Text></Pressable>)}</View>
                </View>
              )}
              {next && order.vendorId && <Pressable style={s.solid} disabled={busy} onPress={() => void patchOrder(order._id, { status: next.next }, 'Unable to update status.')}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>{next.label}</Text>}</Pressable>}
              {order.status === 'ordered' && <Pressable style={s.solid} disabled={busy} onPress={() => void confirmDelivery(order._id)}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Confirm Delivery (with photo)</Text>}</Pressable>}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: c.ink, fontSize: 16, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12, lineHeight: 17 },
  label: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  empty: { color: c.body, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  add: { backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  solid: { height: 46, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 10 },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  outline: { height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 13, fontWeight: '800' },
  row: { gap: 2, backgroundColor: '#f6f8f7', borderRadius: 13, padding: 12 },
  rowTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  delete: { color: c.red, fontSize: 11.5, fontWeight: '800' },
  order: { backgroundColor: '#f6f8f7', borderRadius: 14, padding: 12, gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: '800' },
  grand: { color: c.ink, fontSize: 20, fontWeight: '800' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 80, height: 80, borderRadius: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: c.green, fontSize: 12, fontWeight: '800' },
});
