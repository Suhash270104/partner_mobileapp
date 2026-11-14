import { StyleSheet, View } from 'react-native';
import type { FulfilmentStep } from '../../../lib/marketplace/fulfilment';
import { InfoRow, PillButton, Text, palette } from '../../ui';
import { StatusBadge } from '../StatusBadge';

/** One order or return: heading, key facts and the next-step buttons the status allows. */
export function FulfilmentCard({ title, subtitle, status, rows, steps, busy, onStep }: {
  title: string; subtitle?: string; status: string; rows: { label: string; value?: string | number | null }[];
  steps: FulfilmentStep[]; busy?: boolean; onStep: (step: FulfilmentStep) => void;
}) {
  return <View style={s.card}>
    <View style={s.top}><View style={{ flex: 1 }}><Text style={s.title} numberOfLines={1}>{title}</Text>{subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}</View><StatusBadge status={status} /></View>
    {rows.map(row => <InfoRow key={row.label} label={row.label} value={row.value ?? ''} />)}
    {steps.length ? <View style={s.steps}>{steps.map(step => <PillButton key={step.to} compact variant={step.danger ? 'danger' : 'soft'} icon={step.icon} title={step.label} disabled={busy} onPress={() => onStep(step)} />)}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 14, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }, title: { color: palette.ink, fontSize: 15, fontWeight: '800' }, sub: { color: palette.muted, fontSize: 12 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
