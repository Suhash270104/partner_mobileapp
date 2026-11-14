import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, Text, palette } from '../ui';
import type { StoreTab } from './storeNav';

/** Bottom navigation: line icon, active pill and label for each visible tab. */
export function StoreTabBar({ tabs, activeKey, onSelect, badges = {} }: { tabs: StoreTab[]; activeKey: string; onSelect: (tab: StoreTab) => void; badges?: Record<string, number | undefined> }) {
  return <SafeAreaView edges={['bottom']} style={s.bar}>
    <View style={s.row}>{tabs.map(tab => {
      const on = tab.key === activeKey;
      const badge = badges[tab.key];
      return <Pressable key={tab.key} onPress={() => onSelect(tab)} style={s.tab} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: on }}>
        <View style={[s.pill, on && s.pillOn]}>
          <Icon name={tab.icon} size={22} color={on ? palette.green : '#8a9a92'} />
          {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
        </View>
        <Text numberOfLines={1} style={[s.label, on && s.labelOn]}>{tab.label}</Text>
      </Pressable>;
    })}</View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  row: { flexDirection: 'row', paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: 2 },
  pill: { width: 54, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, pillOn: { backgroundColor: palette.greenSoft },
  label: { color: '#8a9a92', fontSize: 12, fontWeight: '700' }, labelOn: { color: palette.green },
  badge: { position: 'absolute', top: -3, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
