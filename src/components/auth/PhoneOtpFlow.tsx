import { useState } from 'react';
import { View } from 'react-native';
import { FormField, PillButton, Text, palette } from '../ui';
import { useCountdown } from '../../hooks/useCountdown';
import { AuthApiError } from '../../lib/auth';
import { indianMobile, nationalPhone } from '../../lib/marketplace/validation';

const DEFAULT_RESEND_SECONDS = 30;

const messageOf = (cause: unknown, fallback: string) => {
  if (cause instanceof AuthApiError) {
    if (cause.status === 429 && cause.retryAfterSeconds) return `${cause.message} Try again in ${cause.retryAfterSeconds} seconds.`;
    return cause.message || fallback;
  }
  return cause instanceof Error && cause.message ? cause.message : fallback;
};

/**
 * Phone number → 6-digit code. The parent decides what "send" and "verify" call (sign-in, sign-up or linking a phone
 * to an existing account); this component owns the two inputs, the resend countdown and the error text.
 */
export function PhoneOtpFlow({ sendLabel = 'Send code', verifyLabel = 'Verify', onSend, onVerify }: {
  sendLabel?: string; verifyLabel?: string;
  onSend: (phone: string) => Promise<{ resendAfterSeconds?: number } | void>;
  onVerify: (phone: string, otp: string) => Promise<void>;
}) {
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const countdown = useCountdown();

  const send = async () => {
    const problem = indianMobile(phone, 'Mobile number');
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      const result = await onSend(nationalPhone(phone));
      countdown.start((result && result.resendAfterSeconds) || DEFAULT_RESEND_SECONDS);
      setStage('otp'); setOtp('');
    } catch (cause) { setError(messageOf(cause, 'Could not send the code. Please try again.')); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code.'); return; }
    setBusy(true); setError('');
    try { await onVerify(nationalPhone(phone), otp); }
    catch (cause) { setError(messageOf(cause, 'Could not verify the code. Please try again.')); }
    finally { setBusy(false); }
  };

  if (stage === 'phone') return <View style={{ gap: 14 }}>
    <FormField label="Mobile number" required prefix="+91" value={phone} onChangeText={value => { setPhone(value); setError(''); }} keyboardType="phone-pad" maxLength={14} placeholder="98765 43210" error={error} />
    <PillButton title={sendLabel} icon="send" loading={busy} onPress={() => void send()} />
  </View>;

  return <View style={{ gap: 14 }}>
    <Text style={{ color: palette.body, fontSize: 13.5, lineHeight: 19 }}>We sent a 6-digit code to +91 {nationalPhone(phone)}.</Text>
    <FormField label="Verification code" required value={otp} onChangeText={value => { setOtp(value.replace(/\D/g, '')); setError(''); }} keyboardType="numeric" maxLength={6} placeholder="123456" error={error} />
    <PillButton title={verifyLabel} icon="check" loading={busy} onPress={() => void verify()} />
    <PillButton variant="ghost" title={countdown.seconds > 0 ? `Resend code in ${countdown.seconds}s` : 'Resend code'} disabled={countdown.seconds > 0 || busy} onPress={() => void send()} />
    <PillButton variant="ghost" title="Use a different number" onPress={() => { setStage('phone'); setError(''); setOtp(''); }} />
  </View>;
}
