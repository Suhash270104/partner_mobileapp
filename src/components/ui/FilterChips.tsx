import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';

export type FilterOption = { value: string; label: string; count?: number };

/** Horizontally scrolling single-select filter (status tabs, rating filters) with optional counts. */
export function FilterChips({ options, value, onChange }: { options: FilterOption[]; value: string; onChange: (value: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} style={s.wrap}>
    {options.map(option => {
      const on = option.value === value;
      return <Pressable key={option.value || 'all'} onPress={() => onChange(option.value)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && s.on]}>
        <Text style={[s.text, on && s.textOn]}>{option.label}{typeof option.count === 'number' ? `  ${option.count}` : ''}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

const s = StyleSheet.create({
  wrap: { flexGrow: 0, marginHorizontal: -16 }, row: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', justifyContent: 'center' },
  on: { backgroundColor: '#0d4a38', borderColor: '#0d4a38' }, text: { color: '#33463f', fontSize: 13, fontWeight: '700' }, textOn: { color: '#fff' },
});
