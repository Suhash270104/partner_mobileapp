import { useFormState } from '../../../hooks/useFormState';
import { merchantApi } from '../../../lib/marketplace/api';
import { LIMITS } from '../../../lib/marketplace/constants';
import type { Store } from '../../../lib/marketplace/types';
import * as v from '../../../lib/marketplace/validation';
import { FormField, InfoRow } from '../../ui';
import { SettingsSection } from './SettingsSection';

/** Payout account (owner only). The stored number is always masked; leave the field empty to keep it. */
export function BankSection({ store, onSaved }: { store: Store; onSaved: () => void }) {
  const bank = store.bankDetails ?? {};
  const { form, errors, setErrors, set } = useFormState(() => ({ accountNumber: '', ifscCode: bank.ifscCode ?? '', beneficiaryName: bank.beneficiaryName ?? '', bankName: bank.bankName ?? '' }));

  const save = async () => {
    const found = v.compact({
      accountNumber: form.accountNumber ? v.accountNumber(form.accountNumber) : undefined, ifscCode: v.ifsc(form.ifscCode),
      beneficiaryName: v.lengthBetween(form.beneficiaryName, 'Account holder name', LIMITS.beneficiary.min, LIMITS.beneficiary.max), bankName: v.lengthBetween(form.bankName, 'Bank name', LIMITS.bankName.min, LIMITS.bankName.max),
    });
    setErrors(found);
    if (Object.keys(found).length) return v.firstError(found);
    // An empty account number is invalid for the server; leaving it out keeps the stored one.
    await merchantApi.saveBank({ ...(form.accountNumber ? { accountNumber: form.accountNumber } : {}), ifscCode: form.ifscCode.trim().toUpperCase(), beneficiaryName: form.beneficiaryName.trim(), bankName: form.bankName.trim() });
    set('accountNumber', '');
    onSaved();
  };

  return <SettingsSection title="Bank & settlement" subtitle="Only the store owner can change this" onSave={save}>
    <InfoRow label="Current account" value={bank.accountNumber} />
    <FormField label="New account number" value={form.accountNumber} onChangeText={t => set('accountNumber', t.replace(/\D/g, ''))} keyboardType="numeric" maxLength={18} error={errors.accountNumber} helper="Leave empty to keep the current account." />
    <FormField label="IFSC code" value={form.ifscCode} onChangeText={t => set('ifscCode', t.toUpperCase())} autoCapitalize="none" maxLength={11} error={errors.ifscCode} />
    <FormField label="Bank name" value={form.bankName} onChangeText={t => set('bankName', t)} error={errors.bankName} />
    <FormField label="Account holder name" value={form.beneficiaryName} onChangeText={t => set('beneficiaryName', t)} error={errors.beneficiaryName} />
  </SettingsSection>;
}
