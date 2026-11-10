import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText, Field } from '../../../components/professional/onboardingUi';
import { Sheet } from '../../../components/studio/Sheet';
import { useStudio } from '../../../components/studio/StudioContext';

export default function ServicesScreen() {
  const { profile, studioName, patchProfile } = useStudio();
  const services = ((profile as { servicesOffered?: string[] }).servicesOffered || []) as string[];
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function persist(next: string[]): Promise<boolean> {
    setSaving(true);
    setError('');
    try {
      await partnerApi.updateStudioProfile({ servicesOffered: next });
      patchProfile({ servicesOffered: next } as never);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save changes');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    const name = title.trim();
    if (!name) { setError('Enter a service name.'); return; }
    if (services.includes(name)) { setError('You already offer this service.'); return; }
    if (await persist([name, ...services])) { setTitle(''); setAdding(false); }
  }

  function remove(name: string) {
    Alert.alert('Remove service?', name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void persist(services.filter(item => item !== name)); } },
    ]);
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>OFFERINGS CATALOG</Text>
      <Text style={s.title}>Offered Services & Scope</Text>
      <Text style={s.sub}>Manage the professional design services offered by {studioName || 'your studio'} to client lead inquiries.</Text>
      <Pressable style={s.add} onPress={() => { setError(''); setAdding(true); }}><Text style={s.addText}>＋ Add Service</Text></Pressable>
      {!!error && !adding && <ErrorText>{error}</ErrorText>}

      {services.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No services added yet.</Text>
          <Text style={s.emptyCopy}>Add the design services your studio offers so clients know what to expect.</Text>
        </View>
      ) : services.map(service => (
        <View key={service} style={s.card}>
          <View style={s.glyph}><Icon name="award" size={18} color={c.green} /></View>
          <Text style={s.name}>{service}</Text>
          <Pressable disabled={saving} onPress={() => remove(service)} hitSlop={8}><Text style={s.delete}>Remove</Text></Pressable>
        </View>
      ))}

      <Sheet visible={adding} title="Add Studio Service" eyebrow="SERVICES" onClose={() => setAdding(false)} locked={saving}>
        <Field label="SERVICE NAME *" value={title} onChangeText={value => { setTitle(value); setError(''); }} placeholder="e.g. Modular Kitchen & Wardrobe Execution" />
        {!!error && <ErrorText>{error}</ErrorText>}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable style={s.outline} onPress={() => setAdding(false)} disabled={saving}><Text style={s.outlineText}>Cancel</Text></Pressable>
          <Pressable style={[s.solid, saving && { opacity: 0.6 }]} onPress={() => void add()} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Save Service</Text>}</Pressable>
        </View>
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  eyebrow: { color: c.greenText, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: c.ink, fontSize: 26, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13, lineHeight: 19 },
  add: { height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  glyph: { width: 38, height: 38, borderRadius: 11, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  glyphText: { color: c.green, fontSize: 16 },
  name: { flex: 1, color: c.ink, fontSize: 14.5, fontWeight: '800' },
  delete: { color: c.red, fontSize: 11.5, fontWeight: '800' },
  solid: { flex: 1.4, height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  outline: { flex: 1, height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 14, fontWeight: '800' },
});
