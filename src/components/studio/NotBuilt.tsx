import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { c } from '../professional/onboardingUi';

// Shown only for a studio section whose mobile screen has not been built yet.
export function NotBuilt({ title }: { title: string }) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.copy}>This section isn&apos;t available in the app yet.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  title: { color: c.ink, fontSize: 20, fontWeight: '800' },
  copy: { color: c.body, fontSize: 13.5, textAlign: 'center' },
});
