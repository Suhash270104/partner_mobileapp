import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, palette } from '../ui';
import { StarRow } from './ReviewCard';

/** Average rating with one bar per star count. */
export function RatingBreakdown({ average, count, breakdown }: { average?: number; count?: number; breakdown?: Record<string, number> }) {
  const total = count ?? Object.values(breakdown ?? {}).reduce((a, b) => a + b, 0);
  return <View style={s.card}>
    <View style={s.top}>
      <Text style={s.avg}>{total ? (average ?? 0).toFixed(1) : '—'}</Text>
      <View style={{ gap: 4 }}><StarRow rating={average ?? 0} size={20} /><Text style={s.count}>{total} {total === 1 ? 'review' : 'reviews'}</Text></View>
    </View>
    {[5, 4, 3, 2, 1].map(star => {
      const n = breakdown?.[String(star)] ?? 0;
      return <View key={star} style={s.row}><Text style={s.star}>{star}★</Text><View style={{ flex: 1 }}><ProgressBar value={total ? (n / total) * 100 : 0} /></View><Text style={s.n}>{n}</Text></View>;
    })}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 16, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 }, avg: { color: palette.ink, fontSize: 44, fontWeight: '800' }, count: { color: palette.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, star: { width: 26, color: palette.body, fontSize: 13, fontWeight: '700' }, n: { width: 28, textAlign: 'right', color: palette.muted, fontSize: 13 },
});
