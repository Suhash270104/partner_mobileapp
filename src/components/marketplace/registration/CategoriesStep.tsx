import { View } from 'react-native';
import { useTaxonomy } from '../../../hooks/useTaxonomy';
import { CAPABILITY_OPTIONS, LIMITS } from '../../../lib/marketplace/constants';
import type { RegistrationForm } from '../../../lib/marketplace/registration';
import { splitList } from '../../../lib/marketplace/validation';
import { ChipGroup, FormField, PillButton, SectionLabel, StatePanel, Text, ToggleRow, palette } from '../../ui';
import { FieldNote } from '../FieldNote';
import { TimeField } from '../TimeField';
import type { SectionProps } from '../formTypes';

/** Step 3 — categories, capabilities, regions and hours (hand-off §4.3). */
export function CategoriesStep({ form, errors, set }: SectionProps<RegistrationForm>) {
  const taxonomy = useTaxonomy();
  const areas = splitList(form.serviceAreas);
  return <View style={{ gap: 14 }}>
    {taxonomy.error ? <StatePanel title="Categories unavailable" message={taxonomy.error} retry={taxonomy.retry} /> : null}
    {taxonomy.loading ? <Text style={{ color: palette.muted }}>Loading marketplace categories…</Text> : null}
    {taxonomy.categories.length ? <ChipGroup label="What do you sell?" required multi value={form.businessCategories} onChange={v => set('businessCategories', v)}
      options={taxonomy.categories.map(c => ({ value: c.name, label: c.name }))} /> : null}
    <FieldNote text={errors.businessCategories} />
    <ChipGroup label="Capabilities" multi value={form.capabilities} options={CAPABILITY_OPTIONS} onChange={v => set('capabilities', v)} />
    <FormField label="Cities / regions you supply" value={form.serviceAreas} onChangeText={v => set('serviceAreas', v)} placeholder="Bengaluru, Mysuru, Chennai" error={errors.serviceAreas}
      helper={areas.length ? `${areas.length} of ${LIMITS.serviceAreas.items}: ${areas.join(' · ')}` : 'Separate with commas.'} />
    <FormField label="Certifications" value={form.certifications} onChangeText={v => set('certifications', v)} placeholder="ISO 9001, BIS" error={errors.certifications} helper="Separate with commas." />
    <SectionLabel icon="clock" title="Operating hours" />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}><TimeField label="Opens" value={form.openTime} onChange={v => set('openTime', v)} /></View>
      <View style={{ flex: 1 }}><TimeField label="Closes" value={form.closeTime} onChange={v => set('closeTime', v)} /></View>
    </View>
    <FieldNote text={errors.closeTime} />
    <ToggleRow label="Open on Sundays" value={form.isOpenSundays} onChange={v => set('isOpenSundays', v)} />
    {taxonomy.error ? <PillButton title="Reload categories" variant="soft" onPress={taxonomy.retry} /> : null}
  </View>;
}
