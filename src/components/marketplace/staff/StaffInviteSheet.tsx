import { useState } from 'react';
import { View } from 'react-native';
import { useFormState } from '../../../hooks/useFormState';
import { merchantApi } from '../../../lib/marketplace/api';
import { STAFF_ROLE_OPTIONS } from '../../../lib/marketplace/constants';
import { errorMessage } from '../../../lib/marketplace/errors';
import * as v from '../../../lib/marketplace/validation';
import { BottomSheet, FormField, PillButton, SelectField, Text, palette } from '../../ui';

function InviteForm({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const { form, setErrors, errors, set } = useFormState({ fullName: '', phone: '', email: '', role: 'manager' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const found = v.compact({ fullName: v.lengthBetween(form.fullName, 'Name', 2, 120), phone: v.indianMobile(form.phone), email: v.optionalEmail(form.email) });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true); setError('');
    try {
      await merchantApi.inviteStaff({ fullName: form.fullName.trim(), phone: v.nationalPhone(form.phone), role: form.role, ...(form.email.trim() ? { email: form.email.trim() } : {}) });
      onInvited(); onClose();
    } catch (cause) { setError(errorMessage(cause, 'Could not send the invitation.')); }
    finally { setBusy(false); }
  };

  return <View style={{ gap: 14 }}>
    <FormField label="Full name" required value={form.fullName} onChangeText={t => set('fullName', t)} autoCapitalize="words" error={errors.fullName} />
    <FormField label="Mobile number" required prefix="+91" value={form.phone} onChangeText={t => set('phone', t)} keyboardType="phone-pad" maxLength={14} error={errors.phone} helper="They sign in with this number." />
    <FormField label="Email (optional)" value={form.email} onChangeText={t => set('email', t)} keyboardType="email-address" error={errors.email} />
    <SelectField label="Role" required value={form.role} options={STAFF_ROLE_OPTIONS} onChange={t => set('role', t)} />
    {error ? <Text style={{ color: palette.red, fontSize: 13, fontWeight: '700' }}>{error}</Text> : null}
    <PillButton title="Send invitation" icon="send" loading={busy} onPress={() => void send()} />
  </View>;
}

/** Invite a staff member by phone. They sign in with that number and the invitation is claimed on their first login. */
export function StaffInviteSheet({ visible, onClose, onInvited }: { visible: boolean; onClose: () => void; onInvited: () => void }) {
  return <BottomSheet visible={visible} onClose={onClose} title="Invite team member">{visible ? <InviteForm onClose={onClose} onInvited={onInvited} /> : null}</BottomSheet>;
}
