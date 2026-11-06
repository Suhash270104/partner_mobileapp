import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { c, ErrorText, Field, Mark } from '../professional/onboardingUi';
import { Sheet } from './Sheet';

export type EditableType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean';

// One tap-to-edit profile field, same five editor types as the desktop EditableField: the value shows as a row,
// tapping opens a sheet with the right control, and the save is awaited so a failure is shown instead of lost.
export function EditableRow({ label, value, type, options = [], optionLabels = {}, placeholder, onSave }: {
  label: string;
  value: unknown;
  type: EditableType;
  options?: string[];
  optionLabels?: Record<string, string>;
  placeholder?: string;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const labelFor = (raw: string) => optionLabels[raw] || raw;
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  const shown = empty ? null : type === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.map(item => labelFor(String(item))).join(', ') : labelFor(String(value));

  function start() {
    setDraft(value ?? (type === 'multiselect' ? [] : type === 'boolean' ? false : ''));
    setError('');
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await onSave(type === 'number' ? Number(draft) || 0 : draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  const list = Array.isArray(draft) ? (draft as string[]) : [];

  return (
    <>
      <Pressable style={s.row} onPress={start} accessibilityLabel={`Edit ${label}`}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{label.toUpperCase()}</Text>
          {shown ? <Text style={s.value}>{shown}</Text> : <Text style={s.empty}>Not set</Text>}
        </View>
        <Text style={s.edit}>Edit</Text>
      </Pressable>

      <Sheet visible={editing} title={label} eyebrow="EDIT" onClose={() => setEditing(false)} locked={saving}>
        {(type === 'text' || type === 'number') && (
          <Field value={String(draft ?? '')} onChangeText={value => setDraft(type === 'number' ? value.replace(/[^0-9.]/g, '') : value)} placeholder={placeholder} keyboardType={type === 'number' ? 'decimal-pad' : 'default'} autoCapitalize="none" />
        )}
        {type === 'boolean' && (
          <View style={{ gap: 8 }}>
            {[[true, 'Yes'], [false, 'No']].map(([value, text]) => (
              <Pressable key={String(text)} style={[s.option, draft === value && s.optionOn]} onPress={() => setDraft(value)}><Mark selected={draft === value} /><Text style={s.optionText}>{String(text)}</Text></Pressable>
            ))}
          </View>
        )}
        {type === 'select' && (
          <View style={{ gap: 8 }}>
            {options.map(option => (
              <Pressable key={option} style={[s.option, draft === option && s.optionOn]} onPress={() => setDraft(option)}><Mark selected={draft === option} /><Text style={s.optionText}>{labelFor(option)}</Text></Pressable>
            ))}
          </View>
        )}
        {type === 'multiselect' && (
          <View style={{ gap: 8 }}>
            {options.map(option => (
              <Pressable key={option} style={[s.option, list.includes(option) && s.optionOn]} onPress={() => setDraft(list.includes(option) ? list.filter(item => item !== option) : [...list, option])}><Mark selected={list.includes(option)} square /><Text style={s.optionText}>{labelFor(option)}</Text></Pressable>
            ))}
          </View>
        )}
        {!!error && <ErrorText>{error}</ErrorText>}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable style={s.outline} onPress={() => setEditing(false)} disabled={saving}><Text style={s.outlineText}>Cancel</Text></Pressable>
          <Pressable style={[s.solid, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Save</Text>}</Pressable>
        </View>
      </Sheet>
    </>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  label: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  value: { color: c.ink, fontSize: 14, fontWeight: '700', marginTop: 2, lineHeight: 20 },
  empty: { color: c.muted, fontSize: 13.5, fontStyle: 'italic', marginTop: 2 },
  edit: { color: c.green, fontSize: 12.5, fontWeight: '800' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, padding: 12 },
  optionOn: { borderColor: c.green, backgroundColor: c.greenSoft },
  optionText: { flex: 1, color: c.ink, fontSize: 14, fontWeight: '700' },
  solid: { flex: 1.4, height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  outline: { flex: 1, height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 14, fontWeight: '800' },
});
