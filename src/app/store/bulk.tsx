import { useState } from 'react';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { DataRow, PageHeading, Panel, PrimaryButton, StatePanel, VerticalFrame } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { merchantApi } from '../../lib/partnerVerticalApi';
import { PartnerApiError } from '../../lib/partnerApi';

const tabs = [{ key: 'overview', label: 'Home', icon: '⌂' }, { key: 'products', label: 'Products', icon: '▦' }, { key: 'leads', label: 'Enquiries', icon: '◎' }, { key: 'orders', label: 'Orders', icon: '▤' }, { key: 'settings', label: 'More', icon: '•••' }];
type Result = { created?: number; failed?: { row: number; title?: string; message: string }[]; total?: number };
function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"' && quoted && source[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
      row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(values => values.some(value => value.length));
}
const headerKey = (value: string) => value.toLowerCase().replace(/\(.*?\)|\*/g, '').replace(/[^a-z%]+/g, ' ').trim();
const listValue = (value: unknown) => String(value ?? '').split(/[;,\n]/).map(item => item.trim()).filter(Boolean);
function rowToProduct(row: Record<string, string>) {
  const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [headerKey(key), value]));
  const get = (...keys: string[]) => keys.map(key => values[key]).find(value => value !== undefined) || '';
  const number = (value: string) => value.trim() ? Number(value.replace(/[₹,\s]/g, '')) : undefined;
  const priceIncludes = get('price includes gst yes no', 'price includes tax').toLowerCase();
  const state = get('status published draft').toLowerCase();
  const specs: Record<string, unknown> = {};
  for (const key of ['material', 'finish', 'color', 'thickness', 'weight']) if (values[key]) specs[key] = values[key];
  const warranty = number(get('warranty years'));
  if (warranty !== undefined) specs.warrantyYears = warranty;
  const product: Record<string, unknown> = {
    title: get('title'), brand: get('brand') || undefined, sku: get('sku') || undefined, description: get('description') || undefined,
    category: get('category'), subcategory: get('subcategory'), mrp: number(get('mrp')), sellingPrice: number(get('selling price')),
    gstPercentage: number(get('gst %', 'gst')), priceIncludesTax: priceIncludes ? ['yes', 'y', 'true', '1', 'included', 'inclusive'].includes(priceIncludes) : undefined,
    unit: get('unit') || 'piece', unitLabel: get('unit label') || undefined,
    stockQuantity: number(get('stock quantity')), lowStockThreshold: number(get('low stock alert', 'low stock threshold')),
    minOrderQuantity: number(get('min order qty', 'min order quantity')), maxOrderQuantity: number(get('max order qty', 'max order quantity')),
    photos: listValue(get('photo urls comma separated', 'photos')).slice(0, 12), tags: listValue(get('tags comma separated', 'tags')).map(v => v.toLowerCase()),
    status: state === 'draft' ? 'draft' : 'published', specifications: specs,
  };
  return Object.fromEntries(Object.entries(product).filter(([, value]) => value !== undefined && (!Array.isArray(value) || value.length) && (typeof value !== 'object' || value === null || Array.isArray(value) || Object.keys(value as object).length)));
}

export default function BulkProducts() {
  const [fileName, setFileName] = useState('');
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function chooseCsv() {
    setError(''); setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'], multiple: false, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Choose a CSV export. The mobile app accepts CSV files and validates all rows through the marketplace API.'); return; }
    try {
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error('Could not read the selected CSV file.');
      const rows = parseCsv(await response.text());
      if (rows.length < 2) throw new Error('The CSV must contain a header row and at least one product row.');
      const headers = rows[0].map(value => value.replace(/^\uFEFF/, '').trim());
      const parsed = rows.slice(1).map(values => rowToProduct(Object.fromEntries(headers.map((header, index) => [header, values[index] || '']))));
      setFileName(file.name); setProducts(parsed);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read CSV.'); }
  }
  async function submit() {
    if (!products.length) return;
    if (products.length > 500) { setError('The backend accepts up to 500 product rows per import.'); return; }
    setBusy(true); setError('');
    try { setResult(await merchantApi.bulkProducts(products) as Result); }
    catch (e) {
      const partial = e instanceof PartnerApiError && e.data && typeof e.data === 'object' ? e.data as Result : null;
      if (partial?.failed) setResult(partial);
      else setError(e instanceof Error ? e.message : 'The marketplace rejected this import.');
    }
    finally { setBusy(false); }
  }
  return <VerticalFrame title="Bulk add products" subtitle="Catalogue import" tabs={tabs} activeTab="products" onTab={() => router.replace('/store/dashboard' as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="PRODUCT CATALOGUE" title="Import products from CSV" subtitle="Choose a CSV using the marketplace product column names. The backend validates and reports each row." />
    <Panel><Text style={{ color: '#10231c', fontWeight: '800' }}>Import file</Text><Text style={{ color: '#4d5f57', fontSize: 12, lineHeight: 18 }}>Required fields: title, category, subcategory, mrp, sellingPrice, and unit. Other product fields follow the marketplace catalogue API. Rows are validated individually by the server.</Text>
      <PrimaryButton title="Choose CSV file" onPress={() => void chooseCsv()} />{fileName ? <DataRow title={fileName} detail={`${products.length} product rows`} /> : null}
    </Panel>
    {error ? <StatePanel title="Import could not continue" message={error} /> : null}
    {products.length ? <Panel><Text style={{ color: '#10231c', fontWeight: '800' }}>Preview · first 5 rows</Text>{products.slice(0, 5).map((p, index) => <DataRow key={index} title={String(p.title || `Row ${index + 1}`)} detail={[p.category, p.subcategory, p.unit, p.sellingPrice].filter(Boolean).join(' · ')} />)}
      <PrimaryButton title={`Submit ${products.length} rows`} onPress={() => void submit()} loading={busy} disabled={products.length > 500} />
    </Panel> : null}
    {result ? <Panel tint><Text style={{ color: '#17684b', fontWeight: '800' }}>Created {result.created || 0} of {result.total || products.length} products</Text>{result.failed?.map(row => <DataRow key={row.row} title={row.title || `Row ${row.row}`} detail={row.message} status="failed" />)}<PrimaryButton title="Back to products" onPress={() => router.replace('/store/dashboard' as never)} /></Panel> : null}
  </VerticalFrame>;
}
