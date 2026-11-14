import { View } from 'react-native';
import { GST_OPTIONS, LIMITS, PRICE_TYPE_OPTIONS, UNIT_OPTIONS } from '../../../lib/marketplace/constants';
import type { ProductForm } from '../../../lib/marketplace/productForm';
import { FormField, SectionCard, SelectField, Text, ToggleRow, palette } from '../../ui';
import type { SectionProps } from '../formTypes';

const SEGMENT_HELP: Record<string, string> = {
  fixed: 'One MRP and one selling price. The discount is worked out for you.',
  range: 'A price range, from the selling price up to the highest price.',
  on_request: 'No price is shown. Buyers send an enquiry and you quote.',
};

/** Price type, MRP, selling price, unit and GST (hand-off §8.1). */
export function ProductPricingSection({ form, errors, set }: SectionProps<ProductForm>) {
  const priced = form.priceType !== 'on_request';
  return <SectionCard title="Pricing & GST">
    <View style={{ gap: 14 }}>
      <SelectField label="Price type" value={form.priceType} options={PRICE_TYPE_OPTIONS} onChange={v => set('priceType', v)} />
      <Text style={{ color: palette.muted, fontSize: 12, marginTop: -8 }}>{SEGMENT_HELP[form.priceType]}</Text>
      {priced ? <>
        <FormField label="MRP" required prefix="₹" value={form.mrp} onChangeText={v => set('mrp', v)} keyboardType="decimal-pad" error={errors.mrp} />
        <FormField label={form.priceType === 'range' ? 'Lowest selling price' : 'Selling price'} required prefix="₹" value={form.sellingPrice} onChangeText={v => set('sellingPrice', v)} keyboardType="decimal-pad" error={errors.sellingPrice} />
        {form.priceType === 'range' ? <FormField label="Highest price" required prefix="₹" value={form.priceMax} onChangeText={v => set('priceMax', v)} keyboardType="decimal-pad" error={errors.priceMax} /> : null}
      </> : null}
      <SelectField label="Sold per (unit)" value={form.unit} options={UNIT_OPTIONS} onChange={v => set('unit', v)} />
      <FormField label="Unit label (optional)" value={form.unitLabel} onChangeText={v => set('unitLabel', v)} maxLength={LIMITS.unitLabel} placeholder="e.g. box of 12 pcs" helper="Shown as “per box of 12 pcs”." />
      <SelectField label="GST rate" value={form.gstPercentage} options={GST_OPTIONS} onChange={v => set('gstPercentage', v)} />
      <ToggleRow label="Prices include GST" value={form.priceIncludesTax} onChange={v => set('priceIncludesTax', v)} />
    </View>
  </SectionCard>;
}
