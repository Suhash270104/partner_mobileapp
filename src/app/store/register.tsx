import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { StepShell } from '../../components/vertical/StepShell';
import { CategoriesStep } from '../../components/marketplace/registration/CategoriesStep';
import { ContactStep } from '../../components/marketplace/registration/ContactStep';
import { PayoutStep } from '../../components/marketplace/registration/PayoutStep';
import { StoreStep } from '../../components/marketplace/registration/StoreStep';
import { AlertBanner, PillButton, Screen, palette } from '../../components/ui';
import { PartnerApiError, partnerApi } from '../../lib/partnerApi';
import { merchantApi } from '../../lib/marketplace/api';
import { ERROR_CODES } from '../../lib/marketplace/constants';
import { errorMessage, isPhoneVerificationRequired, parseFieldErrors } from '../../lib/marketplace/errors';
import {
  REGISTRATION_STEPS, RegistrationForm, RegistrationStep, blankRegistration, buildRegistrationPayload, clearRegistrationDraft, formKeyForField,
  loadRegistrationDraft, saveRegistrationDraft, stepForField, validateRegistrationStep,
} from '../../lib/marketplace/registration';
import { FieldErrors, firstError } from '../../lib/marketplace/validation';

const STEP_COPY = [
  { title: 'Store & business', subtitle: 'Tell buyers who you are. These details appear on your public store page and invoices.' },
  { title: 'Address & contact', subtitle: 'Where buyers can reach you, and where enquiry alerts are sent.' },
  { title: 'Categories & operations', subtitle: 'What you sell, where you supply, and when you are open.' },
  { title: 'Bank & payout', subtitle: 'Where your payouts go. Bank details are never saved on this phone.' },
] as const;

type Gate = 'checking' | 'open' | 'needsPhone' | 'error';

export default function StoreRegisterScreen() {
  const [gate, setGate] = useState<Gate>('checking');
  const [gateError, setGateError] = useState('');
  const [step, setStep] = useState<RegistrationStep>(0);
  const [form, setForm] = useState<RegistrationForm>(blankRegistration());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const ready = useRef(false);

  const check = useCallback(async () => {
    setGate('checking'); setGateError('');
    try {
      const session = await partnerApi.session();
      if (!session.user) { router.replace('/' as never); return; }
      const status = await merchantApi.status();
      if (status.canAccessDashboard) { router.replace('/store' as never); return; }
      if (status.isMerchant) { router.replace('/store/blocked' as never); return; }
      if (!status.phoneVerified) { setGate('needsPhone'); return; }
      const draft = await loadRegistrationDraft();
      const phone = session.user.phone?.replace(/\D/g, '').slice(-10) ?? '';
      setForm(draft?.form ?? blankRegistration({ phone, email: session.user.email ?? '' }));
      setStep((draft?.step ?? 0) as RegistrationStep);
      ready.current = true;
      setGate('open');
    } catch (cause) { setGateError(errorMessage(cause, 'Could not check your account.')); setGate('error'); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void check(); }, [check]);

  // Keep a local draft (without bank numbers or consent) so a restart or the sign-in detour loses nothing.
  useEffect(() => { if (ready.current) void saveRegistrationDraft(form, step); }, [form, step]);

  const set = useCallback(<K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setErrors(previous => { if (!previous[key as string]) return previous; const { [key as string]: _removed, ...rest } = previous; return rest; });
    setSubmitError('');
  }, []);

  const next = async () => {
    const found = validateRegistrationStep(step, form);
    setErrors(found);
    if (Object.keys(found).length) { setSubmitError(firstError(found) ?? 'Please fix the highlighted fields.'); return; }
    setSubmitError('');
    if (step < 3) { setStep((step + 1) as RegistrationStep); return; }
    setBusy(true);
    try {
      await merchantApi.register(buildRegistrationPayload(form));
      await merchantApi.recordLegalConsent();
      await clearRegistrationDraft();
      router.replace('/store' as never);
    } catch (cause) {
      if (cause instanceof PartnerApiError && cause.code === ERROR_CODES.alreadyRegistered) { router.replace('/store' as never); return; }
      if (isPhoneVerificationRequired(cause)) { setGate('needsPhone'); return; }
      if (cause instanceof PartnerApiError && cause.code === ERROR_CODES.businessIdInUse) {
        setStep(0); setErrors({ businessId: 'This business ID is already registered with another store.' });
        setSubmitError('This business ID is already registered with another store.'); return;
      }
      const fields = parseFieldErrors(cause);
      const paths = Object.keys(fields);
      if (paths.length) {
        // Send the person back to the earliest step that owns a rejected field, with the server's message beside it.
        setStep(Math.min(...paths.map(stepForField)) as RegistrationStep);
        setErrors(Object.fromEntries(paths.map(path => [formKeyForField(path), fields[path]])));
      }
      setSubmitError(errorMessage(cause, 'We could not create your store. Please try again.'));
    } finally { setBusy(false); }
  };

  if (gate === 'checking') return <Screen standalone><View style={{ paddingVertical: 80, alignItems: 'center' }}><ActivityIndicator color={palette.green} /></View></Screen>;
  if (gate === 'error') return <Screen standalone title="Open your store" error={gateError} onRetry={() => void check()} onBack={() => router.back()} />;
  if (gate === 'needsPhone') return <Screen standalone title="Open your store" onBack={() => router.back()}>
    <AlertBanner tone="amber" icon="phone" title="Verify your mobile number first"
      message="A verified mobile number is required to open a store. Sign in with mobile OTP, then come back here." actionLabel="Verify mobile number" onAction={() => router.push('/signup' as never)} />
    <PillButton title="I have verified it — check again" variant="soft" onPress={() => void check()} />
  </Screen>;

  const sectionProps = { form, errors, set };
  return <StepShell
    step={step} steps={REGISTRATION_STEPS.map(name => name.toUpperCase())} brand="SELLER" initial={(form.storeName.trim()[0] || 'S').toUpperCase()}
    title={STEP_COPY[step].title} subtitle={STEP_COPY[step].subtitle}
    onBack={() => (step > 0 ? setStep((step - 1) as RegistrationStep) : router.back())}
    onStepBack={step > 0 ? () => setStep((step - 1) as RegistrationStep) : undefined}
    onJump={index => { setSubmitError(''); setStep(index as RegistrationStep); }}
    error={submitError} nextLabel={step < 3 ? 'Continue' : 'Create my store'} onNext={() => void next()} busy={busy}
    note={step === 3 ? 'By creating your store you confirm the details are accurate.' : 'Your progress is saved on this phone, except bank details.'}
  >
    {step === 0 && <StoreStep {...sectionProps} />}
    {step === 1 && <ContactStep {...sectionProps} />}
    {step === 2 && <CategoriesStep {...sectionProps} />}
    {step === 3 && <PayoutStep {...sectionProps} />}
  </StepShell>;
}
