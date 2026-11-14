import { merchantApi } from '../../../lib/marketplace/api';
import { DEFAULT_COUNTRY, LIMITS, STATE_OPTIONS } from '../../../lib/marketplace/constants';
import type { Store } from '../../../lib/marketplace/types';
import * as v from '../../../lib/marketplace/validation';
import { useFormState } from '../../../hooks/useFormState';
import { FormField, SelectField } from '../../ui';
import { FieldNote } from '../FieldNote';
import { SettingsSection } from './SettingsSection';

/** Display name, contact numbers, email, description and address. */
export function ProfileSection({ store, canEdit, onSaved }: { store: Store; canEdit: boolean; onSaved: () => void }) {
  const { form, errors, setErrors, set } = useFormState(() => ({
    storeName: store.storeName ?? '', phone: store.phone ?? '', whatsappNumber: store.whatsappNumber ?? '', email: store.email ?? '', description: store.description ?? '',
    streetAddress: store.address?.streetAddress ?? '', locality: store.address?.locality ?? '', city: store.address?.city ?? '', state: store.address?.state ?? '', pinCode: store.address?.pinCode ?? '',
  }));

  const save = async () => {
    const found = v.compact({
      storeName: v.lengthBetween(form.storeName, 'Store name', LIMITS.storeName.min, LIMITS.storeName.max), phone: v.indianMobile(form.phone),
      whatsappNumber: form.whatsappNumber.trim() ? v.indianMobile(form.whatsappNumber, 'WhatsApp number') : undefined, email: v.optionalEmail(form.email),
      streetAddress: v.lengthBetween(form.streetAddress, 'Street address', LIMITS.address.min, LIMITS.address.max), city: v.lengthBetween(form.city, 'City', LIMITS.city.min, LIMITS.city.max),
      state: form.state ? undefined : 'Select your state.', pinCode: v.pinCode(form.pinCode),
    });
    setErrors(found);
    if (Object.keys(found).length) return v.firstError(found);
    await merchantApi.saveStore({
      storeName: form.storeName.trim(), phone: v.nationalPhone(form.phone), ...(form.whatsappNumber.trim() ? { whatsappNumber: v.nationalPhone(form.whatsappNumber) } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}), description: form.description.trim(),
      address: { streetAddress: form.streetAddress.trim(), locality: form.locality.trim(), city: form.city.trim(), state: form.state, pinCode: form.pinCode.trim(), country: DEFAULT_COUNTRY },
    });
    onSaved();
  };

  return <SettingsSection title="Store profile" readOnly={!canEdit} onSave={save}>
    <FormField label="Store name" value={form.storeName} onChangeText={t => set('storeName', t)} error={errors.storeName} />
    <FormField label="Primary phone" prefix="+91" value={form.phone} onChangeText={t => set('phone', t)} keyboardType="phone-pad" error={errors.phone} />
    <FormField label="WhatsApp number" prefix="+91" value={form.whatsappNumber} onChangeText={t => set('whatsappNumber', t)} keyboardType="phone-pad" error={errors.whatsappNumber} helper="Lead alerts go here when set, otherwise to the primary phone." />
    <FormField label="Store email" value={form.email} onChangeText={t => set('email', t)} keyboardType="email-address" error={errors.email} />
    <FormField label="About your store" value={form.description} onChangeText={t => set('description', t)} multiline maxLength={LIMITS.description} />
    <FormField label="Street address" value={form.streetAddress} onChangeText={t => set('streetAddress', t)} error={errors.streetAddress} />
    <FormField label="Locality" value={form.locality} onChangeText={t => set('locality', t)} />
    <FormField label="City" value={form.city} onChangeText={t => set('city', t)} error={errors.city} />
    <SelectField label="State" value={form.state} options={STATE_OPTIONS} onChange={t => set('state', t)} placeholder="Select state" />
    <FieldNote text={errors.state} />
    <FormField label="PIN code" value={form.pinCode} onChangeText={t => set('pinCode', t.replace(/\D/g, ''))} keyboardType="numeric" maxLength={6} error={errors.pinCode} />
  </SettingsSection>;
}
