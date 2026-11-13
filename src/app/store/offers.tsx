import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { BooleanField, DataRow, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SelectChips, StatePanel, StatusPill, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { FilterChips, InfoLine, Row, SellerFrame, fmtDate, idOf, money, pickAndUploadImage } from '../../components/vertical/SellerParts';
import { merchantApi } from '../../lib/partnerVerticalApi';

type Kind = 'promo' | 'sale' | 'offer';
const kinds = [{ key: 'promo', label: 'Promo codes' }, { key: 'sale', label: 'Flash sales' }, { key: 'offer', label: 'Store offers' }];
const toneFor = (s: string) => (/expired|used_up|paused/.test(s) ? 'amber' : /scheduled/.test(s) ? 'blue' : 'green') as 'green' | 'amber' | 'blue';

export default function ManageOffers() {
  const [kind, setKind] = useState<Kind>('promo');
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState('');
  const [busy, setBusy] = useState('');
  const [f, setF] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const set = (k: string) => (v: string) => setF(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (kind === 'promo') setRows(((await merchantApi.promoCodes()).promoCodes as Row[]) || []);
      else if (kind === 'sale') {
        const [sales, prods] = await Promise.all([merchantApi.flashSales(), merchantApi.products({ page: 1, limit: 50, status: 'published' })]);
        setRows((sales.flashSales as Row[]) || []); setProducts((prods.products as Row[]) || []);
      } else setRows(((await merchantApi.storeOffers()).offers as Row[]) || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this list.'); }
    finally { setLoading(false); }
  }, [kind]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, action: () => Promise<unknown>, after?: () => void) => {
    setBusy(id);
    try { await action(); after?.(); await load(); }
    catch (e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'The server rejected this change.'); }
    finally { setBusy(''); }
  };
  const confirmDelete = (label: string, id: string, action: () => Promise<unknown>) => Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [{ text: 'Keep', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(id, action) }]);
  const startEdit = (item: Row, init: Record<string, string>) => { setEditId(idOf(item)); setF(init); setPicked([]); };
  const stop = () => { setEditId(''); setF({}); setPicked([]); };
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : '');

  const renderPromo = (p: Row) => {
    const id = idOf(p);
    return <Panel key={id}>
      <DataRow title={String(p.code)} detail={`${p.discountType === 'percent' ? `${p.discountValue}% off` : p.discountType === 'flat' ? `${money(p.discountValue)} off` : 'Free shipping'} · min ${money(p.minOrderValue)}`} status={p.status} />
      <InfoLine label="Used" value={`${p.usedCount ?? 0}${p.usageLimit ? ` / ${p.usageLimit}` : ''}`} /><InfoLine label="Expires" value={p.expiresAt ? fmtDate(p.expiresAt) : 'No expiry'} />
      <BooleanField label="Active" value={p.isActive !== false} onChange={v => void run(id, () => merchantApi.savePromo({ isActive: v }, id))} />
      {editId === id ? <>
        <SelectChips label="Discount type" values={['percent', 'flat', 'free_shipping']} selected={f.discountType} onChange={v => set('discountType')(String(v))} />
        <Field label="Discount value" value={f.discountValue} onChangeText={set('discountValue')} keyboardType="decimal-pad" />
        <Field label="Minimum order value" value={f.minOrderValue} onChangeText={set('minOrderValue')} keyboardType="decimal-pad" />
        <Field label="Usage limit (blank = unlimited)" value={f.usageLimit} onChangeText={set('usageLimit')} keyboardType="numeric" />
        <Field label="Expires at (ISO date/time, blank = none)" value={f.expiresAt} onChangeText={set('expiresAt')} />
        <PrimaryButton title="Save changes" loading={busy === id} onPress={() => void run(id, () => merchantApi.savePromo({ discountType: f.discountType, discountValue: Number(f.discountValue || 0), minOrderValue: Number(f.minOrderValue || 0), usageLimit: f.usageLimit ? Number(f.usageLimit) : null, expiresAt: f.expiresAt || null }, id), stop)} />
        <SecondaryButton title="Cancel" onPress={stop} />
      </> : <View style={{ gap: 8 }}>
        <SecondaryButton title="Edit" onPress={() => startEdit(p, { discountType: String(p.discountType || 'percent'), discountValue: String(p.discountValue ?? ''), minOrderValue: String(p.minOrderValue ?? 0), usageLimit: p.usageLimit ? String(p.usageLimit) : '', expiresAt: iso(p.expiresAt) })} />
        <SecondaryButton title="Delete" onPress={() => confirmDelete('promo code', id, () => merchantApi.deletePromo(id))} /></View>}
    </Panel>;
  };

  const renderSale = (s: Row) => {
    const id = idOf(s);
    const inSale: Row[] = Array.isArray(s.products) ? s.products : [];
    return <Panel key={id}>
      <DataRow title={String(s.name)} detail={`${s.minimumDiscount}% min · ${fmtDate(s.startDate)} → ${fmtDate(s.endDate)}`} trailing={<StatusPill label={s.isPublished ? 'published' : 'draft'} tone={s.isPublished ? 'green' : 'amber'} />} />
      <BooleanField label="Published" value={Boolean(s.isPublished)} onChange={() => void run(id, () => merchantApi.publishFlashSale(id))} />
      {inSale.map(item => <DataRow key={String(item.productId)} title={String(item.title)} detail={`${money(item.originalPrice)} → ${money(item.salePrice)} (${item.discountPercentage}% off) · sold ${item.soldCount ?? 0}`}
        trailing={<SecondaryButton title="Remove" onPress={() => void run(id, () => merchantApi.removeFlashSaleProduct(id, String(item.productId)))} />} />)}
      {editId === id ? <>
        <Field label="Name" value={f.name} onChangeText={set('name')} /><Field label="Minimum discount (%)" value={f.minimumDiscount} onChangeText={set('minimumDiscount')} keyboardType="numeric" />
        <Field label="Start (ISO)" value={f.startDate} onChangeText={set('startDate')} /><Field label="End (ISO)" value={f.endDate} onChangeText={set('endDate')} />
        <Text style={{ color: '#33463f', fontSize: 11, fontWeight: '800', marginTop: 6 }}>Add products to this sale</Text>
        {products.length === 0 ? <Text style={{ color: palette.muted, fontSize: 12 }}>No published products available.</Text> : <SelectChips label="" multi values={products.map(x => String(x.title))} selected={picked.map(pid => String(products.find(x => idOf(x) === pid)?.title))}
          onChange={v => setPicked((v as string[]).map(t => idOf(products.find(x => String(x.title) === t) || {})).filter(Boolean))} />}
        <Field label="Discount for added products (%, blank = sale minimum)" value={f.productDiscount || ''} onChangeText={set('productDiscount')} keyboardType="numeric" />
        <PrimaryButton title="Save sale" loading={busy === id} onPress={() => void run(id, async () => {
          await merchantApi.saveFlashSale({ name: f.name, minimumDiscount: Number(f.minimumDiscount), startDate: f.startDate, endDate: f.endDate }, id);
          if (picked.length) await merchantApi.addFlashSaleProducts(id, picked.map(productId => ({ productId, discountPercentage: f.productDiscount ? Number(f.productDiscount) : undefined })));
        }, stop)} />
        <SecondaryButton title="Cancel" onPress={stop} />
      </> : <View style={{ gap: 8 }}>
        <SecondaryButton title="Edit sale and choose products" onPress={() => startEdit(s, { name: String(s.name || ''), minimumDiscount: String(s.minimumDiscount ?? ''), startDate: iso(s.startDate), endDate: iso(s.endDate) })} />
        <SecondaryButton title="Delete" onPress={() => confirmDelete('flash sale', id, () => merchantApi.deleteFlashSale(id))} /></View>}
    </Panel>;
  };

  const renderOffer = (o: Row) => {
    const id = idOf(o);
    return <Panel key={id}>
      {o.bannerImage ? <Image source={{ uri: String(o.bannerImage) }} style={{ width: '100%', height: 110, borderRadius: 12, backgroundColor: palette.greenSoft }} resizeMode="cover" /> : null}
      <DataRow title={String(o.title)} detail={String(o.description || '')} trailing={<StatusPill label={String(o.status || 'active')} tone={toneFor(String(o.status))} />} />
      <BooleanField label="Active" value={o.status === 'active'} onChange={v => void run(id, () => merchantApi.switchStoreOffer(id, { status: v ? 'active' : 'paused' }))} />
      <BooleanField label="Show on marketplace" value={Boolean(o.displayOnMarketplace)} onChange={v => void run(id, () => merchantApi.switchStoreOffer(id, { displayOnMarketplace: v }))} />
      {editId === id ? <>
        <Field label="Title" value={f.title} onChangeText={set('title')} /><Field label="Description" value={f.description} onChangeText={set('description')} multiline />
        {f.bannerImage ? <Image source={{ uri: f.bannerImage }} style={{ width: '100%', height: 110, borderRadius: 12 }} resizeMode="cover" /> : null}
        <PrimaryButton title="Choose banner image" loading={busy === `${id}:img`} onPress={() => void run(`${id}:img`, async () => { const url = await pickAndUploadImage('banner'); if (url) set('bannerImage')(url); })} />
        <Field label="Banner image URL" value={f.bannerImage} onChangeText={set('bannerImage')} />
        <PrimaryButton title="Save offer" loading={busy === id} onPress={() => void run(id, () => merchantApi.saveStoreOffer({ title: f.title, description: f.description, bannerImage: f.bannerImage }, id), stop)} />
        <SecondaryButton title="Cancel" onPress={stop} />
      </> : <View style={{ gap: 8 }}>
        <SecondaryButton title="Edit" onPress={() => startEdit(o, { title: String(o.title || ''), description: String(o.description || ''), bannerImage: String(o.bannerImage || '') })} />
        <SecondaryButton title="Delete" onPress={() => confirmDelete('offer', id, () => merchantApi.deleteStoreOffer(id))} /></View>}
    </Panel>;
  };

  return <SellerFrame title="Offers" subtitle="Promo codes, flash sales and offers" activeTab="settings">
    <PageHeading eyebrow="SELLER WORKSPACE" title="Manage offers" subtitle="Edit, pause, publish or delete your promotions. Create new ones from Offers & promotions." />
    <FilterChips options={kinds} value={kind} onChange={k => { stop(); setKind(k as Kind); }} />
    {error ? <StatePanel title="Offers unavailable" message={error} retry={() => void load()} /> : loading ? <Panel><Text style={{ color: palette.body }}>Loading…</Text></Panel>
      : rows.length === 0 ? <StatePanel title="Nothing here yet" message="Create one from Offers & promotions in the seller workspace." /> : rows.map(kind === 'promo' ? renderPromo : kind === 'sale' ? renderSale : renderOffer)}
  </SellerFrame>;
}
