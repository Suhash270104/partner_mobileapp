import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';

export type BarDatum = { label: string; value: number };

/** Minimal vertical bar chart (no chart library): bars scale to the largest value; sparse labels keep it readable. */
export function BarChart({ data, height = 120, format }: { data: BarDatum[]; height?: number; format?: (value: number) => string }) {
  const max = Math.max(...data.map(d => d.value), 0);
  const step = Math.max(1, Math.ceil(data.length / 6));
  return <View accessibilityRole="image" accessibilityLabel={`Bar chart with ${data.length} points`}>
    <View style={[s.plot, { height }]}>
      {data.map((d, i) => <View key={`${d.label}-${i}`} style={s.col}>
        <View style={[s.bar, { height: max ? Math.max(d.value > 0 ? 3 : 0, (d.value / max) * height) : 0 }]} />
      </View>)}
    </View>
    <View style={s.labels}>{data.map((d, i) => <Text key={`${d.label}-${i}`} style={s.label} numberOfLines={1}>{i % step === 0 ? d.label : ''}</Text>)}</View>
    {format && max > 0 ? <Text style={s.peak}>Peak {format(max)}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  col: { flex: 1, justifyContent: 'flex-end', height: '100%' }, bar: { width: '100%', backgroundColor: '#2f8a68', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  labels: { flexDirection: 'row', gap: 2, marginTop: 4 }, label: { flex: 1, color: palette.muted, fontSize: 9, textAlign: 'center' },
  peak: { color: palette.muted, fontSize: 11, marginTop: 6 },
});
