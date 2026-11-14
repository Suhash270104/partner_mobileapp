import { View } from 'react-native';
import { FormField, SectionLabel, SelectField, ToggleRow } from '../../ui';
import { LIMITS, STATE_OPTIONS } from '../../../lib/marketplace/constants';
import type { RegistrationForm } from '../../../lib/marketplace/registration';
import { FieldNote } from '../FieldNote';
import type { SectionProps } from '../formTypes';

/** Step 2 — address & contact (hand-off §4.2). */
export function ContactStep({ form, errors, set }: SectionProps<RegistrationForm>) {
  return <View style={{ gap: 14 }}>
    <FormField label="Primary phone" required value={form.phone} onChangeText={v => set('phone', v)} keyboardType="phone-pad" prefix="+91" placeholder="98765 43210" maxLength={14} error={errors.phone}
      helper="New enquiry alerts are sent here." />
    <ToggleRow label="WhatsApp number is the same as phone" value={form.sameAsPhone} onChange={v => set('sameAsPhone', v)} />
    {!form.sameAsPhone ? <FormField label="WhatsApp number for lead alerts" required value={form.whatsappNumber} onChangeText={v => set('whatsappNumber', v)} keyboardType="phone-pad" prefix="+91" maxLength={14} error={errors.whatsappNumber} /> : null}
    <FormField label="Store email (optional)" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" error={errors.email} helper="For invoices and payout statements." />
    <SectionLabel icon="mapPin" title="Store address" />
    <FormField label="Street address" required value={form.streetAddress} onChangeText={v => set('streetAddress', v)} maxLength={LIMITS.address.max} error={errors.streetAddress} />
    <FormField label="Locality / area (optional)" value={form.locality} onChangeText={v => set('locality', v)} maxLength={LIMITS.locality} error={errors.locality} />
    <FormField label="City" required value={form.city} onChangeText={v => set('city', v)} maxLength={LIMITS.city.max} error={errors.city} />
    <SelectField label="State" required value={form.state} options={STATE_OPTIONS} onChange={v => set('state', v)} placeholder="Select state" />
    <FieldNote text={errors.state} />
    <FormField label="PIN code" required value={form.pinCode} onChangeText={v => set('pinCode', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={6} error={errors.pinCode} />
  </View>;
}
