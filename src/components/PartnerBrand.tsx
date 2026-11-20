import { Image, StyleSheet, View } from 'react-native';
import { Text } from './AppText';

export function PartnerBrand({ compact = false, small = false }: { compact?: boolean; small?: boolean }) {
  return (
    <View style={styles.brand} accessibilityLabel="Kraftnex Partner">
      <Image source={require('../../assets/kraftnex-logo-transparent.png')} style={small ? styles.smallLogo : compact ? styles.compactLogo : styles.logo} resizeMode="contain" />
      <View style={[styles.badge, small && styles.smallBadge]}><Text style={[styles.badgeText, small && styles.smallBadgeText]}>PARTNER</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logo: { width: 100, height: 32 },
  compactLogo: { width: 100, height: 32 },
  smallLogo: { width: 100, height: 32 },
  badge: { borderWidth: 1, borderColor: '#b8d6cc', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#eff8f5' },
  badgeText: { color: '#07523e', fontSize: 7, fontWeight: '900', letterSpacing: 0.45 },
  smallBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 9 },
  smallBadgeText: { fontSize: 7, letterSpacing: 0.45 },
});
