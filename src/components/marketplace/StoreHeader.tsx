import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerBrand } from '../PartnerBrand';
import { Avatar, Icon, palette } from '../ui';

/** Compact marketplace bar with brand and actions; store identity stays in the More screen. */
export function StoreHeader({ storeName, onAdd, onMenu }: { storeName: string; roleLabel: string; onAdd?: () => void; onMenu: () => void }) {
  return <SafeAreaView edges={['top']} style={s.safe}>
    <View style={s.row}>
      <PartnerBrand small />
      <View style={s.actions}>
        {onAdd ? <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add product" hitSlop={8} style={s.add}><Icon name="plus" size={20} color="#fff" /></Pressable> : null}
        <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="Open store menu" hitSlop={8}><Avatar label={storeName} size={34} /></Pressable>
      </View>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  row: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  add: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0d4a38', alignItems: 'center', justifyContent: 'center' },
});
