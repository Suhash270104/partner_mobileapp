import { useTaxonomy } from '../../../hooks/useTaxonomy';
import { useFormState } from '../../../hooks/useFormState';
import { merchantApi } from '../../../lib/marketplace/api';
import {
  ANNUAL_TURNOVER_OPTIONS, BUSINESS_TYPE_OPTIONS, CAPABILITY_OPTIONS, EMPLOYEE_OPTIONS, LEGAL_STATUS_OPTIONS, LIMITS, ORDERS_FULFILLED_OPTIONS,
} from '../../../lib/marketplace/constants';
import type { Store } from '../../../lib/marketplace/types';
import * as v from '../../../lib/marketplace/validation';
import { ChipGroup, FormField, InfoRow, SelectField } from '../../ui';
import { SettingsSection } from './SettingsSection';

/** Business profile. Legal name, business ID and store link are shown but cannot be changed (hand-off §11). */
export function BusinessSection({ store, canEdit, onSaved }: { store: Store; canEdit: boolean; onSaved: () => void }) {
  const taxonomy = useTaxonomy();
  const { form, errors, setErrors, set } = useFormState(() => ({
    businessType: store.businessType ?? '', legalStatus: store.legalStatus ?? '', yearEstablished: store.yearEstablished ? String(store.yearEstablished) : '',
    employeeCount: store.employeeCount ?? '', ordersFulfilled: store.ordersFulfilled ?? '', annualTurnover: store.annualTurnover ?? '', iecCode: store.iecCode ?? '',
    businessCategories: store.businessCategories ?? [], capabilities: store.capabilities ?? [], serviceAreas: (store.serviceAreas ?? []).join(', '), certifications: (store.certifications ?? []).join(', '),
  }));

  const save = async () => {
    const found = v.compact({
      yearEstablished: v.year(form.yearEstablished), iecCode: v.iecCode(form.iecCode), businessCategories: form.businessCategories.length ? undefined : 'Choose at least one category.',
      serviceAreas: v.listItems(v.splitList(form.serviceAreas), 'Service areas', LIMITS.serviceAreas.items, LIMITS.serviceAreas.length),
      certifications: v.listItems(v.splitList(form.certifications), 'Certifications', LIMITS.certifications.items, LIMITS.certifications.length),
    });
    setErrors(found);
    if (Object.keys(found).length) return v.firstError(found);
    await merchantApi.saveStore({
      businessType: form.businessType, legalStatus: form.legalStatus, yearEstablished: Number(form.yearEstablished), employeeCount: form.employeeCount, ordersFulfilled: form.ordersFulfilled,
      ...(form.annualTurnover ? { annualTurnover: form.annualTurnover } : {}), ...(form.iecCode.trim() ? { iecCode: form.iecCode.trim().toUpperCase() } : {}),
      businessCategories: form.businessCategories, capabilities: form.capabilities, serviceAreas: v.splitList(form.serviceAreas), certifications: v.splitList(form.certifications),
    });
    onSaved();
  };

  return <SettingsSection title="Business profile" subtitle="Legal name and business ID cannot be changed" readOnly={!canEdit} onSave={save}>
    <InfoRow label="Legal name" value={store.businessName} />
    <InfoRow label="Business ID" value={store.businessId} />
    <InfoRow label="Store link" value={store.slug} />
    <SelectField label="Nature of business" value={form.businessType} options={BUSINESS_TYPE_OPTIONS} onChange={t => set('businessType', t)} />
    <SelectField label="Legal status" value={form.legalStatus} options={LEGAL_STATUS_OPTIONS} onChange={t => set('legalStatus', t)} />
    <FormField label="In business since" value={form.yearEstablished} onChangeText={t => set('yearEstablished', t.replace(/\D/g, ''))} keyboardType="numeric" maxLength={4} error={errors.yearEstablished} />
    <SelectField label="Employees" value={form.employeeCount} options={EMPLOYEE_OPTIONS} onChange={t => set('employeeCount', t)} />
    <SelectField label="Orders supplied" value={form.ordersFulfilled} options={ORDERS_FULFILLED_OPTIONS} onChange={t => set('ordersFulfilled', t)} />
    <SelectField label="Annual turnover" value={form.annualTurnover} options={[{ value: '', label: 'Prefer not to say' }, ...ANNUAL_TURNOVER_OPTIONS]} onChange={t => set('annualTurnover', t)} placeholder="Prefer not to say" />
    <FormField label="Import Export Code" value={form.iecCode} onChangeText={t => set('iecCode', t.toUpperCase())} autoCapitalize="none" maxLength={LIMITS.iecCode} error={errors.iecCode} />
    <ChipGroup label="Categories you sell" multi value={form.businessCategories} onChange={t => set('businessCategories', t)} options={taxonomy.categories.map(c => ({ value: c.name, label: c.name }))} />
    <ChipGroup label="Capabilities" multi value={form.capabilities} onChange={t => set('capabilities', t)} options={CAPABILITY_OPTIONS} />
    <FormField label="Cities / regions you supply" value={form.serviceAreas} onChangeText={t => set('serviceAreas', t)} error={errors.serviceAreas} helper="Separate with commas." />
    <FormField label="Certifications" value={form.certifications} onChangeText={t => set('certifications', t)} error={errors.certifications} helper="Separate with commas." />
  </SettingsSection>;
}
