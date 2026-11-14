import { View } from 'react-native';
import { FormField, SectionLabel, SelectField } from '../../ui';
import {
  ANNUAL_TURNOVER_OPTIONS, BUSINESS_TYPE_OPTIONS, EMPLOYEE_OPTIONS, LEGAL_STATUS_OPTIONS, LIMITS, ORDERS_FULFILLED_OPTIONS,
} from '../../../lib/marketplace/constants';
import type { RegistrationForm } from '../../../lib/marketplace/registration';
import { FieldNote } from '../FieldNote';
import type { SectionProps } from '../formTypes';

const NOT_SPECIFIED = [{ value: '', label: 'Prefer not to say' }];

/** Step 1 — store & business info (hand-off §4.1). */
export function StoreStep({ form, errors, set }: SectionProps<RegistrationForm>) {
  return <View style={{ gap: 14 }}>
    <FormField label="Store display name" required value={form.storeName} onChangeText={v => set('storeName', v)} placeholder="e.g. Apex Glass Studio" maxLength={LIMITS.storeName.max} error={errors.storeName}
      helper="Shown to buyers. The store link is generated from it and cannot be changed later." />
    <FormField label="Legal business name" required value={form.businessName} onChangeText={v => set('businessName', v)} maxLength={LIMITS.businessName.max} error={errors.businessName}
      helper="Exactly as registered. Used on invoices and payouts; cannot be edited after registration." />
    <FormField label="GSTIN, business PAN or trade licence" required value={form.businessId} onChangeText={v => set('businessId', v.toUpperCase())} autoCapitalize="none" maxLength={30} error={errors.businessId}
      helper="Format is checked here; your team verifies it against the business name before payouts." />
    <SectionLabel icon="briefcase" title="Business profile" />
    <SelectField label="Nature of business" required value={form.businessType} options={BUSINESS_TYPE_OPTIONS} onChange={v => set('businessType', v)} />
    {errors.businessType ? <FieldNote text={errors.businessType} /> : null}
    <SelectField label="Legal status" required value={form.legalStatus} options={LEGAL_STATUS_OPTIONS} onChange={v => set('legalStatus', v)} />
    {errors.legalStatus ? <FieldNote text={errors.legalStatus} /> : null}
    <FormField label="In business since (year)" required value={form.yearEstablished} onChangeText={v => set('yearEstablished', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={4} placeholder="e.g. 2012" error={errors.yearEstablished} />
    <SelectField label="Number of employees" required value={form.employeeCount} options={EMPLOYEE_OPTIONS} onChange={v => set('employeeCount', v)} />
    {errors.employeeCount ? <FieldNote text={errors.employeeCount} /> : null}
    <SelectField label="Orders / projects supplied so far" required value={form.ordersFulfilled} options={ORDERS_FULFILLED_OPTIONS} onChange={v => set('ordersFulfilled', v)} />
    {errors.ordersFulfilled ? <FieldNote text={errors.ordersFulfilled} /> : null}
    <SelectField label="Annual turnover (optional)" value={form.annualTurnover} options={[...NOT_SPECIFIED, ...ANNUAL_TURNOVER_OPTIONS]} onChange={v => set('annualTurnover', v)} placeholder="Prefer not to say" />
    <FormField label="Import Export Code (optional)" value={form.iecCode} onChangeText={v => set('iecCode', v.toUpperCase())} autoCapitalize="none" maxLength={LIMITS.iecCode} error={errors.iecCode} />
    <FormField label="Tagline / short description (optional)" value={form.description} onChangeText={v => set('description', v)} multiline maxLength={LIMITS.description} error={errors.description} />
  </View>;
}
