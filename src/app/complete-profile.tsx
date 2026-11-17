import { useState } from 'react';
import { router } from 'expo-router';
import { AuthButton, AuthField, AuthShell, authColors } from '../components/auth/AuthKit';
import { Text } from '../components/AppText';
import { authApi } from '../lib/auth';
import { authMessage } from '../lib/authErrors';
import { compact, firstError, lengthBetween, optionalEmail, required } from '../lib/marketplace/validation';

/**
 * Shown when a signed-in account still has no name or email (for example it was created with a phone number alone).
 * There is no way past it except filling it in, so every account the partner team sees has real contact details.
 */
export default function CompleteProfileScreen() {
  const [form, setForm] = useState({ name: '', email: '', city: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const found = compact({ name: lengthBetween(form.name, 'Name', 2, 120), email: required(form.email, 'Email') || optionalEmail(form.email) });
    setErrors(found);
    if (Object.keys(found).length) { setError(firstError(found) ?? ''); return; }
    setBusy(true); setError('');
    try {
      await authApi.mobileUpdateBasics({ name: form.name.trim(), email: form.email.trim().toLowerCase(), ...(form.city.trim() ? { city: form.city.trim() } : {}) });
      router.replace('/' as never);
    } catch (cause) { setError(authMessage(cause, 'Could not save your details. Please try again.')); }
    finally { setBusy(false); }
  };

  return <AuthShell headerTitle="Complete account" title="Complete your account" subtitle="We need your name and email before you continue.">
    <AuthField label="Full name" value={form.name} onChangeText={name => setForm(f => ({ ...f, name }))} autoCapitalize="words" textContentType="name" placeholder="Your full name" error={errors.name} />
    <AuthField label="Email" value={form.email} onChangeText={email => setForm(f => ({ ...f, email }))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" placeholder="you@example.com" error={errors.email} />
    <AuthField label="City (optional)" value={form.city} onChangeText={city => setForm(f => ({ ...f, city }))} placeholder="Where are you based?" />
    {error ? <Text style={{ color: authColors.error, fontSize: 12, marginBottom: 10 }}>{error}</Text> : null}
    <AuthButton title="Save and continue" loading={busy} onPress={() => void submit()} />
  </AuthShell>;
}
