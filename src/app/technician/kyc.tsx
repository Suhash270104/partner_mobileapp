import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { PartnerBrand } from '../../components/PartnerBrand';
import {
  KYC_SUPPORT_REASONS,
  KycSupportReason,
  TechnicianKycState,
  TechnicianKycSupportTicket,
  partnerApi,
} from '../../lib/partnerApi';

function statusLabel(status?: string) {
  return (status || 'UNKNOWN').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function TechnicianKycScreen() {
  const [kyc, setKyc] = useState<TechnicianKycState | null>(null);
  const [support, setSupport] = useState<TechnicianKycSupportTicket | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportReason, setSupportReason] = useState<KycSupportReason>('id_not_accepted');
  const [supportMessage, setSupportMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const sessionIdRef = useRef('');
  const wasBackgrounded = useRef(false);

  const loadStatus = useCallback(async (sync = false, showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      if (sync) {
        const result = await partnerApi.syncTechnicianKyc(sessionIdRef.current || undefined);
        setKyc(result.kyc);
      } else {
        const result = await partnerApi.technicianKycStatus();
        setKyc(result.kyc);
        setSupport(result.support);
        setConfigured(result.configured);
      }
      if (sync) {
        const result = await partnerApi.technicianKycStatus();
        setKyc(result.kyc);
        setSupport(result.support);
        setConfigured(result.configured);
      }
      setNotice('');
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadStatus();
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        wasBackgrounded.current = true;
      } else if (wasBackgrounded.current) {
        wasBackgrounded.current = false;
        void loadStatus(true);
      }
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void loadStatus();
    }, 30000);
    return () => {
      appStateSubscription.remove();
      clearInterval(timer);
    };
  }, [loadStatus]));

  async function startVerification() {
    setStarting(true);
    setError('');
    setNotice('');
    try {
      const session = await partnerApi.createTechnicianKycSession();
      sessionIdRef.current = session.sessionId;
      await Linking.openURL(session.url);
      setNotice('Secure verification opened. Return to this app after completing the ID and face checks.');
    } catch (startError) {
      setError(errorText(startError));
      void loadStatus();
    } finally {
      setStarting(false);
    }
  }

  async function submitSupportRequest() {
    if (!supportMessage.trim()) {
      setError('Tell us what happened so we can review your request.');
      return;
    }
    setSubmittingSupport(true);
    setError('');
    try {
      await partnerApi.submitTechnicianKycSupportRequest({
        reason: supportReason,
        message: supportMessage.trim(),
      });
      await loadStatus();
      setSupportMessage('');
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSubmittingSupport(false);
    }
  }

  const status = kyc?.status || 'PENDING';
  const verified = status === 'APPROVED' || status === 'EXEMPT' || kyc?.verificationStatus === 'VERIFIED';
  const inReview = status === 'IN_REVIEW';
  const declined = status === 'DECLINED';
  const lockedOut = declined && (kyc?.attemptsRemaining ?? 0) <= 0;
  const nameMatchProblem = kyc?.nameMatch === 'MISMATCH' && Boolean(kyc.documentName);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.brandWrap}><PartnerBrand compact /></View>
        <Pressable style={styles.avatar} onPress={() => router.replace('/technician/dashboard')} accessibilityLabel="Technician dashboard">
          <Text style={styles.avatarText}>T</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadStatus(true, true)} tintColor="#07523e" />}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Technician KYC</Text>
          <Text style={styles.pageSubtitle}>Identity &amp; Fraud Prevention</Text>
        </View>

        {loading && !kyc ? (
          <View style={styles.loadingCard}><ActivityIndicator color="#07523e" /><Text style={styles.bodyText}>Checking your verification status…</Text></View>
        ) : !configured ? (
          <View style={styles.statusCard}>
            <StatusBadge status="UNAVAILABLE" tone="warning" />
            <Text style={styles.cardTitle}>Verification is not available</Text>
            <Text style={styles.bodyText}>Identity verification is not configured for this environment yet. Your account is saved; please check back later.</Text>
          </View>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.eyebrow}>VERIFICATION STATUS</Text>
                  <StatusBadge status={statusLabel(status).toUpperCase()} tone={verified ? 'success' : inReview ? 'warning' : declined ? 'danger' : 'info'} />
                </View>
                <View style={styles.record}>
                  <Text style={styles.eyebrow}>PROFILE RECORD</Text>
                  <Text style={styles.recordName}>{kyc?.documentName || 'Technician profile'}</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>
                {verified ? 'Identity verification complete' : inReview ? 'Identity check is under review' : declined ? 'Identity check needs another attempt' : 'Complete your identity check'}
              </Text>
              <Text style={styles.bodyText}>
                {verified
                  ? 'Your identity has been verified. Your technician account status is updated from the verification result.'
                  : inReview
                    ? 'Your submission is being reviewed. No further action is needed while the review is active; you can return to your dashboard.'
                    : declined
                      ? 'The last check did not pass. Review the reasons below, then retry with a clear, valid government photo ID.'
                      : 'Verify your identity before receiving technician jobs. The ID and face checks are completed securely by our verification partner.'}
              </Text>

              {inReview && <View style={styles.reviewNotice}>
                <Text style={styles.reviewIcon}>⌛</Text>
                <View style={styles.flex}>
                  <Text style={styles.reviewTitle}>Verification under active review</Text>
                  <Text style={styles.bodyText}>You can close this page and check again later. We will update your status when a decision is available.</Text>
                </View>
              </View>}

              {declined && !!kyc?.declineReasons.length && <View style={styles.reasonBox}>
                <Text style={styles.reasonTitle}>Review the previous result</Text>
                {kyc.declineReasons.map((reason, index) => <Text key={`${reason}-${index}`} style={styles.reasonText}>•  {reason}</Text>)}
              </View>}

              {declined && !lockedOut && <Text style={styles.attemptsText}>
                {kyc?.attemptsRemaining ?? 0} verification {(kyc?.attemptsRemaining ?? 0) === 1 ? 'attempt' : 'attempts'} remaining
              </Text>}
              {nameMatchProblem && <Text style={styles.nameNotice}>
                The ID name read as {kyc?.documentName}. It does not match your profile name exactly. If this is a genuine spelling or name variation, contact support after the available attempts are used.
              </Text>}
            </View>

            <View style={styles.gatewayCard}>
              <View style={styles.gatewayHeader}>
                <View style={styles.gatewayIcon}><Text style={styles.gatewayIconText}>▣</Text></View>
                <Text style={styles.cardTitle}>Hosted Identity Gateway</Text>
                <View style={styles.secureBadge}><Text style={styles.secureBadgeText}>SECURE SESSION</Text></View>
              </View>
              <Text style={styles.bodyText}>Your photo ID and face liveness check are handled in Didit’s hosted verification flow. Kraftnex receives the verification result, not a copy of your ID images.</Text>
              <View style={styles.gatewayMeta}><Text style={styles.metaText}>◉  Didit identity verification</Text><Text style={styles.metaText}>▣  Status checked with Kraftnex</Text></View>
            </View>

            <View style={styles.documentsHeading}>
              <Text style={styles.sectionTitle}>Required Documents</Text>
              <Text style={styles.protocolLabel}>2-STEP CHECK</Text>
            </View>

            <View style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentIcon}><Text style={styles.documentIconText}>▣</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Step 1: Government Photo ID</Text>
                  <Text style={styles.bodyText}>Aadhaar (masked), PAN Card, Passport, Voter ID, or Driving License</Text>
                </View>
                <Text style={styles.stepState}>{verified || inReview ? '✓' : '1'}</Text>
              </View>
              <View style={styles.tipsRow}>
                <HintChip text="All 4 corners visible" />
                <HintChip text="Avoid glare and reflections" />
                <HintChip text="Use the original document" />
                <HintChip text="Name should match your profile" />
              </View>
              <View style={styles.maskingStrip}>
                <Text style={styles.maskingText}>◉  Mask your Aadhaar number before capture</Text>
                <Text style={styles.maskingValue}>Never share your full ID number in chat</Text>
              </View>
            </View>

            <View style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentIcon}><Text style={styles.documentIconText}>◎</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Step 2: Face Liveness Check</Text>
                  <Text style={styles.bodyText}>Follow the on-screen camera instructions to confirm it is you.</Text>
                </View>
                <Text style={styles.stepState}>{verified || inReview ? '✓' : '2'}</Text>
              </View>
              <View style={styles.tipsRow}>
                <HintChip text="Even natural lighting" />
                <HintChip text="Remove glasses or caps" />
              </View>
            </View>

            {inReview ? (
              <View style={styles.lockedButton}><Text style={styles.lockedButtonText}>Verification Under Active Review  ⌛</Text></View>
            ) : verified ? (
              <Pressable style={styles.primaryButton} onPress={() => router.replace('/technician/dashboard')}>
                <Text style={styles.primaryButtonText}>Go to technician dashboard  →</Text>
              </Pressable>
            ) : lockedOut && support ? (
              <View style={styles.ticketCard}>
                <Text style={styles.cardTitle}>We have your support request</Text>
                <Text style={styles.bodyText}>Our team will review your request. Keep this reference for follow-up.</Text>
                <Text style={styles.ticketId}>{support.ticketId}</Text>
              </View>
            ) : lockedOut ? (
              <View style={styles.supportCard}>
                <Text style={styles.cardTitle}>Having issues with your ID or OCR?</Text>
                <Text style={styles.bodyText}>You have used all available verification attempts. Send a request for a manual review by our support team.</Text>
                <Text style={styles.inputLabel}>WHAT WAS THE PROBLEM?</Text>
                <View style={styles.reasonOptions}>
                  {KYC_SUPPORT_REASONS.map(reason => <Pressable
                    key={reason.value}
                    style={[styles.reasonOption, supportReason === reason.value && styles.reasonOptionSelected]}
                    onPress={() => setSupportReason(reason.value)}
                  >
                    <Text style={[styles.reasonOptionText, supportReason === reason.value && styles.reasonOptionTextSelected]}>{reason.label}</Text>
                  </Pressable>)}
                </View>
                <Text style={styles.inputLabel}>TELL US WHAT HAPPENED</Text>
                <TextInput
                  value={supportMessage}
                  onChangeText={value => setSupportMessage(value.slice(0, 2000))}
                  style={styles.messageInput}
                  placeholder="Describe the issue so our team can review it."
                  placeholderTextColor="#8b9892"
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />
                <Text style={styles.characterCount}>{supportMessage.length}/2000</Text>
                <Pressable disabled={submittingSupport || !supportMessage.trim()} style={[styles.primaryButton, (submittingSupport || !supportMessage.trim()) && styles.disabledButton]} onPress={() => void submitSupportRequest()}>
                  {submittingSupport ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Open KYC support request  →</Text>}
                </Pressable>
              </View>
            ) : (
              <View style={styles.actionCard}>
                {kyc && kyc.declineCount > 0 && <Text style={styles.attemptsText}>{kyc.attemptsRemaining} attempt{kyc.attemptsRemaining === 1 ? '' : 's'} remaining</Text>}
                <Pressable disabled={starting} style={[styles.primaryButton, starting && styles.disabledButton]} onPress={() => void startVerification()}>
                  {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{declined ? 'Try verification again  →' : 'Start KYC verification  →'}</Text>}
                </Pressable>
                <Text style={styles.bodyText}>You will continue to Didit’s hosted identity page, then return to Kraftnex Partner to see your result.</Text>
              </View>
            )}

            {inReview && <Text style={styles.reviewFootnote}>Submissions are locked during active background verification.</Text>}
            {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadStatus()}><Text style={styles.retryText}>Try again</Text></Pressable></View>}
            {!!notice && <Text style={styles.noticeText}>{notice}</Text>}
            <Pressable style={styles.checkButton} onPress={() => void loadStatus(true, true)} disabled={refreshing}>
              {refreshing ? <ActivityIndicator color="#07523e" /> : <Text style={styles.checkButtonText}>Check verification status</Text>}
            </Pressable>
          </>
        )}

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>◈  ZERO EARLY CLAIM POLICY</Text>
          <Text style={styles.bodyText}>Starting identity verification does not mean your account is approved or cleared for dispatch. Job access is enabled only after verification is approved.</Text>
          {kyc?.expiryDate && <Text style={styles.metaText}>Verification expiry · {new Date(kyc.expiryDate).toLocaleDateString()}</Text>}
        </View>
        <View style={styles.footer}><Text style={styles.footerText}>♧  Encrypted Gateway</Text><Text style={styles.footerText}>KRAFTNEX PARTNER</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ status, tone }: { status: string; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  return <View style={[styles.statusBadge, styles[`statusBadge_${tone}`]]}>
    <Text style={[styles.statusBadgeText, styles[`statusBadgeText_${tone}`]]}>{status}</Text>
  </View>;
}

