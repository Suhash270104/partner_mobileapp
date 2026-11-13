import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Text } from '../AppText';
import { VerticalFrame, palette } from './VerticalUi';
import { merchantApi } from '../../lib/partnerVerticalApi';

export type Row = Record<string, any>;

export const sellerTabs = [
  { key: 'overview', label: 'Home', icon: '⌂' }, { key: 'products', label: 'Products', icon: '▦' },
  { key: 'leads', label: 'Enquiries', icon: '◎' }, { key: 'orders', label: 'Orders', icon: '▤' }, { key: 'settings', label: 'More', icon: '•••' },
];

/** Frame for seller sub-screens; tabs return to the main seller dashboard. */
export function SellerFrame({ title, subtitle, activeTab = 'overview', children }: { title: string; subtitle?: string; activeTab?: string; children: ReactNode }) {
  return <VerticalFrame title={title} subtitle={subtitle || 'Partner marketplace'} tabs={sellerTabs} activeTab={activeTab}
    onTab={() => router.replace('/store/dashboard' as never)} onBack={() => router.back()}>{children}</VerticalFrame>;
}

export const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
};
export const fmtDate = (value: unknown) => {
  if (!value) return '—';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const humanize = (value: unknown) => String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const idOf = (x: Row) => String(x?._id ?? x?.id ?? '');

/** Pick an image from the library and upload it through the merchant media pipeline. Returns its URL, or null if cancelled. */
export async function pickAndUploadImage(purpose: 'logo' | 'banner' | 'product'): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo library permission is required to choose an image.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.9 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || 'image/jpeg';
  const init = await merchantApi.initMedia({ purpose, fileName: asset.fileName || `${purpose}-${Date.now()}.jpg`, fileType: mime, fileSize: asset.fileSize });
  const blobResponse = await fetch(asset.uri);
  if (!blobResponse.ok) throw new Error('Could not read the selected image.');
  const blob = await blobResponse.blob();
  const upload = await fetch(String(init.uploadUrl), { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
  if (!upload.ok) throw new Error(`Image storage upload failed (${upload.status}).`);
  const complete = await merchantApi.completeMedia(String(init.imageId));
  const image = complete.image as Record<string, string>;
  return image.mediumUrl || image.url || null;
}

/** Horizontal filter chips with optional counts. */
export function FilterChips({ options, value, onChange }: { options: { key: string; label: string; count?: number }[]; value: string; onChange: (key: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
    {options.map(o => {
      const on = o.key === value;
      return <Pressable key={o.key} onPress={() => onChange(o.key)} style={[st.chip, on && st.chipOn]}>
        <Text style={[st.chipText, on && st.chipTextOn]}>{o.label}{typeof o.count === 'number' ? ` · ${o.count}` : ''}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

/** Label / value line used in summaries. */
export function InfoLine({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return <View style={st.info}><Text style={st.infoLabel}>{label}</Text><Text style={st.infoValue}>{value}</Text></View>;
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 7, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: palette.green, borderColor: palette.green },
  chipText: { color: palette.body, fontSize: 12, fontWeight: '700' }, chipTextOn: { color: '#fff' },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  infoLabel: { color: palette.muted, fontSize: 12 },
  infoValue: { color: palette.ink, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },
});
