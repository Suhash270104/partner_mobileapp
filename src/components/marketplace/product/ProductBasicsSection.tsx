import { View } from 'react-native';
import { useTaxonomy } from '../../../hooks/useTaxonomy';
import { LIMITS } from '../../../lib/marketplace/constants';
import type { ProductForm } from '../../../lib/marketplace/productForm';
import { FormField, SectionCard, SelectField, StatePanel } from '../../ui';
import { FieldNote } from '../FieldNote';
import { PhotoPicker } from '../PhotoPicker';
import type { SectionProps } from '../formTypes';

/** Photos, title, brand, SKU, description and the category → subcategory pair (hand-off §8.1). */
export function ProductBasicsSection({ form, errors, set }: SectionProps<ProductForm>) {
  const taxonomy = useTaxonomy();
  const subcategories = taxonomy.subcategoriesOf(form.category);
  return <SectionCard title="Basic details">
    <View style={{ gap: 14 }}>
      <PhotoPicker photos={form.photos} onChange={photos => set('photos', photos)} />
      <FormField label="Product title" required value={form.title} onChangeText={v => set('title', v)} maxLength={LIMITS.productTitle.max} error={errors.title} />
      <FormField label="Brand" value={form.brand} onChangeText={v => set('brand', v)} maxLength={LIMITS.brand} error={errors.brand} />
      <FormField label="SKU" value={form.sku} onChangeText={v => set('sku', v)} autoCapitalize="none" maxLength={LIMITS.sku} error={errors.sku} helper="Must be unique in your store." />
      {taxonomy.error ? <StatePanel title="Categories unavailable" message={taxonomy.error} retry={taxonomy.retry} /> : null}
      <SelectField label="Category" required value={form.category} placeholder="Select category" options={taxonomy.categories.map(c => ({ value: c.name, label: c.name }))}
        onChange={v => { set('category', v); set('subcategory', ''); }} />
      <FieldNote text={errors.category} />
      <SelectField label="Subcategory" required value={form.subcategory} placeholder={form.category ? 'Select subcategory' : 'Choose a category first'} options={subcategories.map(name => ({ value: name, label: name }))} onChange={v => set('subcategory', v)} />
      <FieldNote text={errors.subcategory} />
      <FormField label="Description" value={form.description} onChangeText={v => set('description', v)} multiline maxLength={LIMITS.productDescription} error={errors.description} />
    </View>
  </SectionCard>;
}
