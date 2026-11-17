import { useState } from 'react';
import { router } from 'expo-router';
import { PhoneOtpFlow } from '../components/auth/PhoneOtpFlow';
import { AuthButton, AuthNotice, AuthShell } from '../components/auth/AuthKit';
import { authApi } from '../lib/auth';
import { AUTH_CODE, hasAuthCode, isRestartError } from '../lib/authErrors';
import { getPendingPhone, setPendingPhone } from '../lib/pendingPhone';

const leaveToLogin = () => { setPendingPhone(null); router.replace('/login' as never); };
/** The number belongs to another account: the plain mobile flow signs into that account instead. */
const switchToMobile = () => { setPendingPhone(null); router.replace('/mobile-signin' as never); };

/**
 * One-time phone check after email or Google sign-in. The server withholds the session until the account has an
 * OTP-verified mobile number; verifying it here creates (or links) the account and signs the person in.
 * It is asked once per account: every later sign-in, by any method, goes straight in.
 */
export default function VerifyPhoneScreen() {
  const pending = getPendingPhone();
  const [numberInUse, setNumberInUse] = useState(false);

  if (!pending) {
    return <AuthShell headerTitle="Verify mobile" title="Verify your mobile number" onBack={leaveToLogin}>
      <AuthNotice title="This step has timed out" message="For your security the verification window is short. Sign in again to continue." />
      <AuthButton title="Back to sign in" onPress={leaveToLogin} />
    </AuthShell>;
  }

  // The 15-minute window passed, or the account was verified meanwhile: the sign-in has to be redone from the start.
  const guard = async <T,>(action: () => Promise<T>): Promise<T> => {
    try { return await action(); }
    catch (cause) { if (isRestartError(cause)) leaveToLogin(); throw cause; }
  };

  return <AuthShell headerTitle="Verify mobile" title="Verify your mobile number" subtitle={pending.name ? `Welcome, ${pending.name.split(' ')[0]}! One last step.` : 'One last step to finish signing in.'} onBack={leaveToLogin}>
    <PhoneOtpFlow sendLabel="Send code" verifyLabel="Verify and continue"
      onError={cause => setNumberInUse(hasAuthCode(cause, AUTH_CODE.phoneInUse))}
      onSend={phone => guard(() => authApi.linkSend(pending.pendingToken, phone))}
      onVerify={async (phone, otp) => {
        await guard(() => authApi.linkComplete(pending.pendingToken, phone, otp));
        // Proof of agreement is recorded for brand-new accounts; a failed audit write must never undo the sign-in.
        if (pending.isNew) await authApi.recordLegalConsent('studio_signup').catch(() => undefined);
        setPendingPhone(null);
        router.replace('/' as never);
      }} />
    {numberInUse ? <AuthButton variant="outline" title="Sign in with this number instead" onPress={switchToMobile} /> : null}
  </AuthShell>;
}
