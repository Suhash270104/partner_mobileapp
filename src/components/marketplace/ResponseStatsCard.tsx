import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, palette } from '../ui';
import type { Json } from '../../lib/marketplace/types';

/** 90-day responsiveness: share of leads acted on and mean time to first reply. Hidden until the server has enough data (null under 3 leads). */
export function ResponseStatsCard({ stats }: { stats?: Json | null }) {
  const rate = typeof stats?.rate === 'number' ? stats.rate : null;
  const hours = typeof stats?.avgHours === 'number' ? stats.avgHours : null;
  if (rate === null && hours === null) return null;
  return <View style={s.card}>
    <View style={s.top}>
      <View style={s.flex}><Text style={s.label}>RESPONSE RATE · 90 DAYS</Text><Text style={s.value}>{rate === null ? '—' : `${Math.round(rate)}%`}</Text></View>
      <View style={s.right}><Text style={s.label}>FIRST REPLY</Text><Text style={s.value}>{hours === null ? '—' : hours < 1 ? '< 1 h' : `${hours.toFixed(1)} h`}</Text></View>
    </View>
    {rate !== null ? <ProgressBar value={rate} /> : null}
    <Text style={s.note}>Buyers see this on your store. Replying quickly raises it.{stats?.leads90d ? ` Based on ${stats.leads90d} leads.` : ''}</Text>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 10 },
  top: { flexDirection: 'row', gap: 12 }, flex: { flex: 1 }, right: { alignItems: 'flex-end' },
  label: { color: palette.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }, value: { color: palette.ink, fontSize: 26, fontWeight: '800', marginTop: 2 },
  note: { color: palette.body, fontSize: 12, lineHeight: 17 },
});
