import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet, Icon, Text, palette } from '../ui';

const SLOT_MINUTES = 30;
const SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const minutes = i * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** Time picker in HH:MM (24 h) as the API expects, offered in half-hour steps. Shows 12-hour text to the person. */
export const to12Hour = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return time || 'Select';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 7 }}>
    <Text style={s.label}>{label}</Text>
    <Pressable onPress={() => setOpen(true)} style={s.box} accessibilityRole="button" accessibilityLabel={`${label}: ${to12Hour(value)}`}>
      <Text style={s.value}>{to12Hour(value)}</Text><Icon name="clock" size={18} color="#33463f" />
    </Pressable>
    <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
      {SLOTS.map(slot => <Pressable key={slot} onPress={() => { onChange(slot); setOpen(false); }} style={[s.option, slot === value && s.optionOn]}>
        <Text style={[s.optionText, slot === value && { color: palette.green, fontWeight: '800' }]}>{to12Hour(slot)}</Text>
        {slot === value ? <Icon name="check" size={20} color={palette.green} /> : null}
      </Pressable>)}
    </BottomSheet>
  </View>;
}

const s = StyleSheet.create({
  label: { color: '#33463f', fontSize: 14, fontWeight: '800' },
  box: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { color: palette.ink, fontSize: 16 },
  option: { minHeight: 50, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionOn: { backgroundColor: palette.greenSoft },
  optionText: { color: '#22332c', fontSize: 16 },
});
