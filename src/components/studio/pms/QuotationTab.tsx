import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText, Field } from '../../professional/onboardingUi';

// Designer side of the desktop QuotationWorkspace: site measurements and the modular quotation
// builder over the Kraftnex catalog. Talks only to /execution/{catalog,measurements,quotations}.
interface Measurement { _id: string; room: string; lengthFt?: number | null; widthFt?: number | null; faciaAreaSqft?: number | null }
interface CatalogItem { _id: string; brand: string; category: string; name: string; unitPrice: number; unit: string }
interface CartLine { catalogItemId: string; name: string; category: string; unitPrice: number; qty: number }
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
interface Quotation { _id: string; version: number; lineItems: { name: string; category?: string; qty: number; unitPrice: number; total: number }[]; laborCost: number; taxPct: number; subtotal: number; taxAmount: number; grandTotal: number; status: QuoteStatus; note?: string }

const STATUS: Record<QuoteStatus, { bg: string; fg: string }> = {
  draft: { bg: '#eef1f0', fg: c.body }, sent: { bg: c.amberSoft, fg: c.amber }, accepted: { bg: c.mint, fg: c.greenText }, rejected: { bg: c.redSoft, fg: c.red },
};
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const number = (value: string) => value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

export function QuotationTab({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [labor, setLabor] = useState('0');
  const [tax, setTax] = useState('18');
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [roomForm, setRoomForm] = useState(false);
  const [room, setRoom] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [savingRoom, setSavingRoom] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const [meas, items, names, quoteRes] = await Promise.all([
        partnerApi.call<{ measurements?: Measurement[] }>(`/execution/projects/${projectId}/measurements`),
        partnerApi.call<{ items?: CatalogItem[] }>('/execution/catalog'),
        partnerApi.call<{ categories?: string[] }>('/execution/catalog/categories'),
        partnerApi.call<{ quotations?: Quotation[] }>(`/execution/projects/${projectId}/quotations`),
      ]);
      setMeasurements(meas.measurements || []);
      setCatalog(items.items || []);
      setCategories(names.categories || []);
      setQuotes(quoteRes.quotations || []);
      setCategory(current => current || names.categories?.[0] || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the quotation workspace.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function addRoom() {
    if (!room.trim()) return;
    setSavingRoom(true);
    try {
      const res = await partnerApi.call<{ measurement?: Measurement }>(`/execution/projects/${projectId}/measurements`, 'POST', { room: room.trim(), lengthFt: length ? Number(length) : undefined, widthFt: width ? Number(width) : undefined });
      if (res.measurement) setMeasurements(list => [res.measurement!, ...list]);
      setRoom(''); setLength(''); setWidth(''); setRoomForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save the measurement.');
    } finally {
      setSavingRoom(false);
    }
  }

  function removeRoom(item: Measurement) {
    Alert.alert('Delete measurement?', item.room, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const previous = measurements;
          setMeasurements(list => list.filter(m => m._id !== item._id));
          try { await partnerApi.call(`/execution/measurements/${item._id}`, 'DELETE'); } catch { setMeasurements(previous); setError('Unable to delete the measurement.'); }
        },
      },
    ]);
  }

  const addToCart = (item: CatalogItem) => setCart(list => list.find(l => l.catalogItemId === item._id)
    ? list.map(l => (l.catalogItemId === item._id ? { ...l, qty: l.qty + 1 } : l))
    : [...list, { catalogItemId: item._id, name: item.name, category: item.category, unitPrice: item.unitPrice, qty: 1 }]);
  const setQty = (id: string, qty: number) => setCart(list => list.map(l => (l.catalogItemId === id ? { ...l, qty: Math.max(0, qty) } : l)).filter(l => l.qty > 0));

  const itemsTotal = useMemo(() => cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0), [cart]);
  const laborValue = Math.max(0, Number(labor) || 0);
  const subtotal = itemsTotal + laborValue;
  const taxAmount = subtotal * ((Number(tax) || 0) / 100);
  const grand = subtotal + taxAmount;

  async function send() {
    if (!cart.length) return;
    setSending(true);
    setError('');
    try {
      const res = await partnerApi.call<{ quotation?: Quotation }>(`/execution/projects/${projectId}/quotations`, 'POST', {
        lineItems: cart.map(l => ({ catalogItemId: l.catalogItemId, name: l.name, category: l.category, qty: l.qty, unitPrice: l.unitPrice })),
        laborCost: laborValue,
        taxPct: Number(tax) || 0,
      });
      if (res.quotation) setQuotes(list => [res.quotation!, ...list]);
      setCart([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send the quotation.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <ActivityIndicator color={c.green} style={{ marginTop: 30 }} />;
  const shown = category ? catalog.filter(item => item.category === category) : catalog;

  return (
    <View style={{ gap: 16 }}>
      {!!error && <ErrorText>{error}</ErrorText>}

      <View style={s.card}>
        <View style={s.head}>
          <View style={{ flex: 1 }}><Text style={s.title}>Site Measurements</Text><Text style={s.sub}>Room dimensions, carpet area, and facia calculations</Text></View>
          <Pressable style={s.add} onPress={() => setRoomForm(open => !open)}><Text style={s.addText}>{roomForm ? 'Close' : '＋ Add Room'}</Text></Pressable>
        </View>
        {roomForm && (
          <View>
            <Field value={room} onChangeText={setRoom} placeholder="Room — e.g. Master Bedroom" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field value={length} onChangeText={value => setLength(number(value))} placeholder="Length (ft)" keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field value={width} onChangeText={value => setWidth(number(value))} placeholder="Width (ft)" keyboardType="decimal-pad" /></View>
            </View>
            <Pressable style={[s.solid, (savingRoom || !room.trim()) && { opacity: 0.6 }]} disabled={savingRoom || !room.trim()} onPress={() => void addRoom()}>{savingRoom ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Save Room</Text>}</Pressable>
          </View>
        )}
        {measurements.length === 0 ? <Text style={s.empty}>No measurements logged yet.</Text> : measurements.map(item => (
          <View key={item._id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{item.room}</Text>
              <Text style={s.sub}>{item.lengthFt != null && item.widthFt != null ? `${item.lengthFt} ft × ${item.widthFt} ft` : ''}{item.faciaAreaSqft != null ? ` · ${item.faciaAreaSqft} sqft` : ''}</Text>
            </View>
            <Pressable onPress={() => removeRoom(item)} hitSlop={8}><Text style={s.delete}>Delete</Text></Pressable>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.title}>Modular Quotation Builder</Text>
        <Text style={s.sub}>Select materials from the Kraftnex catalog to construct a formal estimate</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {categories.map(name => (
            <Pressable key={name} style={[s.chip, category === name && s.chipOn]} onPress={() => setCategory(name)}><Text style={[s.chipText, category === name && { color: '#fff' }]}>{name}</Text></Pressable>
          ))}
        </ScrollView>
        {shown.length === 0 ? <Text style={s.empty}>No catalog items in this category.</Text> : shown.map(item => (
          <View key={item._id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{item.name}</Text>
              <Text style={s.sub}>{[item.brand, `${inr(item.unitPrice)} / ${item.unit}`].filter(Boolean).join(' · ')}</Text>
            </View>
            <Pressable style={s.addSmall} onPress={() => addToCart(item)}><Text style={s.addText}>＋ Add</Text></Pressable>
          </View>
        ))}

        {cart.length > 0 && (
          <View style={s.cart}>
            <Text style={s.rowTitle}>Your estimate</Text>
            {cart.map(line => (
              <View key={line.catalogItemId} style={s.row}>
                <View style={{ flex: 1 }}><Text style={s.rowTitle} numberOfLines={2}>{line.name}</Text><Text style={s.sub}>{inr(line.unitPrice)} each · {inr(line.qty * line.unitPrice)}</Text></View>
                <View style={s.stepper}>
                  <Pressable style={s.stepBtn} onPress={() => setQty(line.catalogItemId, line.qty - 1)}><Text style={s.stepText}>−</Text></Pressable>
                  <Text style={s.qty}>{line.qty}</Text>
                  <Pressable style={s.stepBtn} onPress={() => setQty(line.catalogItemId, line.qty + 1)}><Text style={s.stepText}>＋</Text></Pressable>
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}><Field label="LABOUR COST (₹)" value={labor} onChangeText={value => setLabor(number(value))} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="TAX (%)" value={tax} onChangeText={value => setTax(number(value))} keyboardType="decimal-pad" /></View>
            </View>
            <View style={s.totals}>
              <View style={s.totalRow}><Text style={s.sub}>Items</Text><Text style={s.rowTitle}>{inr(itemsTotal)}</Text></View>
              <View style={s.totalRow}><Text style={s.sub}>Labour</Text><Text style={s.rowTitle}>{inr(laborValue)}</Text></View>
              <View style={s.totalRow}><Text style={s.sub}>Tax ({Number(tax) || 0}%)</Text><Text style={s.rowTitle}>{inr(Math.round(taxAmount))}</Text></View>
              <View style={s.totalRow}><Text style={s.title}>Grand total</Text><Text style={s.title}>{inr(Math.round(grand))}</Text></View>
            </View>
            <Pressable style={[s.solid, sending && { opacity: 0.6 }]} disabled={sending} onPress={() => void send()}>{sending ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Send Quotation to Client</Text>}</Pressable>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.title}>Quotation History</Text>
        {quotes.length === 0 ? <Text style={s.empty}>No quotations sent yet.</Text> : quotes.map(quote => {
          const tone = STATUS[quote.status] || STATUS.draft;
          return (
            <View key={quote._id} style={s.quote}>
              <View style={s.head}>
                <Text style={s.rowTitle}>Version {quote.version}</Text>
                <View style={[s.pill, { backgroundColor: tone.bg }]}><Text style={[s.pillText, { color: tone.fg }]}>{quote.status.toUpperCase()}</Text></View>
              </View>
              <Text style={s.grand}>{inr(quote.grandTotal)}</Text>
              <Text style={s.sub}>{quote.lineItems.length} item{quote.lineItems.length === 1 ? '' : 's'} · Labour {inr(quote.laborCost)} · Tax {quote.taxPct}% ({inr(quote.taxAmount)})</Text>
              {quote.lineItems.map((line, index) => <Text key={`${line.name}-${index}`} style={s.line}>{line.qty} × {line.name} — {inr(line.total)}</Text>)}
              {!!quote.note && <Text style={s.sub}>{quote.note}</Text>}
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
  empty: { color: c.body, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  add: { backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addSmall: { backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  addText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  solid: { height: 46, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f6f8f7', borderRadius: 13, padding: 12 },
  rowTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  delete: { color: c.red, fontSize: 11.5, fontWeight: '800' },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#eef3f0' },
  chipOn: { backgroundColor: c.green },
  chipText: { color: c.body, fontSize: 12, fontWeight: '700' },
  cart: { gap: 8, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, paddingTop: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eaefec', borderRadius: 10 },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: c.green, fontSize: 18, fontWeight: '700' },
  qty: { minWidth: 24, textAlign: 'center', color: c.ink, fontWeight: '800' },
  totals: { backgroundColor: '#f1f5f3', borderRadius: 13, padding: 12, gap: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quote: { backgroundColor: '#f6f8f7', borderRadius: 14, padding: 12, gap: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: '800' },
  grand: { color: c.ink, fontSize: 22, fontWeight: '800' },
  line: { color: c.body, fontSize: 12.5 },
});
