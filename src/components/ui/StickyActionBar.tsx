import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { PillButton } from '../realtor/RealtorControls';

export type BarAction = { title: string; onPress: () => void; icon?: string; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'soft' | 'danger' | 'ghost' };

/** Footer pinned under a form: an optional error line, then up to three buttons sharing the row. */
export function StickyActionBar({ actions, error, note }: { actions: BarAction[]; error?: string; note?: ReactNode }) {
  return <View style={s.bar}>
    {error ? <Text style={s.error}>{error}</Text> : null}
    {note ? <Text style={s.note}>{note}</Text> : null}
    <View style={s.row}>{actions.map((action, index) => <PillButton key={action.title + index} {...action} grow />)}</View>
  </View>;
}

const s = StyleSheet.create({
  bar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line },
  row: { flexDirection: 'row', gap: 10 }, error: { color: palette.red, fontSize: 13, fontWeight: '700', textAlign: 'center' }, note: { color: palette.muted, fontSize: 12, textAlign: 'center' },
});
