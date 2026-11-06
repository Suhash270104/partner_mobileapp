import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText, Field } from '../../../components/professional/onboardingUi';
import { Sheet } from '../../../components/studio/Sheet';
import { useStudio } from '../../../components/studio/StudioContext';

interface TeamMember { name: string; role: string; experience?: string }

export default function TeamScreen() {
  const { profile, studioName, ownerName, patchProfile } = useStudio();
  const members = ((profile as { teamMembers?: TeamMember[] }).teamMembers || []) as TeamMember[];
  const experience = (profile as { experience?: number }).experience;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', experience: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function persist(next: TeamMember[]): Promise<boolean> {
    setSaving(true);
    setError('');
    try {
      await partnerApi.updateStudioProfile({ teamMembers: next });
      patchProfile({ teamMembers: next } as never);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save changes');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function add() {
    if (!form.name.trim() || !form.role.trim()) { setError('Enter a name and a role.'); return; }
    if (await persist([...members, { name: form.name.trim(), role: form.role.trim(), experience: form.experience.trim() }])) {
      setForm({ name: '', role: '', experience: '' });
      setAdding(false);
    }
  }

  function remove(index: number) {
    Alert.alert('Remove team member?', members[index]?.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void persist(members.filter((_, position) => position !== index)); } },
    ]);
  }

  const owner = ownerName || studioName || 'Studio Owner';

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>CAPACITY & ENGINEERS</Text>
      <Text style={s.title}>Studio Team & Engineers</Text>
      <Text style={s.sub}>Architects, site supervisors, and 3D visualizers representing {studioName || 'your studio'}.</Text>
      <Pressable style={s.add} onPress={() => { setError(''); setAdding(true); }}><Text style={s.addText}>＋ Add Team Member</Text></Pressable>
      {!!error && !adding && <ErrorText>{error}</ErrorText>}

      <View style={s.card}>
        <View style={s.avatar}><Text style={s.avatarText}>{owner.slice(0, 2).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{owner}</Text>
          <Text style={s.role}>Studio Principal</Text>
          {typeof experience === 'number' && <Text style={s.meta}>{experience} {experience === 1 ? 'Yr' : 'Yrs'} Experience</Text>}
        </View>
        <View style={s.tag}><Text style={s.tagText}>Owner / Admin</Text></View>
      </View>

      {members.map((member, index) => (
        <View key={`${member.name}-${index}`} style={s.card}>
          <View style={s.avatar}><Text style={s.avatarText}>{member.name.slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{member.name}</Text>
            <Text style={s.role}>{member.role}</Text>
            {!!member.experience && <Text style={s.meta}>{member.experience} Experience</Text>}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={s.tag}><Text style={s.tagText}>Team Member</Text></View>
            <Pressable disabled={saving} onPress={() => remove(index)} hitSlop={8}><Text style={s.delete}>Remove</Text></Pressable>
          </View>
        </View>
      ))}

      <Sheet visible={adding} title="Add Studio Team Member" eyebrow="TEAM" onClose={() => setAdding(false)} locked={saving}>
        <Field label="FULL NAME *" value={form.name} onChangeText={value => setForm(previous => ({ ...previous, name: value }))} placeholder="Full Name (e.g. Anish Kumar)" />
        <Field label="ROLE *" value={form.role} onChangeText={value => setForm(previous => ({ ...previous, role: value }))} placeholder="Role (e.g. 3D Visualizer & Designer)" />
        <Field label="EXPERIENCE" value={form.experience} onChangeText={value => setForm(previous => ({ ...previous, experience: value }))} placeholder="Experience (e.g. 4 Yrs)" />
        {!!error && <ErrorText>{error}</ErrorText>}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable style={s.outline} onPress={() => setAdding(false)} disabled={saving}><Text style={s.outlineText}>Cancel</Text></Pressable>
          <Pressable style={[s.solid, saving && { opacity: 0.6 }]} onPress={() => void add()} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Add Member</Text>}</Pressable>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 14, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.green, fontSize: 15, fontWeight: '800' },
  name: { color: c.ink, fontSize: 15, fontWeight: '800' },
  role: { color: c.body, fontSize: 12.5 },
  meta: { color: c.muted, fontSize: 11.5, marginTop: 2 },
  tag: { backgroundColor: '#eef3f0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: c.greenText, fontSize: 10.5, fontWeight: '800' },
  delete: { color: c.red, fontSize: 11.5, fontWeight: '800' },
  solid: { flex: 1.4, height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  outline: { flex: 1, height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 14, fontWeight: '800' },
});
