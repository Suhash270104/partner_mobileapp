import { router } from 'expo-router';
import { PhoneOtpFlow } from '../components/auth/PhoneOtpFlow';
import { AlertBanner, PillButton, Screen } from '../components/ui';
import { AuthApiError, authApi } from '../lib/auth';
import { getPendingPhone, setPendingPhone } from '../lib/pendingPhone';

const leaveToLogin = () => { setPendingPhone(null); router.replace('/login' as never); };

/**
 * One-time phone check after email or Google sign-in. The server withholds the session until the account has an
 * OTP-verified mobile number; verifying it here creates (or links) the account and signs the person in.
 */
export default function VerifyPhoneScreen() {
  const pending = getPendingPhone();

  if (!pending) {
    return <Screen standalone title="Verify your mobile number" onBack={leaveToLogin}>
      <AlertBanner tone="amber" icon="clock" title="This step has timed out" message="For your security the verification window is short. Sign in again to continue." />
      <PillButton title="Back to sign in" icon="arrowRight" onPress={leaveToLogin} />
    </Screen>;
  }

  // A 401 AUTH_LINK_EXPIRED means the 15-minute window passed: the sign-in has to be redone from the start.
  const guard = async <T,>(action: () => Promise<T>): Promise<T> => {
    try { return await action(); }
    catch (cause) { if (cause instanceof AuthApiError && cause.code === 'AUTH_LINK_EXPIRED') leaveToLogin(); throw cause; }
  };

  return <Screen standalone title="Verify your mobile number" subtitle={pending.name ? `Welcome, ${pending.name.split(' ')[0]}! One last step.` : 'One last step to finish signing in.'} onBack={leaveToLogin}>
    <PhoneOtpFlow sendLabel="Send code" verifyLabel="Verify and continue"
      onSend={phone => guard(() => authApi.linkSend(pending.pendingToken, phone))}
      onVerify={async (phone, otp) => {
        await guard(() => authApi.linkComplete(pending.pendingToken, phone, otp));
        // Proof of agreement is recorded for brand-new accounts; a failed audit write must never undo the sign-in.
        if (pending.isNew) await authApi.recordLegalConsent('studio_signup').catch(() => undefined);
        setPendingPhone(null);
        router.replace('/' as never);
      }} />
  </Screen>;
}
