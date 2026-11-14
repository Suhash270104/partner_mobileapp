import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from '../Icon';
import { palette } from '../vertical/VerticalUi';

/** Search box that reports the typed text after a short pause, so lists do not reload on every keystroke. */
export function SearchField({ value, onChange, placeholder = 'Search', delay = 400 }: { value: string; onChange: (value: string) => void; placeholder?: string; delay?: number }) {
  // While typing, show the draft; once the debounced value is reported, fall back to the parent's value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { onChange(next.trim()); setDraft(null); }, delay);
  };
  return <View style={s.box}>
    <Icon name="search" size={19} color={palette.muted} />
    <TextInput value={text} onChangeText={change} placeholder={placeholder} placeholderTextColor="#9aa8a1" style={s.input} returnKeyType="search" autoCorrect={false} accessibilityLabel={placeholder}
      onSubmitEditing={() => { if (timer.current) clearTimeout(timer.current); onChange(text.trim()); setDraft(null); }} />
    {text ? <Pressable hitSlop={10} accessibilityLabel="Clear search" onPress={() => { if (timer.current) clearTimeout(timer.current); setDraft(null); onChange(''); }}><Icon name="x" size={18} color={palette.muted} /></Pressable> : null}
  </View>;
}

const s = StyleSheet.create({
  box: { minHeight: 48, borderRadius: 24, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, color: palette.ink, fontSize: 15, paddingVertical: 10 },
});