function HintChip({ text }: { text: string }) {
  return <View style={styles.hintChip}><Text style={styles.hintText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f6fc' },
  flex: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e7ece9', paddingHorizontal: 13 },
  backButton: { width: 30, height: 36, justifyContent: 'center' },
  backText: { color: '#173d32', fontSize: 28, lineHeight: 31 },
  brandWrap: { flex: 1 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  scroll: { flex: 1 },
  content: { padding: 15, paddingBottom: 24 },
  pageHeading: { marginBottom: 11 },
  pageTitle: { color: '#102d27', fontSize: 19, fontWeight: '900' },
  pageSubtitle: { color: '#74837c', fontSize: 10, marginTop: 2 },
  loadingCard: { minHeight: 110, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusCard: { backgroundColor: '#fff', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#edf0f1' },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { color: '#6f7d88', fontSize: 7, fontWeight: '800', letterSpacing: 0.35, marginBottom: 5 },
  record: { alignItems: 'flex-end' },
  recordName: { color: '#233d35', fontSize: 10, fontWeight: '800' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  statusBadge_success: { backgroundColor: '#e1f5ea' },
  statusBadge_warning: { backgroundColor: '#fff3d9' },
  statusBadge_danger: { backgroundColor: '#fff0ef' },
  statusBadge_info: { backgroundColor: '#eaf0ff' },
  statusBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.25 },
  statusBadgeText_success: { color: '#176943' },
  statusBadgeText_warning: { color: '#9a6416' },
  statusBadgeText_danger: { color: '#a43e37' },
  statusBadgeText_info: { color: '#405b96' },
  cardTitle: { color: '#152e28', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  bodyText: { color: '#697d74', fontSize: 9, lineHeight: 15, marginTop: 4 },
  reviewNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#f5f8fa', borderRadius: 12, padding: 11, marginTop: 12 },
  reviewIcon: { color: '#214537', fontSize: 18 },
  reviewTitle: { color: '#263c35', fontSize: 9, fontWeight: '900' },
  reasonBox: { backgroundColor: '#fff1f0', borderRadius: 10, padding: 10, marginTop: 11 },
  reasonTitle: { color: '#933a34', fontSize: 9, fontWeight: '900', marginBottom: 3 },
  reasonText: { color: '#85463f', fontSize: 9, lineHeight: 15 },
  attemptsText: { color: '#9a6416', fontSize: 9, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  nameNotice: { color: '#886222', fontSize: 9, lineHeight: 15, backgroundColor: '#fff8e9', borderRadius: 9, padding: 9, marginTop: 10 },
  gatewayCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, marginTop: 11, borderWidth: 1, borderColor: '#edf0f1' },
  gatewayHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  gatewayIcon: { width: 27, height: 27, backgroundColor: '#e6f4ec', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gatewayIconText: { color: '#07523e', fontSize: 13 },
  secureBadge: { backgroundColor: '#ddf4e9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, marginLeft: 'auto' },
  secureBadgeText: { color: '#17734d', fontSize: 6, fontWeight: '900' },
  gatewayMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 9 },
  metaText: { color: '#708079', fontSize: 8, lineHeight: 13 },
  documentsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 17, marginBottom: 8 },
  sectionTitle: { color: '#16352c', fontSize: 14, fontWeight: '900' },
  protocolLabel: { color: '#617b70', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
  documentCard: { backgroundColor: '#fff', borderRadius: 15, padding: 12, marginBottom: 9, borderWidth: 1, borderColor: '#edf0f1' },
  documentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  documentIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#edf0ff', alignItems: 'center', justifyContent: 'center' },
  documentIconText: { color: '#293f56', fontSize: 15 },
  stepState: { width: 21, height: 21, borderRadius: 11, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', color: '#176943', backgroundColor: '#d9f3e5', fontSize: 10, fontWeight: '900' },
  tipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 9 },
  hintChip: { backgroundColor: '#f5f8fa', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 6 },
  hintText: { color: '#425e54', fontSize: 7, fontWeight: '700' },
  maskingStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#fff9ee', borderRadius: 8, marginTop: 8, padding: 7, gap: 5 },
  maskingText: { color: '#9b6b22', fontSize: 7, fontWeight: '700' },
  maskingValue: { color: '#273f35', fontSize: 7, fontWeight: '800' },
  lockedButton: { minHeight: 43, borderRadius: 11, backgroundColor: '#f4f7fa', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  lockedButtonText: { color: '#7d8ba0', fontSize: 10, fontWeight: '900' },
  primaryButton: { minHeight: 44, borderRadius: 11, backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 4 },
  primaryButtonText: { color: '#fff', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  disabledButton: { opacity: 0.55 },
  actionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#edf0f1' },
  reviewFootnote: { color: '#7487a1', fontSize: 8, textAlign: 'center', marginTop: 7 },
  supportCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#edf0f1' },
  inputLabel: { color: '#52685f', fontSize: 8, fontWeight: '900', letterSpacing: 0.3, marginTop: 12, marginBottom: 6 },
  reasonOptions: { gap: 6 },
  reasonOption: { borderWidth: 1, borderColor: '#e7ece9', backgroundColor: '#f8faf9', borderRadius: 9, padding: 9 },
  reasonOptionSelected: { borderColor: '#9fc8b3', backgroundColor: '#eff8f3' },
  reasonOptionText: { color: '#52675e', fontSize: 9 },
  reasonOptionTextSelected: { color: '#07523e', fontWeight: '800' },
  messageInput: { minHeight: 95, borderRadius: 10, borderWidth: 1, borderColor: '#e5ebe8', backgroundColor: '#f8faf9', padding: 10, color: '#263d33', fontSize: 10 },
  characterCount: { color: '#89968f', fontSize: 8, textAlign: 'right', marginTop: 4 },
  ticketCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#dcefe4' },
  ticketId: { color: '#07523e', fontSize: 15, fontWeight: '900', textAlign: 'center', backgroundColor: '#f1f8f4', padding: 10, borderRadius: 9, marginTop: 9 },
  errorCard: { backgroundColor: '#fff0ef', borderRadius: 10, padding: 10, marginTop: 9 },
  errorText: { color: '#9b403b', fontSize: 9, lineHeight: 14 },
  retryText: { color: '#07523e', fontSize: 9, fontWeight: '900', marginTop: 6 },
  noticeText: { color: '#287154', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 8 },
  checkButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  checkButtonText: { color: '#526e61', fontSize: 9, fontWeight: '800' },
  policyCard: { backgroundColor: '#f8fafb', borderRadius: 13, padding: 12, marginTop: 14 },
  policyTitle: { color: '#a45b25', fontSize: 8, fontWeight: '900', letterSpacing: 0.35, marginBottom: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 2 },
  footerText: { color: '#87938d', fontSize: 7, fontWeight: '700' },
});
