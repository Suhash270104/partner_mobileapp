import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Icon } from '../Icon';
import { Text, TextInput } from '../AppText';
import { palette } from '../vertical/VerticalUi';

function dateFromValue(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    if (date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])) return date;
  }
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateToValue(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePickerField({ label, value, onChange, placeholder = 'YYYY-MM-DD', helper, minimumDate, required = false, error }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helper?: string;
  /** Earliest day the picker offers. */
  minimumDate?: Date;
  required?: boolean;
  /** A validation message for this field. */
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => dateFromValue(value));
  const [pickerError, setPickerError] = useState('');

  function showPicker() {
    setPickerError('');
    const chosen = dateFromValue(value);
    const initial = minimumDate && chosen < minimumDate ? minimumDate : chosen;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate,
        onValueChange: (_event, selectedDate) => { setPickerError(''); onChange(dateToValue(selectedDate)); },
        onError: error => setPickerError(error.message || 'Could not open the date picker.'),
      });
      return;
    }
    setDraft(initial);
    setOpen(true);
  }

  return <View style={s.field}>
    <Text style={s.label}>{label}{required ? ' *' : ''}</Text>
    {Platform.OS === 'web' ? <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9aa8a1" accessibilityLabel={label} style={s.input} /> : (
      <View style={s.inputRow}>
        <Pressable onPress={showPicker} style={s.inputButton} accessibilityRole="button" accessibilityLabel={`Choose ${label}`}>
          <Text style={[s.value, !value && s.placeholder]} numberOfLines={1}>{value || placeholder}</Text>
          <Icon name="calendar" size={19} color={palette.muted} />
        </Pressable>
        {value ? <Pressable onPress={() => { setPickerError(''); onChange(''); }} accessibilityRole="button" accessibilityLabel={`Clear ${label}`} style={s.clear}>
          <Icon name="x" size={18} color={palette.muted} />
        </Pressable> : null}
      </View>
    )}
    {pickerError || error ? <Text style={s.error}>{pickerError || error}</Text> : null}
    {helper ? <Text style={s.helper}>{helper}</Text> : null}
    {Platform.OS === 'ios' && open ? <View style={s.picker}>
      <DateTimePicker mode="date" minimumDate={minimumDate} display="spinner" locale="en-IN" value={draft} onValueChange={(_event, date) => setDraft(date)} />
      <View style={s.pickerActions}>
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button"><Text style={s.cancel}>Cancel</Text></Pressable>
        <Pressable onPress={() => { onChange(dateToValue(draft)); setOpen(false); }} accessibilityRole="button"><Text style={s.done}>Done</Text></Pressable>
      </View>
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  field: { gap: 7 },
  label: { color: '#33463f', fontSize: 13.5, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputButton: { flex: 1, minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  value: { flex: 1, color: palette.ink, fontSize: 14.5 },
  placeholder: { color: '#9aa8a1' },
  clear: { minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef3f1' },
  input: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 18, color: palette.ink, fontSize: 14.5 },
  helper: { color: palette.muted, fontSize: 11.5, lineHeight: 16 },
  error: { color: palette.red, fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  picker: { borderWidth: 1, borderColor: palette.line, borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 8, paddingTop: 6 },
  pickerActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  cancel: { color: palette.body, fontSize: 13.5, fontWeight: '700' },
  done: { color: palette.greenText, fontSize: 13.5, fontWeight: '800' },
});
