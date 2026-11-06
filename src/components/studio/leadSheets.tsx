import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import * as Clipboard from 'expo-clipboard';
import { CashfreeOrder, PartnerApiError, partnerApi, PublicPlan, StudioUnlockQuote } from '../../lib/partnerApi';
import { sanitizePhoneInput, isValidPhone } from '../../lib/authValidation';
import { c, ErrorText, Field } from '../professional/onboardingUi';
import { CashfreeCheckout } from './CashfreeCheckout';
import { Sheet } from './Sheet';

const publicSite = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');

export interface LeadProject {
  id: string;
  title?: string;
  location?: string;
  budgetRange?: string;
  areaSqFt?: string | number;
  timeline?: string;
  proposalsReceived?: number;
  maxProposals?: number;
}

const BLOCKED_HINTS: Record<string, string> = {
  DESIGNER_NOT_APPROVED: 'Once KraftNex approves your studio profile you can unlock leads. Nothing has been charged.',
  PROJECT_AWARDED: 'The client has already picked a studio for this project. Nothing has been charged.',
  PROJECT_CLOSED: 'The client has closed this project. Nothing has been charged.',
  PROJECT_REJECTED: 'This project was removed after review. Nothing has been charged.',
};

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
const whatsappHref = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
};

// ------------------------------------------------------------------ Unlock
type Step = 'loading' | 'choose' | 'processing' | 'success' | 'blocked' | 'error';

export function UnlockSheet({ project, onClose, onUnlocked, onSubmitProposal }: {
  project: LeadProject | null;
  onClose: () => void;
  onUnlocked: (result: { projectId: string; leadCredits?: number; bonusLeadCredits?: number }) => void;
  onSubmitProposal: (project: LeadProject) => void;
}) {
  // Keyed by project so every open starts from a fresh quote and no stale contact.
  return (
    <Sheet visible={!!project} title={project?.title || 'Client project'} eyebrow="UNLOCK PROJECT LEAD" onClose={onClose}>
      {project && <UnlockBody key={project.id} project={project} onClose={onClose} onUnlocked={onUnlocked} onSubmitProposal={onSubmitProposal} />}
    </Sheet>
  );
}

