import { useState } from 'react';
import { View } from 'react-native';
import { AuthButton, AuthField } from './AuthKit';
import { Text } from '../AppText';
import { useCountdown } from '../../hooks/useCountdown';
import { authMessage } from '../../lib/authErrors';
import { indianMobile, nationalPhone } from '../../lib/marketplace/validation';

const DEFAULT_RESEND_SECONDS = 30;

/**
 * Phone number → 6-digit code, in the login screen's look. The parent decides what "send" and "verify" call (sign-in,
 * sign-up or linking a phone to an existing account); this component owns the two inputs, the resend countdown and the
 * error text. `onError` lets the parent react to a specific failure (for example a number that belongs to another account).
 */
export function PhoneOtpFlow({ sendLabel = 'Send code', verifyLabel = 'Verify', onSend, onVerify, onError }: {
  sendLabel?: string; verifyLabel?: string;
  onSend: (phone: string) => Promise<{ resendAfterSeconds?: number } | void>;
  onVerify: (phone: string, otp: string) => Promise<void>;
  onError?: (cause: unknown) => void;
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
    } catch (cause) { setError(authMessage(cause, 'Could not send the code. Please try again.')); onError?.(cause); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code.'); return; }
    setBusy(true); setError('');
    try { await onVerify(nationalPhone(phone), otp); }
    catch (cause) { setError(authMessage(cause, 'Could not verify the code. Please try again.')); onError?.(cause); }
    finally { setBusy(false); }
  };

  if (stage === 'phone') return <View>
    <AuthField label="Mobile number" prefix="+91" value={phone} onChangeText={value => { setPhone(value.replace(/[^\d\s]/g, '')); setError(''); }}
      keyboardType="phone-pad" maxLength={11} placeholder="98765 43210" textContentType="telephoneNumber" autoComplete="tel" returnKeyType="go" onSubmitEditing={() => void send()}
      error={error} helper="We will text you a 6-digit code." />
    <AuthButton title={sendLabel} loading={busy} onPress={() => void send()} />
  </View>;

  return <View>
    <Text style={{ color: '#34485d', fontSize: 13, lineHeight: 19, marginBottom: 14 }}>We sent a 6-digit code to +91 {nationalPhone(phone)}.</Text>
    <AuthField label="Verification code" value={otp} onChangeText={value => { setOtp(value.replace(/\D/g, '')); setError(''); }}
      keyboardType="number-pad" maxLength={6} placeholder="123456" textContentType="oneTimeCode" autoComplete="sms-otp" returnKeyType="go" onSubmitEditing={() => void verify()}
      error={error} />
    <AuthButton title={verifyLabel} loading={busy} onPress={() => void verify()} />
    <AuthButton variant="link" title={countdown.seconds > 0 ? `Resend code in ${countdown.seconds}s` : 'Resend code'} disabled={countdown.seconds > 0 || busy} onPress={() => void send()} />
    <AuthButton variant="link" title="Use a different number" onPress={() => { setStage('phone'); setError(''); setOtp(''); }} />
  </View>;
}
