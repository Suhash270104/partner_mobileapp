import { router } from 'expo-router';
import { BankSection } from '../../../components/marketplace/settings/BankSection';
import { BrandingSection } from '../../../components/marketplace/settings/BrandingSection';
import { BusinessSection } from '../../../components/marketplace/settings/BusinessSection';
import { HoursAlertsSection } from '../../../components/marketplace/settings/HoursAlertsSection';
import { ProfileSection } from '../../../components/marketplace/settings/ProfileSection';
import { AlertBanner, Screen } from '../../../components/ui';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useStoreSession } from '../../../hooks/useStoreSession';
import { merchantApi } from '../../../lib/marketplace/api';

export default function SettingsScreen() {
  const { can } = useStoreSession();
  const { data: store, loading, error, reload, refresh, refreshing } = useAsyncData(() => merchantApi.store(), []);
  const canEdit = can('settingsEdit');
  // Sections own their form state; a quiet reload after a save keeps masked values (bank) current without resetting them.
  const saved = () => void refresh();

  return <Screen title="Store settings" subtitle={canEdit ? 'Changes save per section' : 'You have read-only access'} onBack={() => router.back()}
    loading={loading} error={error} onRetry={() => void reload()} refreshing={refreshing} onRefresh={() => void refresh()}>
    {store ? <>
      {!canEdit ? <AlertBanner tone="blue" icon="lock" title="Read-only" message="Only the store owner or a manager can edit these settings." /> : null}
      <BrandingSection store={store} canEdit={canEdit} onChanged={saved} />
      <ProfileSection store={store} canEdit={canEdit} onSaved={saved} />
      <BusinessSection store={store} canEdit={canEdit} onSaved={saved} />
      <HoursAlertsSection store={store} canEdit={canEdit} onSaved={saved} />
      {can('bank') ? <BankSection store={store} onSaved={saved} /> : null}
    </> : null}
  </Screen>;
}
