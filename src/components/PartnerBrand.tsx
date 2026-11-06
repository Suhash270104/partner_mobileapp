import { Image, StyleSheet, View } from 'react-native';
import { Text } from './AppText';

export function PartnerBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand} accessibilityLabel="Kraftnex Partner">
      <Image source={require('../../assets/kraftnex-logo-transparent.png')} style={compact ? styles.compactLogo : styles.logo} resizeMode="contain" />
      <View style={styles.badge}><Text style={styles.badgeText}>PARTNER</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logo: { width: 104, height: 30 },
  compactLogo: { width: 92, height: 27 },
  badge: { borderWidth: 1, borderColor: '#b8d6cc', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#eff8f5' },
  badgeText: { color: '#07523e', fontSize: 7, fontWeight: '900', letterSpacing: 0.45 },
});
