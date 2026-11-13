import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Field, PageHeading, Panel, PrimaryButton, SelectChips, StatePanel, VerticalFrame } from '../../../components/vertical/VerticalUi';
import { Text } from '../../../components/AppText';
import { merchantApi } from '../../../lib/partnerVerticalApi';
import { partnerApi } from '../../../lib/partnerApi';

const tabs = [{ key: 'overview', label: 'Home', icon: '⌂' }, { key: 'products', label: 'Products', icon: '▦' }, { key: 'leads', label: 'Enquiries', icon: '◎' }, { key: 'orders', label: 'Orders', icon: '▤' }, { key: 'settings', label: 'More', icon: '•••' }];
const empty = { title: '', brand: '', sku: '', description: '', category: '', subcategory: '', mrp: '', sellingPrice: '', priceType: 'fixed', unit: 'piece', gstPercentage: '18', stockQuantity: '', lowStockThreshold: '5', minOrderQuantity: '1', leadTimeDays: '', unitLabel: '', tags: '', photos: '' };
const units = ['piece', 'set', 'box', 'sq_ft', 'sq_m', 'sheet', 'meter', 'pair', 'kg', 'liter', 'pack', 'bag', 'tonne', 'quintal', 'cu_ft', 'cu_m', 'brass', 'running_ft', 'roll', 'bundle', 'carton', 'load'];

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState(empty);
  const [categories, setCategories] = useState<{ name: string; subcategories: string[] }[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof empty) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  useEffect(() => {
    let alive = true;
    Promise.all([
      id ? merchantApi.product(String(id)) : Promise.resolve(null),
      partnerApi.call<Record<string, any>>('/marketplace/shop/home'),
    ]).then(([productResult, home]) => {
      if (!alive) return;
      const cats = home.categories || home.data?.categories || [];
      setCategories(cats.map((category: any) => ({ name: String(category.name || category.category || ''), subcategories: (category.subcategories || []).map((s: any) => String(s.name || s)) })).filter((x: any) => x.name));
      const p = productResult?.product as Record<string, any> | undefined;
      if (p) {
        setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(k => [k, k === 'tags' || k === 'photos' ? (p[k] || []).join(', ') : p[k] == null ? '' : String(p[k])])) });
        setPhotos(Array.isArray(p.photos) ? p.photos : []);
      }
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load catalogue settings.'); });
    return () => { alive = false; };
  }, [id]);
  async function addPhotos() {
    if (photos.length >= 12) { setError('A product can have at most 12 photos.'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library permission is required to add product photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 12 - photos.length, quality: 0.9 });
    if (result.canceled) return;
    setBusy(true); setError('');
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const mime = asset.mimeType || 'image/jpeg';
        const init = await merchantApi.initMedia({ purpose: 'product', fileName: asset.fileName || `product-${Date.now()}.jpg`, fileType: mime, fileSize: asset.fileSize });
        const blobResponse = await fetch(asset.uri);
        if (!blobResponse.ok) throw new Error('Could not read selected product photo.');
        const blob = await blobResponse.blob();
        const upload = await fetch(String(init.uploadUrl), { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
        if (!upload.ok) throw new Error(`Image storage upload failed (${upload.status}).`);
        const complete = await merchantApi.completeMedia(String(init.imageId));
        const image = complete.image as Record<string, string>;
        uploaded.push(image.mediumUrl || image.url);
      }
      setPhotos(current => [...current, ...uploaded]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Product photo upload failed.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!form.title.trim() || !form.category || !form.subcategory || !form.unit) { setError('Title, category, subcategory, and unit are required.'); return; }
    if (!form.mrp || !form.sellingPrice || !Number.isFinite(Number(form.mrp)) || !Number.isFinite(Number(form.sellingPrice))) { setError('Enter valid price values.'); return; }
    const input: Record<string, any> = {
      title: form.title.trim(), brand: form.brand.trim(), sku: form.sku.trim(), description: form.description,
      category: form.category, subcategory: form.subcategory, mrp: Number(form.mrp), sellingPrice: Number(form.sellingPrice),
      priceType: form.priceType, unit: form.unit, unitLabel: form.unitLabel.trim(), gstPercentage: Number(form.gstPercentage),
      stockQuantity: Number(form.stockQuantity || 0), lowStockThreshold: Number(form.lowStockThreshold || 0), minOrderQuantity: Number(form.minOrderQuantity || 1),
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null,
      photos, tags: form.tags.split(',').map(v => v.trim()).filter(Boolean), status: 'published',
    };
    setBusy(true); setError('');
    try { await merchantApi.saveProduct(input, id ? String(id) : undefined); router.replace('/store/dashboard' as never); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this product.'); }
    finally { setBusy(false); }
  }
  const category = categories.find(c => c.name === form.category);
  return <VerticalFrame title={id ? 'Edit product' : 'New product'} subtitle="Marketplace catalogue" tabs={tabs} activeTab="products" onTab={key => router.replace(`/store/dashboard?tab=${key}` as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="PRODUCT CATALOGUE" title={id ? 'Edit product' : 'Add a product'} subtitle="Product details, pricing, tax, supply and inventory." />
    {error ? <StatePanel title="Could not load or save" message={error} /> : null}
    <Panel><Text style={{ fontWeight: '800' }}>Product details</Text>
      <Field label="Product name" value={form.title} onChangeText={set('title')} />
      <Field label="Brand" value={form.brand} onChangeText={set('brand')} />
      <Field label="SKU" value={form.sku} onChangeText={set('sku')} />
      <Field label="Description" value={form.description} onChangeText={set('description')} multiline />
      {categories.length ? <SelectChips label="Category" values={categories.map(c => c.name)} selected={form.category} onChange={v => setForm(prev => ({ ...prev, category: String(v), subcategory: '' }))} /> : <Field label="Category from marketplace catalogue" value={form.category} onChangeText={set('category')} helper="Catalogue categories are loaded from the marketplace API." />}
      {category?.subcategories.length ? <SelectChips label="Subcategory" values={category.subcategories} selected={form.subcategory} onChange={v => set('subcategory')(String(v))} /> : <Field label="Subcategory" value={form.subcategory} onChangeText={set('subcategory')} />}
    </Panel>
    <Panel><Text style={{ fontWeight: '800' }}>Pricing & GST</Text>
      <SelectChips label="Price type" values={['fixed', 'range', 'on_request']} selected={form.priceType} onChange={v => set('priceType')(String(v))} />
      <Field label="MRP" value={form.mrp} onChangeText={set('mrp')} keyboardType="decimal-pad" />
      <Field label="Selling price" value={form.sellingPrice} onChangeText={set('sellingPrice')} keyboardType="decimal-pad" />
      <Field label="GST percentage" value={form.gstPercentage} onChangeText={set('gstPercentage')} keyboardType="decimal-pad" />
      <SelectChips label="Unit" values={units} selected={form.unit} onChange={v => set('unit')(String(v))} />
      <Field label="Custom unit label" value={form.unitLabel} onChangeText={set('unitLabel')} />
    </Panel>
    <Panel><Text style={{ fontWeight: '800' }}>Supply & inventory</Text>
      <Field label="Stock quantity" value={form.stockQuantity} onChangeText={set('stockQuantity')} keyboardType="numeric" />
      <Field label="Low stock warning at" value={form.lowStockThreshold} onChangeText={set('lowStockThreshold')} keyboardType="numeric" />
      <Field label="Minimum order quantity" value={form.minOrderQuantity} onChangeText={set('minOrderQuantity')} keyboardType="numeric" />
      <Field label="Lead time (days)" value={form.leadTimeDays} onChangeText={set('leadTimeDays')} keyboardType="numeric" />
      <Text style={{ color: '#33463f', fontSize: 12, fontWeight: '800' }}>Product photos · {photos.length}/12</Text>
      <PrimaryButton title="Choose and upload photos" onPress={() => void addPhotos()} loading={busy} disabled={photos.length >= 12} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{photos.map((uri, index) => <Image key={`${uri}:${index}`} source={{ uri }} style={{ width: 72, height: 72, borderRadius: 10 }} />)}</View>
      <Field label="Tags (comma separated)" value={form.tags} onChangeText={set('tags')} />
    </Panel>
    <PrimaryButton title={id ? 'Save changes' : 'Publish product'} loading={busy} onPress={() => void save()} />
  </VerticalFrame>;
}
