import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DIMENSION_UNIT_OPTIONS } from '../../../lib/marketplace/constants';
import type { ProductForm } from '../../../lib/marketplace/productForm';
import { FormField, Icon, SelectField, Text, palette } from '../../ui';
import type { SectionProps } from '../formTypes';

const decimal = (value: string) => value.replace(/[^\d.]/g, '');

/** Interior specifications. Collapsed by default because most products do not need them. */
export function ProductSpecsSection({ form, errors, set }: SectionProps<ProductForm>) {
  const [open, setOpen] = useState(!!(form.material || form.finish || form.color || form.length || form.thickness || form.weight || form.warrantyYears));
  return <View style={s.card}>
    <Pressable onPress={() => setOpen(!open)} style={s.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <View style={{ flex: 1 }}><Text style={s.title}>Specifications</Text><Text style={s.sub}>Material, finish, size, warranty (optional)</Text></View>
      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={22} color="#33463f" />
    </Pressable>
    {open ? <View style={s.body}>
      <FormField label="Material" value={form.material} onChangeText={v => set('material', v)} error={errors.material} />
      <FormField label="Finish" value={form.finish} onChangeText={v => set('finish', v)} />
      <FormField label="Colour" value={form.color} onChangeText={v => set('color', v)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><FormField label="Length" value={form.length} onChangeText={v => set('length', decimal(v))} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><FormField label="Width" value={form.width} onChangeText={v => set('width', decimal(v))} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><FormField label="Height" value={form.height} onChangeText={v => set('height', decimal(v))} keyboardType="decimal-pad" /></View>
      </View>
      <SelectField label="Dimension unit" value={form.dimensionUnit} options={DIMENSION_UNIT_OPTIONS} onChange={v => set('dimensionUnit', v)} />
      <FormField label="Thickness" value={form.thickness} onChangeText={v => set('thickness', v)} />
      <FormField label="Weight" value={form.weight} onChangeText={v => set('weight', v)} />
      <FormField label="Warranty (years)" value={form.warrantyYears} onChangeText={v => set('warrantyYears', decimal(v))} keyboardType="decimal-pad" />
      <FormField label="Care instructions" value={form.careInstructions} onChangeText={v => set('careInstructions', v)} multiline />
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }, title: { color: palette.ink, fontSize: 17, fontWeight: '800' }, sub: { color: palette.muted, fontSize: 12, marginTop: 2 },
  body: { padding: 16, paddingTop: 0, gap: 14 },
});
