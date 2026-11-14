import { View } from 'react-native';
import { LIMITS, SUPPLY_PERIOD_OPTIONS, UNIT_OPTIONS } from '../../../lib/marketplace/constants';
import type { ProductForm } from '../../../lib/marketplace/productForm';
import { FormField, SectionCard, SelectField, ToggleRow } from '../../ui';
import type { SectionProps } from '../formTypes';

/** Supply ability, lead time, delivery locations, bulk and customisation (hand-off §8.1). */
export function ProductSupplySection({ form, errors, set }: SectionProps<ProductForm>) {
  return <SectionCard title="Supply & delivery">
    <View style={{ gap: 14 }}>
      <FormField label="Supply ability (quantity)" value={form.supplyQuantity} onChangeText={v => set('supplyQuantity', v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" error={errors.supplyQuantity} helper="How much you can supply in a period." />
      <SelectField label="Supply unit" value={form.supplyUnit || form.unit} options={UNIT_OPTIONS} onChange={v => set('supplyUnit', v)} />
      <SelectField label="Per" value={form.supplyPeriod} options={SUPPLY_PERIOD_OPTIONS} onChange={v => set('supplyPeriod', v)} />
      <FormField label="Lead time (days)" value={form.leadTimeDays} onChangeText={v => set('leadTimeDays', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={3} error={errors.leadTimeDays}
        helper={`0 means ready stock. Up to ${LIMITS.leadTimeDays} days.`} />
      <FormField label="Delivery locations" value={form.deliveryLocations} onChangeText={v => set('deliveryLocations', v)} placeholder="Bengaluru, Mysuru" error={errors.deliveryLocations} helper="Separate with commas." />
      <ToggleRow label="Bulk orders accepted" value={form.bulkSupply} onChange={v => set('bulkSupply', v)} />
      <ToggleRow label="Customisation available" value={form.customization} onChange={v => set('customization', v)} />
    </View>
  </SectionCard>;
}
