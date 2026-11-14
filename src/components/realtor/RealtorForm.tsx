import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, ScrollViewInstance, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { Option } from './RealtorControls';

// Form inputs styled like the website (rounded pill inputs, bold labels, chip pickers, numbered step tabs).

export function FormField({ label, value, onChangeText, placeholder, required, multiline, keyboardType, helper, error, maxLength, autoCapitalize, prefix }: {
  label?: string; value: string; onChangeText: (value: string) => void; placeholder?: string; required?: boolean; multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad' | 'url'; helper?: string; error?: string; maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words'; prefix?: string;
}) {
  return <View style={s.field}>
    {label ? <Text style={s.label}>{label}{required ? <Text style={{ color: palette.red }}> *</Text> : null}</Text> : null}
    <View style={[s.inputWrap, multiline && s.inputWrapMulti, !!error && { borderColor: palette.red }]}>
      {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9aa8a1" multiline={multiline} keyboardType={keyboardType}
        maxLength={maxLength} autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' || keyboardType === 'url' ? 'none' : 'sentences')} accessibilityLabel={label}
        style={[s.input, multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 }]} />
    </View>
    {error ? <Text style={s.error}>{error}</Text> : helper ? <Text style={s.helper}>{helper}</Text> : null}
  </View>;
}

export function SectionLabel({ icon, title }: { icon?: string; title: string }) {
  return <View style={s.sectionLabel}>{icon ? <Icon name={icon} size={18} color={palette.greenText} /> : null}<Text style={s.sectionLabelText}>{title.toUpperCase()}</Text></View>;
}

/** Single- or multi-select chips. `values` are enum values, `options` provide labels. */
export function ChipGroup({ label, options, value, onChange, multi = false, required }: { label?: string; options: Option[]; value: string | string[]; onChange: (value: any) => void; multi?: boolean; required?: boolean }) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return <View style={s.field}>
    {label ? <Text style={s.label}>{label}{required ? <Text style={{ color: palette.red }}> *</Text> : null}</Text> : null}
    <View style={s.chips}>{options.map(option => {
      const on = selected.includes(option.value);
      return <Pressable key={option.value} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ selected: on }}
        onPress={() => onChange(multi ? (on ? selected.filter(item => item !== option.value) : [...selected, option.value]) : (on && !required ? '' : option.value))}
        style={[s.chip, on && s.chipOn]}>
        {on ? <Icon name="check" size={14} color="#fff" /> : null}
        <Text style={[s.chipText, on && { color: '#fff' }]}>{option.label}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

export function ToggleRow({ label, value, onChange, helper }: { label: string; value: boolean; onChange: (value: boolean) => void; helper?: string }) {
  return <View style={s.toggle}>
    <View style={{ flex: 1 }}><Text style={s.toggleLabel}>{label}</Text>{helper ? <Text style={s.helper}>{helper}</Text> : null}</View>
    <Switch value={value} onValueChange={onChange} trackColor={{ false: '#cfd8d4', true: '#7fcaa6' }} thumbColor={value ? palette.green : '#fff'} accessibilityLabel={label} />
  </View>;
}

/** Numbered pill tabs for multi-step sheets: active step is a dark pill, finished steps show a check. */
export function StepTabs({ steps, current, onSelect, reached }: { steps: string[]; current: number; onSelect: (index: number) => void; reached: number }) {
  const scroller = useRef<ScrollViewInstance>(null);
  useEffect(() => { scroller.current?.scrollTo({ x: Math.max(0, current * 150 - 40), animated: true }); }, [current]);
  return <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.steps} style={s.stepsWrap}>
    {steps.map((step, index) => {
      const on = index === current, done = index < current;
      return <Pressable key={step} disabled={index > reached} onPress={() => onSelect(index)} style={[s.step, on && s.stepOn, index > reached && { opacity: 0.55 }]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
        <View style={[s.stepNum, on && { backgroundColor: '#fff' }, done && { backgroundColor: palette.green }]}>
          {done ? <Icon name="check" size={13} color="#fff" /> : <Text style={[s.stepNumText, on && { color: palette.green }]}>{index + 1}</Text>}
        </View>
        <Text style={[s.stepText, on && { color: '#fff' }]}>{step}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

const s = StyleSheet.create({
  field: { gap: 7 }, label: { color: '#33463f', fontSize: 14, fontWeight: '800' },
  inputWrap: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }, inputWrapMulti: { borderRadius: 22, alignItems: 'flex-start' },
  prefix: { color: palette.body, fontSize: 16, fontWeight: '700' }, input: { flex: 1, color: palette.ink, fontSize: 16, paddingVertical: 12 },
  helper: { color: palette.muted, fontSize: 12, lineHeight: 17 }, error: { color: palette.red, fontSize: 12, fontWeight: '700' },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }, sectionLabelText: { color: '#33463f', fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#0d4a38', borderColor: '#0d4a38' }, chipText: { color: '#33463f', fontSize: 14, fontWeight: '700' },
  toggle: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, toggleLabel: { color: '#22332c', fontSize: 15, fontWeight: '700' },
  stepsWrap: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, steps: { gap: 10, paddingVertical: 12, paddingHorizontal: 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: 20 }, stepOn: { backgroundColor: '#0d4a38' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e3e9ee', alignItems: 'center', justifyContent: 'center' }, stepNumText: { color: '#5b6b64', fontSize: 13, fontWeight: '800' },
  stepText: { color: '#5b6b64', fontSize: 14, fontWeight: '800' },
});
