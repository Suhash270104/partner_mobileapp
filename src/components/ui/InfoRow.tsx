import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';

/** Label on the left, value on the right. Renders nothing when there is no value, so callers do not need guards. */
export function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '' || value === false) return null;
  return <View style={s.row}><Text style={s.label}>{label}</Text>{typeof value === 'string' || typeof value === 'number' ? <Text style={s.value}>{value}</Text> : value}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 6 },
  label: { color: palette.muted, fontSize: 13 }, value: { flex: 1, color: palette.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});
