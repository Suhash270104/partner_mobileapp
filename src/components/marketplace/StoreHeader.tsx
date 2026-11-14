import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerBrand } from '../PartnerBrand';
import { Avatar, Icon, Text, palette } from '../ui';

/** Top bar of the seller workspace: brand, store name with role, quick "add product", and the menu avatar. */
export function StoreHeader({ storeName, roleLabel, onAdd, onMenu }: { storeName: string; roleLabel: string; onAdd?: () => void; onMenu: () => void }) {
  return <SafeAreaView edges={['top']} style={s.safe}>
    <View style={s.row}>
      <PartnerBrand compact />
      <View style={s.title}><Text numberOfLines={1} style={s.name}>{storeName}</Text><Text numberOfLines={1} style={s.role}>{roleLabel}</Text></View>
      {onAdd ? <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add product" hitSlop={8} style={s.add}><Icon name="plus" size={20} color="#fff" /></Pressable> : null}
      <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="Open store menu" hitSlop={8}><Avatar label={storeName} size={36} /></Pressable>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  row: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0 }, name: { color: palette.ink, fontSize: 14, fontWeight: '800' }, role: { color: palette.muted, fontSize: 11, marginTop: 1 },
  add: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0d4a38', alignItems: 'center', justifyContent: 'center' },
});
