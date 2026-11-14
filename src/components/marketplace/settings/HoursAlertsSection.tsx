import { View } from 'react-native';
import { useFormState } from '../../../hooks/useFormState';
import { merchantApi } from '../../../lib/marketplace/api';
import { DEFAULT_HOURS } from '../../../lib/marketplace/constants';
import type { Store } from '../../../lib/marketplace/types';
import * as v from '../../../lib/marketplace/validation';
import { ToggleRow } from '../../ui';
import { TimeField } from '../TimeField';
import { SettingsSection } from './SettingsSection';

/** Opening hours (drives the Open now pill) and how enquiry alerts reach you. */
export function HoursAlertsSection({ store, canEdit, onSaved }: { store: Store; canEdit: boolean; onSaved: () => void }) {
  const { form, set } = useFormState(() => ({
    openTime: store.operatingHours?.openTime ?? DEFAULT_HOURS.openTime, closeTime: store.operatingHours?.closeTime ?? DEFAULT_HOURS.closeTime,
    isOpenSundays: store.operatingHours?.isOpenSundays ?? DEFAULT_HOURS.isOpenSundays, alertEmail: store.leadAlerts?.email !== false, alertSms: store.leadAlerts?.sms !== false,
  }));
  const save = async () => {
    const problem = v.hours(form.openTime, form.closeTime);
    if (problem) return problem;
    await merchantApi.saveStore({ operatingHours: { openTime: form.openTime, closeTime: form.closeTime, isOpenSundays: form.isOpenSundays }, leadAlerts: { email: form.alertEmail, sms: form.alertSms } });
    onSaved();
  };
  return <SettingsSection title="Hours & alerts" readOnly={!canEdit} onSave={save}>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}><TimeField label="Opens" value={form.openTime} onChange={t => set('openTime', t)} /></View>
      <View style={{ flex: 1 }}><TimeField label="Closes" value={form.closeTime} onChange={t => set('closeTime', t)} /></View>
    </View>
    <ToggleRow label="Open on Sundays" value={form.isOpenSundays} onChange={t => set('isOpenSundays', t)} />
    <ToggleRow label="Enquiry alerts by SMS / WhatsApp" value={form.alertSms} onChange={t => set('alertSms', t)} />
    <ToggleRow label="Enquiry alerts by email" value={form.alertEmail} onChange={t => set('alertEmail', t)} />
  </SettingsSection>;
}
