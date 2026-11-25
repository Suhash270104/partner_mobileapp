import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RemoteImage } from '../RemoteImage';
import { merchantApi } from '../../../lib/marketplace/api';
import { errorMessage } from '../../../lib/marketplace/errors';
import { pickAndUploadImages } from '../../../lib/marketplace/media';
import type { Store } from '../../../lib/marketplace/types';
import { AlertBanner, Avatar, Icon, PillButton, SectionCard, Text, palette } from '../../ui';

/** Logo (square) and banner for the public store page. Each upload is saved to the store immediately. */
export function BrandingSection({ store, canEdit, onChanged }: { store: Store; canEdit: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<'' | 'logo' | 'banner'>('');
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<'logo' | 'banner'>('logo');

  const change = async (purpose: 'logo' | 'banner') => {
    setBusy(purpose); setError(''); setFailed(purpose);
    try {
      const [url] = await pickAndUploadImages(purpose, 1);
      if (url) { await merchantApi.saveStore(purpose === 'logo' ? { logoUrl: url } : { bannerUrl: url }); onChanged(); }
    } catch (cause) { setError(errorMessage(cause, 'Upload failed. Please try again.')); }
    finally { setBusy(''); }
  };

  return <SectionCard title="Store branding" subtitle="Shown on your public store page">
    <RemoteImage uri={store.bannerUrl} style={s.banner}
      fallback={<View style={[s.banner, s.empty]}>
        {store.bannerUrl ? <Icon name="image" size={24} color={palette.muted} /> : null}
        <Text style={s.emptyText}>{store.bannerUrl ? 'Banner couldn’t load' : 'No banner yet'}</Text>
      </View>} />
    <View style={s.row}>
      <RemoteImage uri={store.logoUrl} style={s.logo} fallback={<Avatar label={store.storeName} size={64} />} />
      <Text style={s.hint}>Use a square JPG, PNG or WebP under 10 MB.</Text>
    </View>
    {error ? <View style={s.warning}><AlertBanner tone="red" icon="shield" title={failed === 'logo' ? 'Logo not uploaded' : 'Banner not uploaded'} message={`${error} Your store’s ${failed} has not changed.`} /></View> : null}
    {canEdit ? <View style={{ gap: 10 }}>
      <PillButton variant="soft" icon="image" title={store.logoUrl ? 'Change logo' : 'Upload logo'} loading={busy === 'logo'} onPress={() => void change('logo')} />
      <PillButton variant="soft" icon="image" title={store.bannerUrl ? 'Change banner' : 'Upload banner'} loading={busy === 'banner'} onPress={() => void change('banner')} />
    </View> : null}
  </SectionCard>;
}

const s = StyleSheet.create({
  banner: { width: '100%', height: 110, borderRadius: 14, backgroundColor: palette.greenSoft }, empty: { alignItems: 'center', justifyContent: 'center' }, emptyText: { color: palette.muted, fontSize: 12.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 10 }, logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: palette.greenSoft },
  hint: { flex: 1, color: palette.body, fontSize: 11.5, lineHeight: 16 }, warning: { marginBottom: 10 },
});
