import { useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { AlertBanner, InfoRow, ListRow, PillButton, Screen, SectionCard, Text, palette } from '../../../../components/ui';
import { useAction } from '../../../../hooks/useAction';
import { merchantApi } from '../../../../lib/marketplace/api';
import { LIMITS } from '../../../../lib/marketplace/constants';
import { BULK_CSV_COLUMNS, csvToProducts } from '../../../../lib/marketplace/csv';
import type { BulkResult, Json } from '../../../../lib/marketplace/types';

export default function BulkProductsScreen() {
  const { run, isBusy } = useAction();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Json[]>([]);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState('');

  const choose = async () => {
    setError(''); setResult(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain'], multiple: false, copyToCacheDirectory: true });
    if (picked.canceled) return;
    const file = picked.assets[0];
    try {
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error('Could not read that file.');
      const products = csvToProducts(await response.text());
      if (products.length > LIMITS.bulkRows) throw new Error(`A single import can hold up to ${LIMITS.bulkRows} products. This file has ${products.length}.`);
      setFileName(file.name); setRows(products);
    } catch (cause) { setRows([]); setFileName(''); setError(cause instanceof Error ? cause.message : 'Could not read that file.'); }
  };

  const submit = async () => { const outcome = await run('bulk', () => merchantApi.bulkProducts(rows)); if (outcome) setResult(outcome); };

  return <Screen title="Bulk add products" subtitle="Import many products from a CSV file" onBack={() => router.back()}>
    <SectionCard title="1. Prepare your file" subtitle="First row must be the column names">
      <Text style={{ color: palette.body, fontSize: 13, lineHeight: 20 }}>{BULK_CSV_COLUMNS.join(' · ')}</Text>
      <Text style={{ color: palette.muted, fontSize: 12, marginTop: 6 }}>Title, Category, Subcategory, MRP and Selling Price are required. Up to {LIMITS.bulkRows} rows per import.</Text>
    </SectionCard>
    <SectionCard title="2. Choose the file">
      <PillButton variant="soft" icon="fileText" title={fileName || 'Choose CSV file'} onPress={() => void choose()} />
      {rows.length ? <InfoRow label="Products found" value={rows.length} /> : null}
    </SectionCard>
    {error ? <AlertBanner tone="red" icon="shield" title="Could not use this file" message={error} /> : null}
    {rows.length ? <SectionCard title="Preview" subtitle="First 5 rows">
      {rows.slice(0, 5).map((row, index) => <ListRow key={index} title={String(row.title ?? `Row ${index + 1}`)} detail={[row.category, row.subcategory, row.sellingPrice != null ? `₹${row.sellingPrice}` : ''].filter(Boolean).join(' · ')} />)}
    </SectionCard> : null}
    {rows.length && !result ? <PillButton title={`Import ${rows.length} products`} icon="check" loading={isBusy('bulk')} onPress={() => void submit()} /> : null}
    {result ? <View style={{ gap: 12 }}>
      <AlertBanner tone={result.failed?.length ? 'amber' : 'green'} icon="check" title={`${result.created ?? 0} of ${result.total ?? rows.length} products created`}
        message={result.failed?.length ? 'Some rows need fixing. Correct them in your file and import those rows again.' : 'Your products have been added.'} />
      {result.failed?.length ? <SectionCard title="Rows that failed">
        {result.failed.map(item => <ListRow key={item.row} title={`Row ${item.row}${item.title ? ` · ${item.title}` : ''}`} detail={item.message} />)}
      </SectionCard> : null}
      <PillButton title="View products" variant="soft" onPress={() => router.replace('/store/products' as never)} />
    </View> : null}
  </Screen>;
}
