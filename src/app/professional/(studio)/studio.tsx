import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { router } from 'expo-router';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';
import { STUDIO_SECTIONS } from '../../../components/studio/studioNav';

export default function StudioHubScreen() {
  const { profile, studioName } = useStudio();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await partnerApi.logout();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <View style={s.heroAvatar}><Text style={s.heroAvatarText}>{(studioName.trim()[0] || 'K').toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroName} numberOfLines={2}>{studioName || 'Your studio'}</Text>
          <Text style={s.heroSub}>{profile.isApproved === false ? 'Pending approval' : 'Verified professional'}{profile.city ? ` · ${profile.city}` : ''}</Text>
        </View>
      </View>

      {STUDIO_SECTIONS.map(group => (
        <View key={group.group}>
          <Text style={s.group}>{group.group.toUpperCase()}</Text>
          <View style={s.card}>
            {group.items.map((item, index) => (
              <Pressable
                key={item.key}
                disabled={!item.built}
                style={[s.row, index > 0 && s.rowBorder, !item.built && { opacity: 0.45 }]}
                onPress={() => router.navigate(item.path as never)}
              >
                <View style={s.glyphBox}><Icon name={item.glyph} size={19} color={c.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{item.label}</Text>
                  <Text style={s.hint}>{item.hint}</Text>
                </View>
                <Text style={s.chevron}>{item.built ? '›' : 'Soon'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {!!error && <ErrorText>{error}</ErrorText>}
      <Pressable style={s.signOut} onPress={() => void signOut()} disabled={signingOut}>
        <Text style={s.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.green, borderRadius: 20, padding: 16 },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroSub: { color: '#bfe0cf', fontSize: 12.5, marginTop: 2 },
  group: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  glyphBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  glyph: { color: c.green, fontSize: 17, fontWeight: '800' },
  label: { color: c.ink, fontSize: 15, fontWeight: '800' },
  hint: { color: c.muted, fontSize: 12, marginTop: 1 },
  chevron: { color: c.muted, fontSize: 13, fontWeight: '700' },
  signOut: { marginTop: 26, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#e6c3bf', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  signOutText: { color: c.red, fontSize: 14, fontWeight: '800' },
});