function UnlockBody({ project, onClose, onUnlocked, onSubmitProposal }: {
  project: LeadProject;
  onClose: () => void;
  onUnlocked: (result: { projectId: string; leadCredits?: number; bonusLeadCredits?: number }) => void;
  onSubmitProposal: (project: LeadProject) => void;
}) {
  const projectId = String(project.id);
  const [step, setStep] = useState<Step>('loading');
  const [quote, setQuote] = useState<StudioUnlockQuote | null>(null);
  const [method, setMethod] = useState<'credit' | 'pay'>('credit');
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [contact, setContact] = useState<{ clientName?: string; clientPhone?: string; clientEmail?: string; exactAddress?: string } | null>(null);
  const [contactError, setContactError] = useState(false);
  const [welcomeLeft, setWelcomeLeft] = useState<number | null>(null);
  const [order, setOrder] = useState<CashfreeOrder | null>(null);
  const [needPhone, setNeedPhone] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [copied, setCopied] = useState('');

  const loadContact = useCallback(async () => {
    setContactError(false);
    try {
      const detail = await partnerApi.clientProjectDetail(projectId);
      setContact({ clientName: detail.clientName, clientPhone: detail.clientPhone, clientEmail: detail.clientEmail, exactAddress: detail.exactAddress });
    } catch {
      setContactError(true);
    }
  }, [projectId]);

  const showSuccess = useCallback((leadCredits?: number, bonusLeadCredits?: number) => {
    setStep('success');
    setWelcomeLeft(typeof bonusLeadCredits === 'number' ? bonusLeadCredits : null);
    onUnlocked({ projectId, leadCredits, bonusLeadCredits });
    void loadContact();
  }, [loadContact, onUnlocked, projectId]);

  const applyQuote = useCallback((q: StudioUnlockQuote) => {
    setQuote(q);
    if (q.state === 'UNLOCKED') showSuccess(q.leadCredits, q.bonusLeadCredits);
    else if (q.state === 'BLOCKED') setStep('blocked');
    else {
      setMethod(q.leadCredits >= q.creditCost || q.payPrice === null ? 'credit' : 'pay');
      setStep('choose');
    }
  }, [showSuccess]);

  const loadQuote = useCallback(async () => {
    setStep('loading');
    setErrorMessage('');
    try {
      applyQuote(await partnerApi.studioUnlockQuote(projectId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load unlock options.');
      setStep('error');
    }
  }, [applyQuote, projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadQuote(); }, 0);
    return () => clearTimeout(timer);
  }, [loadQuote]);

  const canUseCredit = Boolean(quote && quote.leadCredits >= quote.creditCost);
  const canPay = quote?.payPrice != null;

  async function startPayment(phone?: string) {
    if (!quote) return;
    setStep('processing');
    try {
      const created = await partnerApi.createCashfreeOrder({ itemType: 'LEAD_UNLOCK', itemId: quote.payTier, projectId, ...(phone ? { checkoutPhone: phone } : {}) });
      if (!created.success || !created.paymentSessionId) throw new Error(created.message || 'Unable to start payment');
      setNeedPhone(false);
      setOrder(created);
    } catch (error) {
      if (error instanceof PartnerApiError && error.code === 'PHONE_REQUIRED') {
        // No real mobile number on the account: ask for one rather than let checkout show a placeholder.
        setNeedPhone(true);
        setStep('choose');
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start payment');
      setStep('error');
    }
  }

  // The checkout closing is not proof of payment — only the backend's own verification is.
  async function afterCheckout() {
    const current = order;
    setOrder(null);
    if (!current || !quote) return;
    setStep('processing');
    try {
      const result = await partnerApi.verifyCashfreeOrder(current.orderId, 'designer');
      if (result.status === 'PAID') showSuccess(quote.leadCredits, quote.bonusLeadCredits);
      else if (result.status === 'USER_DROPPED') setStep('choose');
      else if (result.status === 'PENDING') {
        setNotice('Your payment is still processing. The lead unlocks automatically once it is confirmed — check My Leads in a minute.');
        setStep('choose');
      } else {
        setNotice('The payment did not go through and you were not charged. You can try again.');
        setStep('choose');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not confirm your payment.');
      setStep('error');
    }
  }

  async function confirm() {
    if (!quote) return;
    setNotice('');
    setErrorMessage('');
    if (method === 'pay') {
      await startPayment();
      return;
    }
    setStep('processing');
    try {
      const result = await partnerApi.studioUnlockWithCredit(projectId);
      showSuccess(typeof result.leadCredits === 'number' ? result.leadCredits : undefined, typeof result.bonusLeadCredits === 'number' ? result.bonusLeadCredits : undefined);
    } catch (caught) {
      const error = caught as PartnerApiError;
      if (error.status === 402 || error.code === 'INSUFFICIENT_LEAD_CREDITS') {
        await loadQuote();
        setNotice('You are out of lead credits. You can pay once for this lead or upgrade your plan.');
        return;
      }
      if (error.code === 'ALREADY_UNLOCKED') {
        showSuccess(quote.leadCredits, quote.bonusLeadCredits);
        return;
      }
      if (error.status === 403 || error.status === 409) {
        setQuote({ ...quote, state: 'BLOCKED', blockedReason: { code: error.code || 'BLOCKED', message: error.message || 'This lead cannot be unlocked right now.' } });
        setStep('blocked');
        return;
      }
      setErrorMessage(error.message || 'Unable to unlock this lead. Please try again.');
      setStep('error');
    }
  }

  async function copy(label: string, value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  }

  const summary = [
    project.location || 'Location on unlock',
    project.budgetRange || 'Flexible budget',
    project.areaSqFt ? `${project.areaSqFt}${/\d\s*$/.test(String(project.areaSqFt)) ? ' sq.ft' : ''}` : 'Area not given',
    project.timeline || 'Flexible timeline',
  ];
  const maxProposals = Number(project.maxProposals ?? 0);

  return (
    <View>
      {step !== 'success' && (
        <View style={s.summary}>
          {summary.map(item => <View key={item} style={s.summaryItem}><Text style={s.summaryText} numberOfLines={1}>{item}</Text></View>)}
          {maxProposals > 0 && <Text style={s.slots}>{Number(project.proposalsReceived ?? 0)} of {maxProposals} proposal slots taken</Text>}
        </View>
      )}

      {step === 'loading' && <View style={s.center}><ActivityIndicator color={c.green} /><Text style={s.muted}>Checking your unlock options…</Text></View>}

      {(step === 'choose' || step === 'processing') && quote && (
        <View style={{ gap: 12 }}>
          <View style={s.box}>
            <Text style={s.boxTitle}>YOU&apos;LL GET</Text>
            {['Client phone & email', 'Exact site address', 'Project files', 'Proposal & chat access'].map(line => <Text key={line} style={s.bullet}>✓  {line}</Text>)}
          </View>

          <Pressable disabled={!canUseCredit || step === 'processing'} onPress={() => setMethod('credit')} style={[s.option, method === 'credit' && s.optionOn, !canUseCredit && { opacity: 0.5 }]}>
            <View style={s.radio}>{method === 'credit' && <View style={s.radioDot} />}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.optionTitle}>Use {quote.creditCost} lead credit</Text>
              <Text style={s.muted}>
                {canUseCredit
                  ? (quote.bonusLeadCredits ? `${quote.bonusLeadCredits} free welcome ${quote.bonusLeadCredits === 1 ? 'unlock' : 'unlocks'} left${quote.planLeadCredits ? ` · ${quote.planLeadCredits} plan ${quote.planLeadCredits === 1 ? 'credit' : 'credits'}` : ''}` : `${quote.planLeadCredits || quote.leadCredits} plan ${quote.planLeadCredits === 1 ? 'credit' : 'credits'} available`)
                  : 'Your free welcome unlocks are used'}
              </Text>
            </View>
          </Pressable>
          {canPay && (
            <Pressable disabled={step === 'processing'} onPress={() => setMethod('pay')} style={[s.option, method === 'pay' && s.optionOn]}>
              <View style={s.radio}>{method === 'pay' && <View style={s.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>Pay ₹{quote.payPrice} once</Text>
                <Text style={s.muted}>{quote.projectTier ? `${quote.projectTier} project · ` : ''}secure checkout, this lead only</Text>
              </View>
            </Pressable>
          )}

          {needPhone && (
            <View>
              <Text style={s.muted}>Add the mobile number to use for this payment.</Text>
              <Field value={checkoutPhone} onChangeText={value => setCheckoutPhone(sanitizePhoneInput(value))} keyboardType="number-pad" placeholder="98765 43210" />
              <Pressable style={[s.primary, !isValidPhone(checkoutPhone) && s.primaryOff]} disabled={!isValidPhone(checkoutPhone)} onPress={() => void startPayment(checkoutPhone)}>
                <Text style={s.primaryText}>Continue to payment</Text>
              </Pressable>
            </View>
          )}

          {!!notice && <Text style={s.notice}>{notice}</Text>}
          <Pressable style={[s.primary, (step === 'processing' || (method === 'credit' && !canUseCredit) || (method === 'pay' && !canPay)) && s.primaryOff]}
            disabled={step === 'processing' || (method === 'credit' && !canUseCredit) || (method === 'pay' && !canPay)} onPress={() => void confirm()}>
            {step === 'processing' ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{method === 'pay' ? `Pay ₹${quote.payPrice} & unlock` : 'Unlock with 1 credit'}</Text>}
          </Pressable>
          <Text style={s.muted}>The client is told a studio is interested. If the lead turns out to be bad (wrong number, fake project), you can request a refund from Clients & Leads.</Text>
        </View>
      )}

      {step === 'blocked' && (
        <View style={s.box}>
          <Text style={s.boxTitle}>CAN&apos;T UNLOCK RIGHT NOW</Text>
          <Text style={s.body}>{BLOCKED_HINTS[quote?.blockedReason?.code || ''] || quote?.blockedReason?.message || 'This lead cannot be unlocked right now. Nothing has been charged.'}</Text>
          <Pressable style={s.secondary} onPress={onClose}><Text style={s.secondaryText}>Close</Text></Pressable>
        </View>
      )}

      {step === 'error' && (
        <View style={{ gap: 10 }}>
          <ErrorText>{errorMessage || 'Something went wrong.'}</ErrorText>
          <Pressable style={s.secondary} onPress={() => void loadQuote()}><Text style={s.secondaryText}>Try again</Text></Pressable>
        </View>
      )}

      {step === 'success' && (
        <View style={{ gap: 12 }}>
          <View style={[s.box, { backgroundColor: c.greenSoft, borderColor: '#bfe0cf' }]}>
            <Text style={s.boxTitle}>CONTACT UNLOCKED</Text>
            <Text style={s.body}>Contact unlocked. Reach out while the project is fresh.</Text>
          </View>
          {welcomeLeft === 1 && <Text style={s.muted}>1 free welcome unlock left. After it’s used, you can use any plan credits or pay once for each lead.</Text>}
          {welcomeLeft === 0 && <Text style={s.muted}>Your 2 free welcome unlocks are used. Use any plan credits or pay once to unlock another lead.</Text>}
          {!contact && !contactError && <View style={s.center}><ActivityIndicator color={c.green} /><Text style={s.muted}>Loading client contact…</Text></View>}
          {contactError && <View><Text style={s.muted}>Couldn&apos;t load the contact just now.</Text><Pressable onPress={() => void loadContact()}><Text style={s.linkText}>Retry</Text></Pressable></View>}
          {contact && ([
            ['name', 'Client', contact.clientName], ['phone', 'Phone', contact.clientPhone], ['email', 'Email', contact.clientEmail], ['address', 'Site', contact.exactAddress],
          ] as [string, string, string | undefined][]).map(([key, label, value]) => (
            <View key={key} style={s.contactRow}>
              <View style={{ flex: 1 }}><Text style={s.contactLabel}>{label.toUpperCase()}</Text><Text style={s.body}>{value || 'Not provided'}</Text></View>
              {!!value && <Pressable onPress={() => void copy(key, value)}><Text style={s.linkText}>{copied === key ? 'Copied' : 'Copy'}</Text></Pressable>}
            </View>
          ))}
          {!!contact?.clientPhone && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[s.primary, { flex: 1 }]} onPress={() => void Linking.openURL(telHref(contact.clientPhone!))}><Text style={s.primaryText}>Call</Text></Pressable>
              <Pressable style={[s.primary, { flex: 1, backgroundColor: '#1fa855' }]} onPress={() => void Linking.openURL(whatsappHref(contact.clientPhone!))}><Text style={s.primaryText}>WhatsApp</Text></Pressable>
            </View>
          )}
          <Pressable style={s.secondary} onPress={() => onSubmitProposal(project)}><Text style={s.secondaryText}>Submit a proposal →</Text></Pressable>
        </View>
      )}

      <CashfreeCheckout order={order} onClose={() => void afterCheckout()} />
    </View>
  );
}

// ------------------------------------------------------------------ Proposal
export interface ProposalContext {
  projectId: string;
  clientName?: string;
  projectTitle?: string;
  location?: string;
  budget?: string;
  timeline?: string;
  existingPriceEst?: string;
  existingTimeline?: string;
  existingScopeText?: string;
}

export function ProposalSheet({ context, onClose, onSubmitted }: { context: ProposalContext | null; onClose: () => void; onSubmitted?: () => void }) {
  return (
    <Sheet visible={!!context} title={context?.projectTitle || 'Client Project'} eyebrow="SUBMIT PROPOSAL" onClose={onClose}>
      {context && <ProposalBody key={context.projectId} context={context} onClose={onClose} onSubmitted={onSubmitted} />}
    </Sheet>
  );
}

function ProposalBody({ context, onClose, onSubmitted }: { context: ProposalContext; onClose: () => void; onSubmitted?: () => void }) {
  const [priceEst, setPriceEst] = useState(context.existingPriceEst || '');
  const [timeline, setTimeline] = useState(context.existingTimeline || '');
  const [scopeText, setScopeText] = useState(context.existingScopeText || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ priceEst?: string; timeline?: string } | null>(null);

  async function submit() {
    setError('');
    if (!context.projectId) { setError('This lead is not linked to a client project. Please reopen the lead and try again.'); return; }
    if (!priceEst.trim() || !timeline.trim()) { setError('Price quote and timeline are required.'); return; }
    setBusy(true);
    try {
      const result = await partnerApi.submitStudioProposal({ projectId: context.projectId, priceEst: priceEst.trim(), timeline: timeline.trim(), scopeText: scopeText.trim() });
      setDone({ priceEst: result.proposal?.priceEst, timeline: result.proposal?.timeline });
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit proposal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <View style={{ gap: 12, alignItems: 'center' }}>
        <Text style={s.doneTitle}>Proposal Submitted</Text>
        <Text style={s.muted}>Your proposal is now stored against the client project and is available to the client for comparison.</Text>
        <View style={[s.box, { alignSelf: 'stretch' }]}>
          {!!context.clientName && <Text style={s.body}>Client: <Text style={s.strong}>{context.clientName}</Text></Text>}
          {!!context.budget && <Text style={s.body}>Budget: <Text style={s.strong}>{context.budget}</Text></Text>}
          {!!context.timeline && <Text style={s.body}>Project timeline: <Text style={s.strong}>{context.timeline}</Text></Text>}
          <Text style={s.body}>Your quote: <Text style={s.strong}>{done.priceEst || priceEst}</Text></Text>
          <Text style={s.body}>Your timeline: <Text style={s.strong}>{done.timeline || timeline}</Text></Text>
        </View>
        <Pressable style={[s.primary, { alignSelf: 'stretch' }]} onPress={onClose}><Text style={s.primaryText}>Done</Text></Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={[s.box, { backgroundColor: c.greenSoft, borderColor: '#bfe0cf', marginBottom: 14 }]}>
        <Text style={s.strong}>{context.clientName || 'Client project'}</Text>
        <Text style={s.muted}>{context.projectTitle || 'Client Project'}{context.location ? ` — ${context.location}` : ''}</Text>
        {!!context.budget && <Text style={[s.body, { color: c.greenText }]}>Client budget: {context.budget}</Text>}
        {!!context.timeline && <Text style={s.body}>Client timeline: {context.timeline}</Text>}
      </View>
      <Field label="PRICE QUOTE *" value={priceEst} onChangeText={setPriceEst} placeholder="Enter your quote" />
      <Field label="TIMELINE *" value={timeline} onChangeText={setTimeline} placeholder="Enter timeline" />
      <Field label="SCOPE / NOTES" value={scopeText} onChangeText={setScopeText} placeholder="Describe the proposed scope, deliverables, assumptions, or exclusions." multiline style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }} />
      {!!error && <ErrorText>{error}</ErrorText>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Pressable style={[s.secondary, { flex: 1 }]} onPress={onClose} disabled={busy}><Text style={s.secondaryText}>Cancel</Text></Pressable>
        <Pressable style={[s.primary, { flex: 1.5 }, busy && s.primaryOff]} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Submit Proposal</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Refund
export function RefundSheet({ target, onClose, onRequested }: {
  target: { projectId: string; projectTitle?: string; unlockMethod?: string | null; amountPaid?: number | null } | null;
  onClose: () => void;
  onRequested: () => void;
}) {
  return (
    <Sheet visible={!!target} title={target?.projectTitle || 'Interior project'} eyebrow="REQUEST A REFUND" onClose={onClose}>
      {target && <RefundBody key={target.projectId} target={target} onClose={onClose} onRequested={onRequested} />}
    </Sheet>
  );
}

function RefundBody({ target, onClose, onRequested }: { target: { projectId: string; unlockMethod?: string | null; amountPaid?: number | null }; onClose: () => void; onRequested: () => void }) {
  const [reasons, setReasons] = useState<{ id: string; label: string }[] | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    partnerApi.studioRefundReasons().then(
      result => { if (!cancelled) setReasons(result.reasons || []); },
      () => { if (!cancelled) setReasons([]); },
    );
    return () => { cancelled = true; };
  }, []);

  const needsDetails = reason === 'OTHER';
  const canSubmit = Boolean(reason) && (!needsDetails || details.trim().length >= 10) && !busy;

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await partnerApi.studioRequestRefund(target.projectId, reason, details.trim());
      onRequested();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your refund request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.muted}>{target.unlockMethod === 'PAYMENT' ? `You paid${typeof target.amountPaid === 'number' ? ` ₹${target.amountPaid}` : ''} for this lead. An approved refund goes back to your original payment method.` : 'An approved refund returns the lead credit you used to your account.'}</Text>
      {reasons === null ? <View style={s.center}><ActivityIndicator color={c.green} /></View>
        : reasons.length === 0 ? <ErrorText>Could not load the reasons. Close this and try again.</ErrorText>
        : reasons.map(item => (
          <Pressable key={item.id} style={[s.option, reason === item.id && s.optionOn]} onPress={() => setReason(item.id)}>
            <View style={s.radio}>{reason === item.id && <View style={s.radioDot} />}</View>
            <Text style={[s.optionTitle, { flex: 1 }]}>{item.label}</Text>
          </Pressable>
        ))}
      <Field label={needsDetails ? 'TELL US WHAT HAPPENED (REQUIRED, MIN 10 CHARACTERS)' : 'ANYTHING ELSE WE SHOULD KNOW? (OPTIONAL)'} value={details} onChangeText={setDetails} multiline style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }} />
      {!!error && <ErrorText>{error}</ErrorText>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable style={[s.secondary, { flex: 1 }]} onPress={onClose} disabled={busy}><Text style={s.secondaryText}>Cancel</Text></Pressable>
        <Pressable style={[s.primary, { flex: 1.5 }, !canSubmit && s.primaryOff]} disabled={!canSubmit} onPress={() => void submit()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Send request</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Plans ("Buy credits")
const formatINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function PlansSheet({ visible, onClose, onPurchased }: { visible: boolean; onClose: () => void; onPurchased?: () => void }) {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyPlan, setBusyPlan] = useState('');
  const [order, setOrder] = useState<CashfreeOrder | null>(null);
  const [pendingPlan, setPendingPlan] = useState('');
  const [needPhone, setNeedPhone] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!visible || plans) return;
    let cancelled = false;
    partnerApi.publicPricing().then(
      result => { if (!cancelled) setPlans(Array.isArray(result.subscriptions) ? result.subscriptions : []); },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [visible, plans]);

  // Compare-all-plans still lives on the website; buying a plan happens here, in the same Cashfree checkout.
  const openSite = () => {
    if (!publicSite) return;
    void Linking.openURL(`${publicSite}/pricing`).catch(() => undefined);
  };

  async function buy(planId: string, phone?: string) {
    setBusyPlan(planId);
    setError('');
    setNotice('');
    setPaid(false);
    try {
      const created = await partnerApi.createCashfreeOrder({ itemType: 'SUBSCRIPTION', itemId: planId, billingInterval: 'monthly', buyerType: 'designer', ...(phone ? { checkoutPhone: phone } : {}) });
      if (!created.success || !created.paymentSessionId) throw new Error(created.message || 'Unable to start payment');
      setNeedPhone(false);
      setPendingPlan(planId);
      setOrder(created);
    } catch (e) {
      if (e instanceof PartnerApiError && e.code === 'PHONE_REQUIRED') {
        setPendingPlan(planId);
        setNeedPhone(true);
      } else {
        setError(e instanceof Error ? e.message : 'Unable to start payment');
      }
    } finally {
      setBusyPlan('');
    }
  }

  // The checkout closing is not proof of payment: only the backend's own verification is.
  async function afterCheckout() {
    const current = order;
    setOrder(null);
    if (!current) return;
    setBusyPlan(pendingPlan);
    try {
      const result = await partnerApi.verifyCashfreeOrder(current.orderId, 'designer');
      if (result.status === 'PAID') { setPaid(true); onPurchased?.(); }
      else if (result.status === 'PENDING') setNotice('Your payment is still processing. Your plan activates automatically once it is confirmed.');
      else if (result.status === 'FAILED') setError('The payment did not go through and you were not charged. You can try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm your payment.');
    } finally {
      setBusyPlan('');
    }
  }

  const offered = (plans || []).filter(plan => Number(plan.projectLeadUnlocksPerMonth) > 0);
  const phoneOk = isValidPhone(checkoutPhone);

  return (
    <Sheet visible={visible} title="You're out of leads" eyebrow="PLANS" onClose={onClose}>
      <Text style={s.muted}>Lead unlocks are included with every plan — no separate pack to buy. Pick a plan for a fresh monthly allowance of project lead unlocks.</Text>
      {!plans && !failed && <View style={s.center}><ActivityIndicator color={c.green} /></View>}
      {failed && <ErrorText>Could not load the plans right now.</ErrorText>}
      {!!error && <ErrorText>{error}</ErrorText>}
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      {paid && <Text style={s.paid}>Payment confirmed. Your plan is active and your lead allowance has been added.</Text>}

      {needPhone && (
        <View style={[s.box, { marginTop: 12 }]}>
          <Text style={s.boxTitle}>MOBILE NUMBER FOR CHECKOUT</Text>
          <Field value={checkoutPhone} onChangeText={value => setCheckoutPhone(sanitizePhoneInput(value))} keyboardType="phone-pad" placeholder="10-digit mobile number" maxLength={10} />
          <Pressable style={[s.primary, !phoneOk && s.primaryOff]} disabled={!phoneOk || !!busyPlan} onPress={() => void buy(pendingPlan, checkoutPhone)}><Text style={s.primaryText}>Continue to payment</Text></Pressable>
        </View>
      )}

      <View style={{ gap: 10, marginTop: 12 }}>
        {offered.map(plan => {
          const promo = plan.promo?.isLive && plan.promo.monthlyPrice != null ? Number(plan.promo.monthlyPrice) : null;
          const price = promo ?? (Number(plan.monthlyPrice) || 0);
          return (
            <Pressable key={plan.id} style={[s.plan, !!busyPlan && { opacity: 0.6 }]} disabled={!!busyPlan} onPress={() => void buy(plan.id)}>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>{plan.name || plan.id}{plan.isPopular && plan.badge ? `  ·  ${plan.badge}` : ''}</Text>
                <Text style={s.muted}>{plan.projectLeadUnlocksPerMonth} project leads / month{promo != null && plan.promo?.label ? `  ·  ${plan.promo.label}` : ''}</Text>
              </View>
              {busyPlan === plan.id ? <ActivityIndicator color={c.green} /> : price > 0 && <Text style={s.planPrice}>{formatINR(price)}<Text style={s.muted}>/mo</Text></Text>}
            </Pressable>
          );
        })}
      </View>
      {!!publicSite && <Pressable style={[s.secondary, { marginTop: 14 }]} onPress={openSite}><Text style={s.secondaryText}>Compare all plans</Text></Pressable>}

      <CashfreeCheckout order={order} onClose={() => void afterCheckout()} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  center: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  muted: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  body: { color: c.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  strong: { color: c.ink, fontWeight: '800' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  summaryItem: { width: '48.5%', backgroundColor: '#f4f7f5', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  summaryText: { color: c.ink, fontSize: 12, fontWeight: '700' },
  slots: { width: '100%', color: c.body, fontSize: 11.5, fontWeight: '700' },
  box: { backgroundColor: '#f4f7f5', borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14, gap: 6 },
  boxTitle: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  bullet: { color: c.ink, fontSize: 13, fontWeight: '600' },
  option: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: c.line, padding: 13 },
  optionOn: { borderColor: c.green, backgroundColor: c.greenSoft },
  optionTitle: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c3cec8', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.green },
  paid: { color: c.greenText, backgroundColor: c.mint, borderRadius: 12, padding: 12, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 10, overflow: 'hidden' },
  notice: { color: c.amber, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  primary: { height: 50, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryOff: { backgroundColor: '#a9b6b0' },
  primaryText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  secondary: { height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.green, fontSize: 14, fontWeight: '800' },
  linkText: { color: c.green, fontSize: 13, fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f4f7f5', borderRadius: 12, padding: 12 },
  contactLabel: { color: c.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  doneTitle: { color: c.ink, fontSize: 18, fontWeight: '800' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, borderColor: c.line, padding: 14 },
  planPrice: { color: c.ink, fontSize: 16, fontWeight: '800' },
});
