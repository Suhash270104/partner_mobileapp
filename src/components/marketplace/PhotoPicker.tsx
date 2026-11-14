import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, palette } from '../ui';
import { errorMessage } from '../../lib/marketplace/errors';
import { PHOTO_LIMIT, pickAndUploadImages } from '../../lib/marketplace/media';

/** Product photo grid: add from the gallery (uploaded straight away), remove, and make any photo the cover (first). */
export function PhotoPicker({ photos, onChange, max = PHOTO_LIMIT }: { photos: string[]; onChange: (photos: string[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    const room = max - photos.length;
    if (room <= 0) return;
    setBusy(true); setError('');
    try { const urls = await pickAndUploadImages('product', room); if (urls.length) onChange([...photos, ...urls]); }
    catch (cause) { setError(errorMessage(cause, 'Photo upload failed. Please try again.')); }
    finally { setBusy(false); }
  };

  return <View style={s.wrap}>
    <Text style={s.hint}>{photos.length} of {max} photos · the first photo is the cover</Text>
    <View style={s.grid}>
      {photos.map((uri, index) => <View key={`${uri}-${index}`} style={s.cell}>
        <Image source={{ uri }} style={s.image} />
        {index === 0 ? <View style={s.cover}><Text style={s.coverText}>Cover</Text></View>
          : <Pressable style={s.coverBtn} onPress={() => onChange([uri, ...photos.filter((_, i) => i !== index)])} accessibilityLabel="Make cover photo"><Text style={s.coverText}>Make cover</Text></Pressable>}
        <Pressable style={s.remove} onPress={() => onChange(photos.filter((_, i) => i !== index))} accessibilityLabel="Remove photo"><Icon name="x" size={14} color="#fff" /></Pressable>
      </View>)}
      {photos.length < max ? <Pressable onPress={() => void add()} disabled={busy} style={[s.cell, s.add, busy && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Add photos">
        <Icon name={busy ? 'clock' : 'plus'} size={24} color={palette.green} /><Text style={s.addText}>{busy ? 'Uploading…' : 'Add'}</Text>
      </Pressable> : null}
    </View>
    {error ? <Text style={s.error}>{error}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: 8 }, hint: { color: palette.muted, fontSize: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '30.5%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: palette.greenSoft }, image: { width: '100%', height: '100%' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bfe0cf', gap: 2 }, addText: { color: palette.green, fontSize: 12, fontWeight: '800' },
  cover: { position: 'absolute', left: 4, bottom: 4, borderRadius: 6, backgroundColor: palette.green, paddingHorizontal: 6, paddingVertical: 2 },
  coverBtn: { position: 'absolute', left: 4, bottom: 4, borderRadius: 6, backgroundColor: 'rgba(16,35,28,0.72)', paddingHorizontal: 6, paddingVertical: 2 }, coverText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  remove: { position: 'absolute', right: 4, top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(16,35,28,0.72)', alignItems: 'center', justifyContent: 'center' },
  error: { color: palette.red, fontSize: 12, fontWeight: '700' },
});
