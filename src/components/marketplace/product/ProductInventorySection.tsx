import { View } from 'react-native';
import type { ProductForm } from '../../../lib/marketplace/productForm';
import { FormField, SectionCard, ToggleRow } from '../../ui';
import type { SectionProps } from '../formTypes';

const digits = (value: string) => value.replace(/\D/g, '');

/** Stock, order quantities, low-stock alert, enquiry switch, featured and tags (hand-off §8.1). */
export function ProductInventorySection({ form, errors, set }: SectionProps<ProductForm>) {
  return <SectionCard title="Inventory">
    <View style={{ gap: 14 }}>
      <FormField label="Stock quantity" value={form.stockQuantity} onChangeText={v => set('stockQuantity', digits(v))} keyboardType="numeric" error={errors.stockQuantity} />
      <FormField label="Minimum order quantity" value={form.minOrderQuantity} onChangeText={v => set('minOrderQuantity', digits(v))} keyboardType="numeric" error={errors.minOrderQuantity} />
      <FormField label="Maximum order quantity (optional)" value={form.maxOrderQuantity} onChangeText={v => set('maxOrderQuantity', digits(v))} keyboardType="numeric" error={errors.maxOrderQuantity} />
      <FormField label="Low-stock alert at" value={form.lowStockThreshold} onChangeText={v => set('lowStockThreshold', digits(v))} keyboardType="numeric" error={errors.lowStockThreshold} helper="You will see an alert when stock falls to this number." />
      <ToggleRow label="Accepting enquiries" value={form.inStock} onChange={v => set('inStock', v)} helper="Turn off to pause enquiries without unpublishing." />
      <ToggleRow label="Feature this product" value={form.isFeatured} onChange={v => set('isFeatured', v)} />
      <FormField label="Tags" value={form.tags} onChangeText={v => set('tags', v)} placeholder="toughened, frameless" helper="Separate with commas." />
    </View>
  </SectionCard>;
}
