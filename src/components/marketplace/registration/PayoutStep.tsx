import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { lookupIfsc } from '../../../lib/marketplace/ifsc';
import type { RegistrationForm } from '../../../lib/marketplace/registration';
import { FormField, Icon, SectionLabel, Text, palette } from '../../ui';
import { FieldNote } from '../FieldNote';
import type { SectionProps } from '../formTypes';

/** Step 4 — bank, payout and consent (hand-off §4.4). */
export function PayoutStep({ form, errors, set }: SectionProps<RegistrationForm>) {
  const [found, setFound] = useState<{ code: string; label: string } | null>(null);
  const ifsc = form.ifscCode.trim().toUpperCase();

  // Resolve the branch once the IFSC is complete. A failed lookup is silent: the person can type the bank name.
  useEffect(() => {
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return;
    const controller = new AbortController();
    void lookupIfsc(ifsc, controller.signal).then(result => {
      if (!result || controller.signal.aborted) return;
      setFound({ code: ifsc, label: [result.branch, result.city].filter(Boolean).join(', ') });
      if (!form.bankName.trim()) set('bankName', result.bank);
    });
    return () => controller.abort();
    // The lookup should rerun only when the code changes, not when the bank name is later edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ifsc]);

  const branch = found?.code === ifsc ? found.label : '';

  return <View style={{ gap: 14 }}>
    <FormField label="Account number" required value={form.accountNumber} onChangeText={v => set('accountNumber', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={18} error={errors.accountNumber}
      helper="Stored securely and always shown masked." />
    <FormField label="Confirm account number" required value={form.confirmAccountNumber} onChangeText={v => set('confirmAccountNumber', v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={18} error={errors.confirmAccountNumber} />
    <FormField label="IFSC code" required value={form.ifscCode} onChangeText={v => set('ifscCode', v.toUpperCase())} autoCapitalize="none" maxLength={11} error={errors.ifscCode}
      helper={branch ? `Branch: ${branch}` : 'Printed on your cheque book or passbook.'} />
    <FormField label="Bank name" required value={form.bankName} onChangeText={v => set('bankName', v)} error={errors.bankName} />
    <FormField label="Account holder name" required value={form.beneficiaryName} onChangeText={v => set('beneficiaryName', v)} error={errors.beneficiaryName} helper="Exactly as printed on the passbook." />
    <SectionLabel icon="shield" title="Agreement" />
    <Pressable onPress={() => set('consent', !form.consent)} accessibilityRole="checkbox" accessibilityState={{ checked: form.consent }} style={[s.consent, !!errors.consent && { borderColor: palette.red }]}>
      <View style={[s.box, form.consent && s.boxOn]}>{form.consent ? <Icon name="check" size={16} color="#fff" /> : null}</View>
      <Text style={s.consentText}>I agree to the Partner Terms and Privacy Policy, and to receive WhatsApp, SMS and email updates about my store.</Text>
    </Pressable>
    <FieldNote text={errors.consent} />
  </View>;
}

const s = StyleSheet.create({
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: palette.line, backgroundColor: '#fff' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#9aa8a1', alignItems: 'center', justifyContent: 'center' }, boxOn: { backgroundColor: '#0d4a38', borderColor: '#0d4a38' },
  consentText: { flex: 1, color: '#33463f', fontSize: 14, lineHeight: 20 },
});
