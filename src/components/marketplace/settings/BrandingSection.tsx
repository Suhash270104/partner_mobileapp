import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { merchantApi } from '../../../lib/marketplace/api';
import { errorMessage } from '../../../lib/marketplace/errors';
import { pickAndUploadImages } from '../../../lib/marketplace/media';
import type { Store } from '../../../lib/marketplace/types';
import { Avatar, PillButton, SectionCard, Text, palette } from '../../ui';

/** Logo (square) and banner for the public store page. Each upload is saved to the store immediately. */
export function BrandingSection({ store, canEdit, onChanged }: { store: Store; canEdit: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState<'' | 'logo' | 'banner'>('');
  const [error, setError] = useState('');

  const change = async (purpose: 'logo' | 'banner') => {
    setBusy(purpose); setError('');
    try {
      const [url] = await pickAndUploadImages(purpose, 1);
      if (url) { await merchantApi.saveStore(purpose === 'logo' ? { logoUrl: url } : { bannerUrl: url }); onChanged(); }
    } catch (cause) { setError(errorMessage(cause, 'Upload failed. Please try again.')); }
    finally { setBusy(''); }
  };

  return <SectionCard title="Store branding" subtitle="Shown on your public store page">
    {store.bannerUrl ? <Image source={{ uri: store.bannerUrl }} style={s.banner} resizeMode="cover" /> : <View style={[s.banner, s.empty]}><Text style={s.emptyText}>No banner yet</Text></View>}
    <View style={s.row}>
      {store.logoUrl ? <Image source={{ uri: store.logoUrl }} style={s.logo} /> : <Avatar label={store.storeName} size={64} />}
      <Text style={s.hint}>Use a square JPG, PNG or WebP under 10 MB.</Text>
    </View>
    {error ? <Text style={s.error}>{error}</Text> : null}
    {canEdit ? <View style={{ gap: 10 }}>
      <PillButton variant="soft" icon="image" title={store.logoUrl ? 'Change logo' : 'Upload logo'} loading={busy === 'logo'} onPress={() => void change('logo')} />
      <PillButton variant="soft" icon="image" title={store.bannerUrl ? 'Change banner' : 'Upload banner'} loading={busy === 'banner'} onPress={() => void change('banner')} />
    </View> : null}
  </SectionCard>;
}

const s = StyleSheet.create({
  banner: { width: '100%', height: 110, borderRadius: 14, backgroundColor: palette.greenSoft }, empty: { alignItems: 'center', justifyContent: 'center' }, emptyText: { color: palette.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 10 }, logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: palette.greenSoft },
  hint: { flex: 1, color: palette.body, fontSize: 12, lineHeight: 17 }, error: { color: palette.red, fontSize: 13, fontWeight: '700', marginBottom: 8 },
});
