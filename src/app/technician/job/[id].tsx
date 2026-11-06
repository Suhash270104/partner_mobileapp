import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CollectionMethod, partnerApi, TechnicianBookingRecord } from '../../../lib/partnerApi';
import { CancelSheet, colors, OtpBoxes, PhotoStrip, ScopeSheet } from '../../../components/technician/jobUi';

type Collection = CollectionMethod | 'ONLINE_LATER';

const MIN_AFTER_PHOTOS = 2;
const MIN_BEFORE_PHOTOS = 1;

const money = (amount: number | null | undefined) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount ?? 0);
const label = (value?: string) => (value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const STAGE_TITLE: Record<string, string> = {
  CONFIRMED: 'Job Confirmed',
  EN_ROUTE: 'Arrival Verification',
  ARRIVED: 'Site Documentation',
  SCOPE_CHANGE_PENDING: 'Scope Change Pending',
  IN_PROGRESS: 'Work In Progress',
  WORK_COMPLETED: 'Final Verification',
};

export default function TechnicianJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<TechnicianBookingRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [selfie, setSelfie] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [summary, setSummary] = useState('');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelReason, setCancelReason] = useState<string | undefined>();

  const lastStatus = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const result = await partnerApi.technicianActiveJobs();
      const next = result.bookings.find(b => (b._id || b.id) === id) || null;
      if (next?.status !== lastStatus.current) {
        lastStatus.current = next?.status;
        setOtp('');
        setError('');
      }
      setJob(next);
    } catch {
      // transient poll failure: keep the last state on screen
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]));

  const status = job?.status;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
      setOtp('');
    } catch (e) {
      setError(errorMessage(e, 'Action failed'));
    } finally {
      setBusy(false);
    }
  }

  async function captureSelfie() {
    setError('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Camera permission is off. A live arrival selfie is required.');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], cameraType: ImagePicker.CameraType.front, base64: true, quality: 0.6 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('Could not read the captured photo. Try again.');
      setSelfie(`data:image/jpeg;base64,${asset.base64}`);
      setSelfiePreview(asset.uri);
      try {
        const permissionGeo = await Location.requestForegroundPermissionsAsync();
        if (permissionGeo.granted) {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setGeo({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      } catch {
        // arrival geotag is best-effort
      }
    } catch (e) {
      setError(errorMessage(e, 'Could not open the camera.'));
    }
  }

  async function submitCancel(reasonCode: string, note: string) {
    if (!id) return;
    setCancelBusy(true);
    setCancelError('');
    try {
      await partnerApi.cancelTechnicianJob(id, reasonCode, note);
      setCancelOpen(false);
      router.back();
    } catch (e) {
      setCancelError(errorMessage(e, 'Could not cancel this job.'));
    } finally {
      setCancelBusy(false);
    }
  }

  function openCancel(reason?: string) {
    setCancelReason(reason);
    setCancelError('');
    setCancelOpen(true);
  }

  async function openMaps() {
    const address = job?.customerDetails?.address;
    const lat = address?.lat;
    const lng = address?.lng;
    const destination = typeof lat === 'number' && typeof lng === 'number'
      ? `${lat},${lng}`
      : encodeURIComponent([address?.street, address?.locality, address?.city, address?.pincode].filter(Boolean).join(', '));
    try { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`); } catch (e) { setError(errorMessage(e, 'Could not open navigation.')); }
  }

  async function callCustomer() {
    const phone = job?.customerDetails?.phone?.trim();
    if (!phone) { setError('A phone number is not available for this booking.'); return; }
    try { await Linking.openURL(`tel:${phone}`); } catch (e) { setError(errorMessage(e, 'Could not open the phone app.')); }
  }

  const bookingId = job?._id || job?.id || id || '';
  const before = job?.jobDocumentation?.beforePhotos || [];
  const after = job?.jobDocumentation?.afterPhotos || [];
  const balanceDue = job?.pricing?.balanceDue ?? 0;
  const address = job?.customerDetails?.address;
  const addressLine = [address?.street, address?.locality, address?.city, address?.pincode].filter(Boolean).join(', ');
  const title = job?.serviceSnapshot?.title || label(job?.serviceCategory) || 'Service job';

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back"><Text style={styles.back}>←</Text></Pressable>
      <View style={styles.flex}>
        <Text style={styles.headerBrand}>KRAFTNEX PRO</Text>
        <Text style={styles.headerTitle}>{STAGE_TITLE[status || ''] || 'Job'}</Text>
      </View>
    </View>

    {!loaded && <View style={styles.center}><ActivityIndicator color={colors.forest} /></View>}
    {loaded && !job && <View style={styles.center}>
      <Text style={styles.emptyTitle}>This job is no longer active</Text>
      <Text style={styles.muted}>It may have been completed, cancelled or reassigned.</Text>
      <Pressable style={[styles.primary, styles.emptyButton]} onPress={() => router.back()}><Text style={styles.primaryText}>Back to jobs</Text></Pressable>
    </View>}

    {job && <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.ref}>{job.bookingNumber ? `#${job.bookingNumber}` : 'Booking'}</Text>
          <Text style={styles.statusPill}>{label(status)}</Text>
        </View>
        <Text style={styles.jobTitle}>{title}</Text>
        <Text style={styles.customer}>{job.customerDetails?.name || 'Customer'}</Text>
        {!!addressLine && <Text style={styles.muted}>{addressLine}</Text>}
        {!!job.problemDescription && <Text style={styles.problem}>Reported issue: {job.problemDescription}</Text>}
        <View style={styles.actionRow}>
          {!!job.customerDetails?.phone && <Pressable style={styles.chip} onPress={() => void callCustomer()}><Text style={styles.chipText}>Call customer</Text></Pressable>}
          <Pressable style={styles.chip} onPress={() => void openMaps()}><Text style={styles.chipText}>Google Maps route</Text></Pressable>
        </View>
      </View>

      {status === 'CONFIRMED' && <View style={styles.card}>
        <Text style={styles.cardTitle}>Ready to travel</Text>
        <Text style={styles.muted}>Mark yourself en route when you leave. The customer is notified that you are on the way.</Text>
        <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={() => void run(() => partnerApi.startTechnicianTravel(bookingId))}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Start Travel (Mark En Route)  →</Text>}
        </Pressable>
      </View>}

      {status === 'EN_ROUTE' && <>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Liveness check</Text>
          <Text style={styles.muted}>Take a live selfie on arrival. It is attached to this booking with your location as the arrival record.</Text>
          {selfiePreview
            ? <View style={styles.selfieRow}>
              <Image source={{ uri: selfiePreview }} style={styles.selfie} />
              <View style={styles.flex}>
                <Text style={styles.verified}>✓ Selfie captured</Text>
                <Pressable onPress={() => void captureSelfie()}><Text style={styles.link}>Retake</Text></Pressable>
              </View>
            </View>
            : <Pressable style={styles.secondary} onPress={() => void captureSelfie()}><Text style={styles.secondaryText}>Capture live selfie</Text></Pressable>}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer start OTP</Text>
          <Text style={styles.muted}>Ask {job.customerDetails?.name || 'the customer'} for the 4-digit code sent to their registered phone. Work stays pending until they provide it.</Text>
          <View style={styles.otpWrap}><OtpBoxes value={otp} onChange={setOtp} /></View>
          <Pressable
            disabled={busy || otp.length < 4 || !selfie}
            style={[styles.primary, (busy || otp.length < 4 || !selfie) && styles.disabled]}
            onPress={() => selfie && void run(() => partnerApi.markTechnicianArrived(bookingId, { otp, selfieUrl: selfie, lat: geo?.lat, lng: geo?.lng }))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify OTP & Start Job  →</Text>}
          </Pressable>
          {!selfie && <Text style={styles.hint}>Capture a live selfie first.</Text>}
          <Pressable onPress={() => openCancel('CUSTOMER_UNREACHABLE')} style={styles.textButton}><Text style={styles.textButtonText}>Customer not available / door locked</Text></Pressable>
        </View>
      </>}

      {status === 'ARRIVED' && <>
        <View style={styles.card}>
          <PhotoStrip bookingId={bookingId} phase="before" photos={before} minRequired={MIN_BEFORE_PHOTOS} label="Before work · site condition" onUploaded={setJob} />
        </View>
        <View style={styles.card}>
          {/* The customer's decision moves the job straight to IN_PROGRESS, where before-photos can no
              longer be added, so the site must be documented first. */}
          <Pressable disabled={before.length < MIN_BEFORE_PHOTOS} style={[styles.secondary, before.length < MIN_BEFORE_PHOTOS && styles.disabled]} onPress={() => setScopeOpen(true)}><Text style={styles.secondaryText}>Add extra parts / scope</Text></Pressable>
          <Pressable
            disabled={busy || before.length < MIN_BEFORE_PHOTOS}
            style={[styles.primary, (busy || before.length < MIN_BEFORE_PHOTOS) && styles.disabled]}
            onPress={() => void run(() => partnerApi.startTechnicianWork(bookingId))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Start Service Work  →</Text>}
          </Pressable>
          {before.length < MIN_BEFORE_PHOTOS && <Text style={styles.hint}>Upload at least {MIN_BEFORE_PHOTOS} before-photo first, then you can start work or request extra parts.</Text>}
        </View>
      </>}

      {status === 'SCOPE_CHANGE_PENDING' && <View style={styles.waitCard}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.waitText}>Waiting for customer approval on your requested diagnosis add-on…</Text>
      </View>}

      {status === 'IN_PROGRESS' && <>
        {before.length > 0 && <View style={styles.card}>
          <Text style={styles.eyebrow}>Before work · {before.length} uploaded</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {before.map((photo, index) => <Image key={photo.imageId || index} source={{ uri: photo.url }} style={styles.thumb} />)}
          </ScrollView>
        </View>}
        <View style={styles.card}>
          <PhotoStrip bookingId={bookingId} phase="after" photos={after} minRequired={MIN_AFTER_PHOTOS} label="After repair · completed work" onUploaded={setJob} />
          <Pressable onPress={() => setScopeOpen(true)} style={styles.textButton}><Text style={styles.textButtonText}>+ Add extra part</Text></Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repair methodology notes</Text>
          <TextInput
            style={styles.textArea}
            value={summary}
            onChangeText={setSummary}
            multiline
            placeholder="Optional: what was done, parts replaced, test readings"
            placeholderTextColor="#9aa8a2"
          />
          <Pressable
            disabled={busy || after.length < MIN_AFTER_PHOTOS}
            style={[styles.primary, (busy || after.length < MIN_AFTER_PHOTOS) && styles.disabled]}
            onPress={() => void run(() => partnerApi.markTechnicianWorkDone(bookingId, summary.trim()))}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Mark Work Done  →</Text>}
          </Pressable>
          {after.length < MIN_AFTER_PHOTOS && <Text style={styles.hint}>Upload at least {MIN_AFTER_PHOTOS} after-photos first.</Text>}
        </View>
      </>}

      {status === 'WORK_COMPLETED' && <>
        {(before.length > 0 || after.length > 0) && <View style={styles.card}>
          <Text style={styles.cardTitle}>Execution review & evidence</Text>
          <View style={styles.evidenceRow}>
            {!!before[0] && <View style={styles.flex}><Image source={{ uri: before[0].url }} style={styles.evidence} /><Text style={styles.caption}>Before</Text></View>}
            {!!after[0] && <View style={styles.flex}><Image source={{ uri: after[0].url }} style={styles.evidence} /><Text style={styles.caption}>After</Text></View>}
          </View>
          <Text style={styles.muted}>{before.length} before · {after.length} after photos on file</Text>
          {!!job.jobDocumentation?.workSummaryNote && <Text style={styles.problem}>{job.jobDocumentation.workSummaryNote}</Text>}
        </View>}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settlement</Text>
          <View style={styles.rowBetween}><Text style={styles.muted}>Booking total</Text><Text style={styles.value}>{money(job.pricing?.totalAmount)}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.muted}>Payment status</Text><Text style={styles.value}>{label(job.pricing?.paymentStatus)}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.muted}>Balance due</Text><Text style={styles.value}>{money(balanceDue)}</Text></View>
          {balanceDue > 0 && <View style={styles.collect}>
            <Text style={styles.collectTitle}>Balance due {money(balanceDue)}. How is the customer paying?</Text>
            {([
              ['CASH_ON_SERVICE', `I collected ${money(balanceDue)} in cash`],
              ['UPI_QR', `I collected ${money(balanceDue)} by UPI`],
              ['ONLINE_LATER', 'Customer will pay online in the app'],
            ] as const).map(([value, text]) => <Pressable key={value} onPress={() => setCollection(value)} style={[styles.option, collection === value && styles.optionActive]} accessibilityRole="radio" accessibilityState={{ selected: collection === value }}>
              <View style={[styles.radio, collection === value && styles.radioActive]}>{collection === value && <View style={styles.radioDot} />}</View>
              <Text style={styles.optionText}>{text}</Text>
            </Pressable>)}
          </View>}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer completion OTP</Text>
          <Text style={styles.muted}>Ask {job.customerDetails?.name || 'the customer'} for the 4-digit completion code sent to their phone, only after they have inspected the work.</Text>
          <View style={styles.otpWrap}><OtpBoxes value={otp} onChange={setOtp} /></View>
          <Pressable
            disabled={busy || otp.length < 4 || (balanceDue > 0 && !collection)}
            style={[styles.primary, (busy || otp.length < 4 || (balanceDue > 0 && !collection)) && styles.disabled]}
            onPress={() => {
              const collected = balanceDue > 0 && collection && collection !== 'ONLINE_LATER' ? { method: collection, amount: balanceDue } : undefined;
              void run(async () => {
                await partnerApi.completeTechnicianJob(bookingId, { otp, ...(collected ? { collected } : {}) });
                router.back();
              });
            }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify OTP & Complete Job  →</Text>}
          </Pressable>
        </View>
      </>}

      {!!error && <Text style={styles.errorBox}>{error}</Text>}

      {(status === 'CONFIRMED' || status === 'EN_ROUTE') && <Pressable onPress={() => openCancel()} style={styles.textButton}>
        <Text style={styles.cancelLink}>Can&apos;t make it? Cancel this job</Text>
      </Pressable>}
    </ScrollView>}

    {job && <ScopeSheet visible={scopeOpen} bookingId={bookingId} originalIssue={job.problemDescription || ''} onClose={() => setScopeOpen(false)} onSubmitted={() => void refresh()} />}
    {job && <CancelSheet key={cancelReason || 'any'} visible={cancelOpen} initialReason={cancelReason} busy={cancelBusy} error={cancelError} onClose={() => setCancelOpen(false)} onCancel={(reason, note) => void submitCancel(reason, note)} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f3fc' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  header: { minHeight: 58, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8ecea', flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: colors.forest, fontSize: 24, fontWeight: '700' },
  headerBrand: { color: '#e08a1e', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  content: { padding: 12, paddingBottom: 30, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ref: { color: '#e08a1e', fontSize: 11, fontWeight: '900' },
  statusPill: { color: '#21694e', backgroundColor: colors.soft, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  jobTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  customer: { color: '#33463f', fontSize: 14, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  problem: { color: '#4a5f57', fontSize: 12, lineHeight: 18, backgroundColor: '#f3f6f4', borderRadius: 10, padding: 10, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { flex: 1, height: 40, borderRadius: 11, backgroundColor: '#e8f2ed', alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  eyebrow: { color: '#5f7068', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  primary: { height: 50, borderRadius: 13, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondary: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cfe0d8', backgroundColor: '#f1f8f4', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  hint: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  link: { color: colors.forest, fontSize: 12, fontWeight: '800', marginTop: 4 },
  verified: { color: '#126744', fontSize: 13, fontWeight: '900' },
  selfieRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f3f6f4', borderRadius: 12, padding: 10 },
  selfie: { width: 70, height: 70, borderRadius: 12 },
  otpWrap: { marginVertical: 10 },
  textButton: { alignItems: 'center', paddingVertical: 8 },
  textButtonText: { color: '#5f7068', fontSize: 12, fontWeight: '800' },
  cancelLink: { color: '#8a6b66', fontSize: 12, fontWeight: '800' },
  waitCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberSoft, borderRadius: 14, borderWidth: 1, borderColor: '#f3d9a4', padding: 14 },
  waitText: { flex: 1, color: '#7a4a10', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  thumbs: { gap: 8, marginTop: 8 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#e6ece9' },
  textArea: { minHeight: 90, borderRadius: 12, borderWidth: 1, borderColor: '#dfe6e2', backgroundColor: '#f8faf9', padding: 12, color: colors.ink, fontSize: 13, textAlignVertical: 'top' },
  evidenceRow: { flexDirection: 'row', gap: 10 },
  evidence: { width: '100%', height: 110, borderRadius: 12, backgroundColor: '#e6ece9' },
  caption: { color: '#5f7068', fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  value: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  collect: { backgroundColor: '#f1f8f4', borderRadius: 12, padding: 10, gap: 6, marginTop: 6 },
  collectTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#d7e6de', backgroundColor: '#fff', paddingHorizontal: 11 },
  optionActive: { borderColor: colors.forest, backgroundColor: '#e8f4ee' },
  optionText: { flex: 1, color: '#33463f', fontSize: 12, fontWeight: '700' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#b7c9c1', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.forest },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.forest },
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 11, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  emptyButton: { alignSelf: 'stretch', marginTop: 14 },
});
