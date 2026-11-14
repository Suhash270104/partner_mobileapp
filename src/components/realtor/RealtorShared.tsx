import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../AppText';
import { Panel, StatePanel, StatusPill, palette } from '../vertical/VerticalUi';
import { realtorApi } from '../../lib/partnerVerticalApi';

export type Data = Record<string, any>;

export const REALTOR_TABS = [{ key: 'overview', label: 'Dashboard', icon: '' }, { key: 'properties', label: 'My properties', icon: '' }, { key: 'leads', label: 'Buyer leads', icon: '' }, { key: 'notifications', label: 'Notifications', icon: '' }, { key: 'more', label: 'More', icon: '' }];

export const idOf = (item: Data | null | undefined) => String(item?._id || item?.id || '');
export const asRows = (value: unknown): Data[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Data[] : [];
export const nestedOf = (data: Data, key: string): Data => data[key] && typeof data[key] === 'object' ? data[key] as Data : data;
export const firstText = (...values: unknown[]) => values.find(value => typeof value === 'string' && value.trim()) as string | undefined;
export const toText = (value: unknown) => value == null ? '' : String(value);
export const toNum = (value: string) => value.trim() && !Number.isNaN(Number(value)) ? Number(value) : undefined;
export const toList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
export const errorText = (cause: unknown, fallback: string) => cause instanceof Error && cause.message ? cause.message : fallback;

export function formatPrice(value: unknown) {
  const amount = Number(value);
  if (value == null || value === '' || Number.isNaN(amount)) return '';
  let formatted = String(amount);
  try { formatted = amount.toLocaleString('en-IN'); } catch { /* keep plain number */ }
  return `₹${formatted}`;
}

export function locationText(item: Data) {
  const loc: Data = item.location && typeof item.location === 'object' ? item.location : {};
  return [firstText(loc.subLocality), firstText(loc.locality, item.locality), firstText(loc.city, item.city)].filter(Boolean).join(', ');
}

export function statusTone(status: string): 'green' | 'amber' | 'red' | 'blue' | 'violet' {
  if (/reject|cancel|suspend|declin|archiv/i.test(status)) return 'red';
  if (/pending|review|request|draft|new|unlocked/i.test(status)) return 'amber';
  if (/contact|qualif/i.test(status)) return 'blue';
  return 'green';
}

/** Readable summary shown above raw detail rows: title, location, price and status. */
export function SummaryHeader({ title, location, price, status, extra }: { title: string; location?: string; price?: string; status?: string; extra?: string }) {
  return <Panel tint>
    <View style={s.summaryTop}><Text style={s.summaryTitle} numberOfLines={3}>{title}</Text>{status ? <StatusPill label={status} tone={statusTone(status)} /> : null}</View>
    {location ? <Text style={s.summaryLine}>{location}</Text> : null}
    {price ? <Text style={s.summaryPrice}>{price}</Text> : null}
    {extra ? <Text style={s.summaryLine}>{extra}</Text> : null}
  </Panel>;
}

type Picked = { uri: string; fileName?: string | null; mimeType?: string | null };

/** Lists the photos already stored for a property/project and lets the owner add, remove or set the cover. */
export function MediaManager({ resourceType, resourceId, max = 15 }: { resourceType: 'property' | 'project'; resourceId: string; max?: number }) {
  const [media, setMedia] = useState<Data[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setMedia(asRows((await realtorApi.media.list(resourceType, resourceId)).media)); setError(''); }
    catch (cause) { setError(errorText(cause, 'Could not load photos.')); }
    finally { setLoading(false); }
  }, [resourceType, resourceId]);
  // Load stored photos for this record on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function add() {
    const room = max - media.length;
    if (room <= 0) { setError(`You can keep up to ${max} photos. Remove one to add another.`); return; }
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.9 });
    if (result.canceled) return;
    setBusy(true);
    try {
      const picked: Picked[] = result.assets.slice(0, room).map(asset => ({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType }));
      for (const [index, photo] of picked.entries()) {
        await realtorApi.uploadMedia({ uri: photo.uri, name: photo.fileName || `${resourceType}-${Date.now()}-${index + 1}.jpg`, mimeType: photo.mimeType || 'image/jpeg' }, { resourceType, resourceId, type: 'gallery' });
      }
    } catch (cause) { setError(errorText(cause, 'Photo upload failed.')); }
    finally { setBusy(false); await load(); }
  }

  function remove(item: Data) {
    Alert.alert('Remove photo', 'This photo will be removed permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await realtorApi.media.remove(idOf(item)); } catch (cause) { setError(errorText(cause, 'Could not remove photo.')); }
        finally { setBusy(false); await load(); }
      } },
    ]);
  }

  async function makeCover(item: Data) {
    setBusy(true);
    try { await realtorApi.media.setPrimary(idOf(item)); } catch (cause) { setError(errorText(cause, 'Could not set cover photo.')); }
    finally { setBusy(false); await load(); }
  }

  return <Panel>
    <Text style={s.sectionTitle}>Photos</Text>
    <Text style={s.hint}>{loading ? 'Loading photos…' : `${media.length} of ${max} photos`}</Text>
    {error ? <StatePanel title="Photo update failed" message={error} retry={() => void load()} /> : null}
    {!loading && !media.length && !error ? <Text style={s.hint}>No photos yet. Add photos so buyers can see this {resourceType}.</Text> : null}
    <View style={s.grid}>{media.map(item => {
      const uri = firstText(item.variants?.thumbnail, item.variants?.medium, item.variants?.original);
      return <View key={idOf(item)} style={s.cell}>
        {uri ? <Image source={{ uri }} style={s.image} /> : <View style={[s.image, s.noImage]} />}
        {item.isPrimary ? <View style={s.coverTag}><Text style={s.coverText}>Cover</Text></View> : <Pressable style={s.coverBtn} onPress={() => void makeCover(item)} disabled={busy}><Text style={s.coverText}>Set cover</Text></Pressable>}
        <Pressable style={s.remove} onPress={() => remove(item)} disabled={busy}><Text style={s.removeText}>×</Text></Pressable>
      </View>;
    })}</View>
    <Pressable onPress={() => void add()} disabled={busy} style={[s.pick, busy && { opacity: 0.55 }]}><Text style={s.pickTitle}>{busy ? 'Working…' : '＋  Add photos'}</Text></Pressable>
  </Panel>;
}

const s = StyleSheet.create({
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, summaryTitle: { flex: 1, color: palette.ink, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  summaryLine: { color: palette.body, fontSize: 12, lineHeight: 18 }, summaryPrice: { color: palette.green, fontSize: 20, fontWeight: '800' },
  sectionTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, hint: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, cell: { width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: palette.greenSoft },
  image: { width: '100%', height: '100%' }, noImage: { backgroundColor: palette.line },
  remove: { position: 'absolute', right: 3, top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(16,35,28,0.7)', alignItems: 'center', justifyContent: 'center' }, removeText: { color: '#fff', fontWeight: '900' },
  coverTag: { position: 'absolute', left: 3, bottom: 3, borderRadius: 6, backgroundColor: palette.green, paddingHorizontal: 6, paddingVertical: 2 }, coverBtn: { position: 'absolute', left: 3, bottom: 3, borderRadius: 6, backgroundColor: 'rgba(16,35,28,0.7)', paddingHorizontal: 6, paddingVertical: 2 }, coverText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  pick: { backgroundColor: palette.greenSoft, borderColor: '#bfe0cf', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, alignItems: 'center' }, pickTitle: { color: palette.green, fontSize: 13, fontWeight: '800' },
});
