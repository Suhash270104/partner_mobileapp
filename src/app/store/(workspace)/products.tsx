import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ProductCard } from '../../../components/marketplace/ProductCard';
import { BottomSheet, EmptyState, FilterChips, LoadMoreButton, PillButton, Screen, SearchField, SelectField, Text, palette } from '../../../components/ui';
import { useAction, confirmAction } from '../../../hooks/useAction';
import { usePagedList } from '../../../hooks/usePagedList';
import { useStoreSession } from '../../../hooks/useStoreSession';
import { useTaxonomy } from '../../../hooks/useTaxonomy';
import { merchantApi } from '../../../lib/marketplace/api';
import { LIMITS } from '../../../lib/marketplace/constants';
import type { Product } from '../../../lib/marketplace/types';

type Filter = 'all' | 'published' | 'draft' | 'archived' | 'low' | 'out';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' },
  { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' },
];
const SERVER_STATUS: Record<Filter, string> = { all: 'all', published: 'published', draft: 'draft', archived: 'archived', low: 'published', out: 'published' };

export default function ProductsScreen() {
  const { can } = useStoreSession();
  const { categories } = useTaxonomy();
  const { run, isBusy } = useAction();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [menuFor, setMenuFor] = useState<Product | null>(null);
  const canEdit = can('catalog'), canArchive = can('catalogDelete');

  const list = usePagedList<Product>(page => merchantApi.products({ status: SERVER_STATUS[filter], q: query || undefined, category: category || undefined, sort: 'newest', limit: LIMITS.listPageSize, page }),
    product => product._id, [filter, query, category], { refetchOnFocus: true });
  const visible = useMemo(() => list.items.filter(p => filter === 'low' ? p.isLowStock : filter === 'out' ? (p.stockQuantity ?? 0) === 0 || p.inStock === false : true), [list.items, filter]);

  const updateStock = (product: Product, input: { inStock?: boolean; stockQuantity?: number }) => void run(`stock:${product._id}`, async () => {
    await merchantApi.setStock(product._id, input);
    const quantity = input.stockQuantity ?? product.stockQuantity ?? 0;
    list.patchItem(product._id, { ...input, isLowStock: quantity <= (product.lowStockThreshold ?? 0) });
  });

  const clone = (product: Product) => { setMenuFor(null); void run(`clone:${product._id}`, async () => { await merchantApi.cloneProduct(product._id); await list.reload(); }); };
  const archive = async (product: Product) => {
    setMenuFor(null);
    if (!(await confirmAction('Archive this product?', 'It will be removed from the marketplace. You can still see it under Archived.', 'Archive'))) return;
    void run(`archive:${product._id}`, async () => { await merchantApi.archiveProduct(product._id); list.removeItem(product._id); });
  };

  return <Screen title="Products" subtitle="Your catalogue and inventory" refreshing={list.refreshing} onRefresh={() => void list.refresh()}
    error={list.error && !list.data ? list.error : ''} onRetry={() => void list.reload()}
    action={canEdit ? <PillButton compact icon="plus" title="Add" onPress={() => router.push('/store/product/new' as never)} /> : undefined}>
    <SearchField value={query} onChange={setQuery} placeholder="Search by name, brand or SKU" />
    <FilterChips options={FILTERS} value={filter} onChange={value => setFilter(value as Filter)} />
    <SelectField value={category} onChange={setCategory} placeholder="All categories" options={[{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c.name, label: c.name }))]} />
    {canEdit ? <PillButton variant="soft" icon="layers" title="Bulk add from CSV" onPress={() => router.push('/store/product/bulk' as never)} /> : null}

    {list.loading ? <Text style={{ color: palette.muted, textAlign: 'center', paddingVertical: 30 }}>Loading products…</Text>
      : visible.length ? <View style={{ gap: 12 }}>
        {visible.map(product => <ProductCard key={product._id} product={product} canEdit={canEdit} busy={isBusy(`stock:${product._id}`) || isBusy(`clone:${product._id}`) || isBusy(`archive:${product._id}`)}
          onOpen={() => router.push({ pathname: '/store/product/[id]', params: { id: product._id } } as never)} onMore={() => setMenuFor(product)} onStock={input => updateStock(product, input)} />)}
        {filter !== 'low' && filter !== 'out' ? <LoadMoreButton shown={list.items.length} total={list.total} loading={list.loadingMore} onPress={() => void list.loadMore()} /> : null}
      </View>
      : <EmptyState icon="layers" title={query || category || filter !== 'all' ? 'No products match' : 'No products yet'} message={query || category || filter !== 'all' ? 'Try a different search or filter.' : 'Add your first product so buyers can find and enquire about it.'}
        actionLabel={canEdit && !query && !category && filter === 'all' ? 'Add product' : undefined} onAction={() => router.push('/store/product/new' as never)} />}

    <BottomSheet visible={!!menuFor} title={menuFor?.title} onClose={() => setMenuFor(null)}>
      <PillButton variant="soft" icon="edit" title="Edit product" onPress={() => { const id = menuFor?._id; setMenuFor(null); router.push({ pathname: '/store/product/[id]', params: { id } } as never); }} />
      <PillButton variant="soft" icon="layers" title="Duplicate as draft" onPress={() => menuFor && clone(menuFor)} />
      {canArchive && menuFor?.status !== 'archived' ? <PillButton variant="danger" icon="trash" title="Archive product" onPress={() => menuFor && void archive(menuFor)} /> : null}
    </BottomSheet>
  </Screen>;
}
