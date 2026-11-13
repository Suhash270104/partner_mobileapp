import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { PartnerBrand } from '../../components/PartnerBrand';
import { Icon } from '../../components/Icon';
import {
  partnerApi,
  PartnerApiError,
  TechnicianBookingRecord,
  TechnicianEarningsRecord,
  TechnicianKycState,
  TechnicianProfileRecord,
} from '../../lib/partnerApi';import { useLiveLocationSharing } from '../../lib/technicianLiveLocation';
import { getEquipmentLabel } from '../../lib/technicianEquipment';
import { registerPartnerDevicePush } from '../../lib/partnerPush';

type DashboardTab = 'jobs' | 'earnings' | 'history' | 'profile';
type JobFilter = 'all' | 'incoming' | 'active';

const money = (amount: number | null | undefined) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(amount ?? 0);

const SLA_WINDOW_MS = 10 * 60 * 1000;
const publicSite = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');

function useCountdown(deadline: number | null, key: string) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [deadline, key]);
  return deadline ? secondsLeft : null;
}

function bookingId(booking: TechnicianBookingRecord) {
  return booking._id || booking.id || '';
}

function statusLabel(status?: string) {
  return (status || 'UNKNOWN').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function dateLabel(date?: string, slot?: string) {
  const parsed = date ? new Date(date) : null;
  const day = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return [day, slot].filter(Boolean).join(' · ') || 'Schedule not available';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TechnicianDashboardScreen() {
  const [tab, setTab] = useState<DashboardTab>('jobs');
  const [jobFilter, setJobFilter] = useState<JobFilter>('all');
  const [profile, setProfile] = useState<TechnicianProfileRecord | null>(null);
  const [incoming, setIncoming] = useState<TechnicianBookingRecord | null>(null);
  const [activeJobs, setActiveJobs] = useState<TechnicianBookingRecord[]>([]);
  const [earnings, setEarnings] = useState<TechnicianEarningsRecord | null>(null);
  const [history, setHistory] = useState<TechnicianBookingRecord[]>([]);
  const [kyc, setKyc] = useState<TechnicianKycState | null>(null);
  const [kycConfigured, setKycConfigured] = useState(false);
  const kycLoaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [jobBusy, setJobBusy] = useState('');
  const [apiError, setApiError] = useState('');
  const [earningsError, setEarningsError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [coreLoaded, setCoreLoaded] = useState(false);
  const [kycPromptDismissed, setKycPromptDismissed] = useState(false);
  const [kycError, setKycError] = useState('');

  // Offer pushes must work even if the setup screen was skipped: register this phone every time the
  // dashboard opens (a no-op once registered, and it never blocks or throws).
  useEffect(() => { void registerPartnerDevicePush(); }, []);

  const loadCore = useCallback(async (includeEarnings = false, pullToRefresh = false) => {
    if (pullToRefresh) setRefreshing(true);
    setApiError('');
    try {
      const [profileResult, incomingResult, activeResult] = await Promise.all([
        partnerApi.technicianProfile(),
        partnerApi.technicianIncomingJob(),
        partnerApi.technicianActiveJobs(),
      ]);
      setProfile(profileResult.technician);
      setIncoming(incomingResult.booking);
      setActiveJobs(activeResult.bookings);
      setCoreLoaded(true);
      if (includeEarnings || !kycLoaded.current) {
        try {
          const kycResult = await partnerApi.technicianKycStatus();
          setKyc(kycResult.kyc);
          setKycConfigured(kycResult.configured);
          kycLoaded.current = true;
          setKycError('');
        } catch (error) {
          setKycError(errorMessage(error, 'Could not load identity verification status.'));
        }
      }
      if (includeEarnings) {
        try {
          setEarnings(await partnerApi.technicianEarnings());
          setEarningsError('');
        } catch (error) {
          setEarningsError(errorMessage(error, 'Could not load earnings.'));
        }
      }
    } catch (error) {
      if (error instanceof PartnerApiError && error.status === 401) {
        router.replace('/');
        return;
      }
      setApiError(errorMessage(error, 'Could not load technician dashboard.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Light poll for new offers and job-status changes; a failed poll keeps what is already on screen.
  const loadJobs = useCallback(async () => {
    try {
      const [incomingResult, activeResult] = await Promise.all([partnerApi.technicianIncomingJob(), partnerApi.technicianActiveJobs()]);
      setIncoming(incomingResult.booking);
      setActiveJobs(activeResult.bookings);
    } catch {
      // transient poll failure
    }
  }, []);

  const loadEarnings = useCallback(async () => {
    setEarningsError('');
    try {
      setEarnings(await partnerApi.technicianEarnings());
    } catch (error) {
      setEarningsError(errorMessage(error, 'Could not load earnings.'));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const result = await partnerApi.technicianJobHistory();
      setHistory(result.bookings);
    } catch (error) {
      setHistoryError(errorMessage(error, 'Could not load job history.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadCore(true);
    let ticks = 0;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      ticks += 1;
      void (ticks % 6 === 0 ? loadCore() : loadJobs());
    }, 5000);
    return () => clearInterval(timer);
  }, [loadCore, loadJobs]));

  const refresh = useCallback(async () => {
    await loadCore(true, true);
    if (tab === 'history') await loadHistory();
  }, [loadCore, loadHistory, tab]);

  const selectTab = (next: DashboardTab) => {
    setTab(next);
    if (next === 'earnings') void loadEarnings();
    if (next === 'history') void loadHistory();
  };

  async function changeAvailability(isOnline: boolean) {
    if (!profile) return;
    setAvailabilityBusy(true);
    setApiError('');
    try {
      const status = isOnline
        ? profile.currentStatus === 'BUSY' ? 'BUSY' : 'AVAILABLE'
        : 'OFF_DUTY';
      const result = await partnerApi.updateTechnicianAvailability(isOnline, status);
      setProfile(result.technician);
      await loadCore();
    } catch (error) {
      setApiError(errorMessage(error, 'Could not update your availability.'));
    } finally {
      setAvailabilityBusy(false);
    }
  }

  async function respondToJob(action: 'accept' | 'reject') {
    if (!incoming) return;
    const id = bookingId(incoming);
    if (!id) {
      setApiError('This dispatch is missing its booking reference. Refresh and try again.');
      return;
    }
    if (action === 'reject') {
      Alert.alert('Pass on this dispatch?', 'This job will be offered to another technician.', [
        { text: 'Keep job', style: 'cancel' },
        { text: 'Pass', style: 'destructive', onPress: () => { void submitJobResponse(id, action); } },
      ]);
      return;
    }
    await submitJobResponse(id, action);
  }

  async function submitJobResponse(id: string, action: 'accept' | 'reject') {
    setJobBusy(action);
    setApiError('');
    try {
      await partnerApi.respondToTechnicianJob(id, action);
      await loadCore();
    } catch (error) {
      setApiError(errorMessage(error, `Could not ${action} this dispatch.`));
    } finally {
      setJobBusy('');
    }
  }

  async function startTravel(booking: TechnicianBookingRecord) {
    const id = bookingId(booking);
    if (!id) {
      setApiError('This job is missing its booking reference. Refresh and try again.');
      return;
    }
    setJobBusy(id);
    setApiError('');
    try {
      await partnerApi.startTechnicianTravel(id);
      await loadCore();
    } catch (error) {
      setApiError(errorMessage(error, 'Could not start the trip.'));
    } finally {
      setJobBusy('');
    }
  }

  async function openNavigation(booking: TechnicianBookingRecord) {
    const address = booking.customerDetails?.address;
    const lat = address?.lat;
    const lng = address?.lng;
    const written = [address?.street, address?.locality, address?.city, address?.pincode].filter(Boolean).join(', ');
    if ((typeof lat !== 'number' || typeof lng !== 'number') && !written) {
      setApiError('This booking has no address or map coordinates. Call the customer for directions.');
      return;
    }
    const destination = typeof lat === 'number' && typeof lng === 'number' ? `${lat},${lng}` : encodeURIComponent(written);
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
    } catch (error) {
      setApiError(errorMessage(error, 'Could not open navigation.'));
    }
  }

  async function callCustomer(booking: TechnicianBookingRecord) {
    const phone = booking.customerDetails?.phone?.trim();
    if (!phone) {
      setApiError('A phone number is not available for this booking.');
      return;
    }
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch (error) {
      setApiError(errorMessage(error, 'Could not open the phone app.'));
    }
  }

  function openKyc() {
    setKycPromptDismissed(true);
    router.push('/technician/kyc');
  }

  const verified = profile?.verificationStatus === 'VERIFIED'
    && (profile.kycStatus === 'APPROVED' || profile.kycStatus === 'EXEMPT');
  const kycPromptVisible = Boolean(
    profile?.onboardingSubmittedAt
    && kycConfigured
    && kyc?.status === 'PENDING'
    && !kyc.sessionId
    && !kycPromptDismissed
    && !verified
  );
  const online = profile?.isOnline === true;
  const liveLocation = useLiveLocationSharing(online);
  const kycDeclined = profile?.kycStatus === 'DECLINED';
  // A declined technician has no read-only dashboard: every action is blocked server-side, so they
  // are kept on the verification screen where they can retry or file a support request.
  useEffect(() => {
    if (kycDeclined) router.replace('/technician/kyc');
  }, [kycDeclined]);
  const incomingId = incoming ? bookingId(incoming) : '';
  const myQueueEntry = incoming?.candidateTechnicianQueue?.find(entry => String(entry.technicianId) === String(profile?._id || profile?.id) && entry.status === 'PENDING');
  const slaDeadline = myQueueEntry?.assignedAt ? new Date(myQueueEntry.assignedAt).getTime() + SLA_WINDOW_MS : null;
  const secondsLeft = useCountdown(slaDeadline, incomingId);

  // Banner state, mirroring TechnicianDashboardView.tsx. Identity verification drives what the
  // technician has to DO next; EXEMPT accounts predate KYC and are never nagged.
  const kycStatus = profile?.kycStatus || 'PENDING';
  const kycSettled = kycStatus === 'APPROVED' || kycStatus === 'EXEMPT';
  const kycInReview = kycStatus === 'IN_REVIEW';
  const needsKyc = !kycSettled && !kycInReview && !kycDeclined;
  const adminRejected = profile?.verificationStatus === 'REJECTED' && kycSettled;
  const hasBasePin = profile?.coordinates?.lat != null && profile?.coordinates?.lng != null;
  const setupIncomplete = kycStatus !== 'EXEMPT'
    && (kycSettled || kycInReview)
    && !((profile?.equipmentChecklist?.length ?? 0) > 0)
    && !(profile?.bankDetails?.accountNumber || profile?.bankDetails?.upiId);
  const needsSlots = profile?.type === 'KN_CERTIFIED' && kycSettled && !(profile.availabilitySlots?.length);
  const pendingSkills = (profile?.categoryExpertise || []).filter(entry => entry.status === 'PENDING');
  const rejectedSkills = (profile?.categoryExpertise || []).filter(entry => entry.status === 'REJECTED');
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const skillBannerCount = pendingSkills.length + rejectedSkills.length;
  useEffect(() => {
    if (!skillBannerCount) return;
    let active = true;
    partnerApi.technicianServiceCatalog()
      .then(result => { if (active) setCategoryNames(Object.fromEntries(result.categories.map(category => [category.key, category.name]))); })
      .catch(() => {});
    return () => { active = false; };
  }, [skillBannerCount]);
  const skillName = (key: string) => categoryNames[key] || statusLabel(key);

  async function contactSupport() {
    if (!publicSite) {
      setApiError('Set EXPO_PUBLIC_PUBLIC_SITE_URL to open Kraftnex support.');
      return;
    }
    try { await Linking.openURL(`${publicSite}/contact`); } catch (error) { setApiError(errorMessage(error, 'Could not open support.')); }
  }

  async function signOut() {
    try {
      await partnerApi.logout();
      router.replace('/');
    } catch (error) {
      setApiError(errorMessage(error, 'Could not sign out.'));
    }
  }
  const name = profile?.name?.trim() || 'Technician';
  const initials = name === 'Technician' ? 'T' : name.slice(0, 1).toUpperCase();
  const location = [profile?.city, profile?.baseAddress].filter(Boolean).join(' · ') || 'Location not set';
  const equipmentCount = profile?.equipmentChecklist?.length ?? 0;
  const radiusLabel = profile?.serviceRadiusKm ? `${profile.serviceRadiusKm} km` : '30 km (standard)';
  const totalEarnings = earnings?.earningsTotal ?? profile?.earningsTotal ?? 0;
  const pendingEarnings = earnings?.earningsPending ?? profile?.earningsPending ?? 0;
  const completedJobs = earnings?.jobsCompleted ?? profile?.jobsCompleted ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button">
          <PartnerBrand compact />
        </Pressable>
        <Pressable style={styles.avatar} onPress={() => selectTab('profile')} accessibilityLabel="Open technician profile">
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#07523e" />}
      >
        {tab === 'jobs' && <View style={styles.jobsHeading}>
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>
          <View>
            <Text style={styles.jobsTitle}>Jobs</Text>
            <Text style={styles.jobsSubtitle}>Technician dispatch</Text>
          </View>
        </View>}

        <View style={styles.identityRow}>
          <View style={styles.identityIcon}><Text style={styles.identityGlyph}>⚒</Text></View>
          <View style={styles.flex}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.subheading}>{profile?.type === 'KN_CERTIFIED' ? 'KN-Certified Partner' : 'Independent Specialist'}</Text>
          </View>
          <View style={[styles.statusPill, online ? styles.onlinePill : styles.offlinePill]}>
            <View style={[styles.statusDot, online ? styles.onlineDot : styles.offlineDot]} />
            <Text style={[styles.statusPillText, online ? styles.onlineText : styles.offlineText]}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>

        <View style={styles.availabilityCard}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{online && verified ? 'Online & dispatchable' : online ? 'Online · verification required for dispatch' : 'Go online to receive jobs'}</Text>
            <Text style={styles.muted}>{verified ? statusLabel(profile?.currentStatus) : online ? `Verification ${statusLabel(profile?.kycStatus)}` : 'Finish identity verification before going online'}</Text>
          </View>
          {availabilityBusy ? <ActivityIndicator color="#07523e" /> : <Switch
            disabled={!profile || (!online && !verified)}
            value={online}
            onValueChange={value => void changeAvailability(value)}
            trackColor={{ false: '#cbd5d1', true: '#8ac8ac' }}
            thumbColor={online ? '#07523e' : '#f7f9f8'}
            accessibilityLabel="Technician availability"
          />}
        </View>

        {online && liveLocation !== 'off' && <Text style={styles.footnote}>
          {liveLocation === 'sharing' ? 'Live location on: jobs are matched from where you are.' : 'Location is off: jobs are matched from your base location.'}
        </Text>}

        <View style={styles.detailsRow}>
          <DetailTile label="SERVICE AREA" value={radiusLabel} note={location} icon="⌖" />
          <DetailTile label="EQUIPMENT" value={`${equipmentCount}`} note={equipmentCount === 1 ? 'tool confirmed' : 'tools confirmed'} icon="▦" />
        </View>

        {!!apiError && <ErrorBanner message={apiError} onRetry={() => { setLoading(true); void loadCore(true); }} />}
        {loading && !profile && <View style={styles.loadingCard}><ActivityIndicator color="#07523e" /><Text style={styles.muted}>Loading your technician workspace…</Text></View>}

        {needsKyc && !!profile && <NoticeCard tone="warn" title="Verify your identity to go live" text="Your profile is hidden from customers and you won't receive job requests until you complete a quick ID check. It takes about two minutes." action="Verify now" onAction={openKyc} />}
        {kycInReview && <NoticeCard tone="warn" title="Your ID is being reviewed" text="Nothing more is needed from you. We'll activate your profile as soon as the review clears, and you'll start receiving job requests straight away." />}
        {adminRejected && <NoticeCard tone="danger" title="Your account is on hold" text={`Reason: ${profile?.rejectionReason || 'Our team placed your account on hold pending a review.'} Your identity is verified, so this isn't an ID problem. Our support team can walk you through what's needed.`} action="Contact support" onAction={() => void contactSupport()} />}
        {pendingSkills.length > 0 && <NoticeCard tone="warn" title="Your skills are being reviewed" text={`${pendingSkills.map(entry => skillName(entry.categoryKey)).join(', ')}: you'll start getting these jobs as soon as our team approves them.`} />}
        {rejectedSkills.length > 0 && <NoticeCard tone="danger" title="Some skills need more proof" text={rejectedSkills.map(entry => `${skillName(entry.categoryKey)}: ${entry.rejectionReason || 'Not approved yet.'}`).join('\n')} action="Add proof" onAction={() => router.push({ pathname: '/technician/setup', params: { resume: 'expertise' } })} />}
        {setupIncomplete && <NoticeCard tone="info" title="Finish setting up your profile" text="Add the tools you carry and your payout details so customers can book you and we can pay you for completed jobs." action="Finish setup" onAction={() => router.push('/technician/edit-profile')} />}
        {!!profile && !hasBasePin && <NoticeCard tone="info" title="Set your service area" text="Tell us where you start your day and how far you'll travel. Until then you won't be matched to customers near you." action="Set service area" onAction={() => router.push('/technician/edit-profile')} />}
        {needsSlots && <NoticeCard tone="info" title="Set your weekly availability" text="Customers can only book you for time windows you publish. Until you add some, nobody can book you directly." action="Set availability" onAction={() => router.push('/technician/edit-profile')} />}

        {tab === 'jobs' && <>
          <View style={styles.jobFilters} accessibilityRole="tablist">
            <JobFilterButton label="All jobs" selected={jobFilter === 'all'} onPress={() => setJobFilter('all')} />
            <JobFilterButton label="Incoming" selected={jobFilter === 'incoming'} onPress={() => setJobFilter('incoming')} />
            <JobFilterButton label="Active" selected={jobFilter === 'active'} onPress={() => setJobFilter('active')} />
          </View>
          <Text style={styles.sectionTitle}>Shift performance</Text>
          <View style={styles.performanceCard}>
            <Metric label="JOBS" value={`${completedJobs} done`} />
            <View style={styles.metricDivider} />
            <Metric label="EARNINGS" value={money(totalEarnings)} />
            <View style={styles.metricDivider} />
            <Metric label={`RATING · ${profile?.totalReviews ?? 0} REVIEWS`} value={`${(profile?.rating ?? 0).toFixed(2)} ★`} />
          </View>
          <Text style={styles.footnote}>{activeJobs.length} in progress · Pending payout: {money(pendingEarnings)}</Text>

          {jobFilter !== 'active' && <>
            <Text style={styles.sectionTitle}>Incoming dispatch</Text>
            {incoming
              ? <IncomingJobCard booking={incoming} secondsLeft={secondsLeft} busy={jobBusy !== ''} onNavigate={() => void openNavigation(incoming)} onAccept={() => void respondToJob('accept')} onPass={() => void respondToJob('reject')} />
              : coreLoaded ? <EmptyCard title="No incoming dispatches" detail={online ? 'New job offers will appear here.' : 'Go online when you are ready to receive job offers.'} /> : null}
          </>}

          {jobFilter !== 'incoming' && <>
            <Text style={styles.sectionTitle}>Active jobs <Text style={styles.countText}>{activeJobs.length}</Text></Text>
            {activeJobs.length
              ? activeJobs.map(booking => <ActiveJobCard
                key={bookingId(booking)}
                booking={booking}
                busy={jobBusy === bookingId(booking)}
                onOpen={() => router.push({ pathname: '/technician/job/[id]', params: { id: bookingId(booking) } })}
                onStartTravel={() => void startTravel(booking)}
                onNavigate={() => void openNavigation(booking)}
                onCall={() => void callCustomer(booking)}
              />)
              : coreLoaded ? <EmptyCard title="No active jobs" detail="Accepted and scheduled work will appear here." /> : null}
          </>}

          <View style={styles.complianceCard}>
            <Text style={styles.complianceIcon}>{verified ? '✓' : '!'}</Text>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{verified ? 'Verification cleared' : `Verification ${statusLabel(profile?.kycStatus)}`}</Text>
              <Text style={styles.muted}>{verified ? 'Your account is cleared to receive eligible service jobs.' : profile?.rejectionReason || 'Job dispatch is enabled after identity verification is approved.'}</Text>
            </View>
          </View>
        </>}

        {tab === 'earnings' && <>
          <SectionHeading title="Earnings & payouts" detail="What you have earned and when you get paid." />
          {!!earningsError && <ErrorBanner message={earningsError} onRetry={() => void loadEarnings()} />}
          <View style={styles.summaryCard}>
            <Text style={styles.heroLabel}>TOTAL EARNED</Text>
            <Text style={styles.earningsTotal}>{money(earnings?.earningsTotal ?? 0)}</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroNote}>Pending payout</Text>
              <Text style={styles.heroValue}>{money(earnings?.earningsPending ?? 0)}</Text>
            </View>
            <View style={styles.heroRow}>
              <Text style={styles.heroNote}>Completed jobs</Text>
              <Text style={styles.heroValue}>{earnings?.jobsCompleted ?? 0}</Text>
            </View>
          </View>
          <View style={styles.twoMetrics}>
            <MetricCard label="PENDING PAYOUTS" value={money(earnings?.earningsPending ?? 0)} />
            <MetricCard label="LIFETIME PAYOUT" value={money(earnings?.earningsTotal ?? 0)} />
          </View>

          <View style={styles.settlementCard}>
            <View style={styles.settlementTop}>
              <Text style={styles.cardTitle}>Settlement destination</Text>
              <Pressable onPress={() => router.push('/technician/edit-profile')}><Text style={styles.editLink}>Edit</Text></Pressable>
            </View>
            <Text style={styles.settlementValue}>
              {profile?.bankDetails?.upiId
                ? `UPI · ${profile.bankDetails.upiId}`
                : profile?.bankDetails?.accountNumber
                  ? `Bank A/C · •••• ${profile.bankDetails.accountNumber.slice(-4)}${profile.bankDetails.ifscCode ? ` · ${profile.bankDetails.ifscCode}` : ''}`
                  : 'No payout destination saved yet'}
            </Text>
            <Text style={styles.muted}>Completed-job payouts are sent to this account.</Text>
          </View>

          <Text style={styles.sectionTitle}>Payout history & ledger</Text>
          {earnings?.recentJobs.length
            ? earnings.recentJobs.map((job, index) => {
              const gross = job.pricing?.totalAmount ?? 0;
              const net = job.technicianPayout ?? 0;
              const deductions = Math.max(0, gross - net);
              return <View key={job._id || job.bookingNumber || `recent-${index}`} style={styles.ledgerCard}>
                <View style={styles.ledgerTop}>
                  <View style={styles.flex}>
                    <Text style={styles.ledgerRef}>{job.bookingNumber ? `#${job.bookingNumber}` : 'Completed service'}</Text>
                    <Text style={styles.muted}>{statusLabel(job.serviceCategory)}{job.updatedAt ? ` · ${dateLabel(job.updatedAt)}` : ''}</Text>
                  </View>
                  <Text style={styles.paidPill}>Completed</Text>
                </View>
                <View style={styles.ledgerRow}><Text style={styles.ledgerLabel}>Gross customer fare</Text><Text style={styles.ledgerValue}>{money(gross)}</Text></View>
                <View style={styles.ledgerRow}><Text style={styles.ledgerLabel}>Platform commission & tax</Text><Text style={styles.ledgerDeduction}>-{money(deductions)}</Text></View>
                <View style={[styles.ledgerRow, styles.ledgerNet]}><Text style={styles.ledgerNetLabel}>Net payout</Text><Text style={styles.listAmount}>{money(net)}</Text></View>
              </View>;
            })
            : !earningsError && <EmptyCard title="No completed jobs yet" detail="Fulfill your first booking to see payout receipts here." />}
        </>}

        {tab === 'history' && <>
          <SectionHeading title="Job history" detail="Completed and cancelled bookings from your account." />
          {!!historyError && <ErrorBanner message={historyError} onRetry={() => void loadHistory()} />}
          {historyLoading && !history.length
            ? <View style={styles.loadingCard}><ActivityIndicator color="#07523e" /><Text style={styles.muted}>Loading job history…</Text></View>
            : history.length
              ? <>
                <Text style={styles.footnote}>{history.length} jobs total</Text>
                {history.map((booking, index) => <HistoryCard key={bookingId(booking) || `history-${index}`} booking={booking} />)}
              </>
              : !historyError && <EmptyCard title="No job history yet" detail="Completed and cancelled bookings will appear here." />}
        </>}

        {tab === 'profile' && <>
          <SectionHeading title="Technician profile" detail="Your saved onboarding and service details." />
          <View style={styles.profileHero}>
            {profile?.profilePhoto || profile?.liveSelfieUrl
              ? <Image source={{ uri: profile.profilePhoto || profile.liveSelfieUrl }} style={styles.profilePhoto} />
              : <View style={[styles.profilePhoto, styles.profilePhotoFallback]}><Text style={styles.avatarText}>{initials}</Text></View>}
            <View style={styles.flex}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.subheading}>{profile?.type === 'KN_CERTIFIED' ? 'KN-Certified Partner' : 'Independent Specialist'}</Text>
              <Text style={styles.subheading}>{Number(profile?.totalReviews) > 0 ? `${(profile?.rating ?? 0).toFixed(1)} ★ · ${profile?.totalReviews} reviews` : 'New specialist'}</Text>
            </View>
          </View>
          <Pressable style={styles.editButton} onPress={() => router.push('/technician/edit-profile')}>
            <Text style={styles.editButtonText}>Edit profile, service area & payout</Text>
          </Pressable>
          <View style={styles.profileCard}>
            <ProfileRow label="Name" value={profile?.name || '—'} />
            <ProfileRow label="Phone" value={profile?.phone || '—'} />
            <ProfileRow label="Email" value={profile?.email || '—'} />
            <ProfileRow label="Partner type" value={profile?.type === 'KN_CERTIFIED' ? 'KN-Certified Partner' : profile?.type === 'INDEPENDENT' ? 'Independent Specialist' : '—'} />
            <ProfileRow label="Trade experience" value={`${profile?.experienceYears ?? 0} years`} />
            <ProfileRow label="Verification" value={`${statusLabel(profile?.verificationStatus)} · ${statusLabel(profile?.kycStatus)}`} />
            <ProfileRow label="Service area" value={location} />
            <ProfileRow label="Service radius" value={radiusLabel} />
            <ProfileRow label="Equipment checklist" value={`${equipmentCount}`} last />
          </View>
          {!!profile?.categories?.length && <View style={styles.tagsCard}>
            <Text style={styles.metricLabel}>ACTIVE SERVICE CATEGORIES</Text>
            <View style={styles.tags}>{profile.categories.map(category => <Text key={category} style={styles.tag}>{statusLabel(category)}</Text>)}</View>
          </View>}
          {!!equipmentCount && <View style={styles.tagsCard}>
            <Text style={styles.metricLabel}>CONFIRMED EQUIPMENT</Text>
            {profile?.equipmentChecklist?.slice(0, 8).map(item => <Text key={item} style={styles.toolRow}>✓  {getEquipmentLabel(item)}</Text>)}
            {equipmentCount > 8 && <Text style={styles.muted}>+ {equipmentCount - 8} more</Text>}
          </View>}
          <View style={styles.kycProfileCard}>
            <View style={styles.kycProfileHeader}>
              <View style={styles.kycIcon}><Text style={styles.kycIconText}>▣</Text></View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Identity verification</Text>
                <Text style={styles.muted}>{kycError || `Status · ${statusLabel(kyc?.status || profile?.kycStatus)}`}</Text>
              </View>
            </View>
            {!!kyc?.declineReasons.length && kyc.status === 'DECLINED' && <Text style={styles.kycProfileReason}>{kyc.declineReasons.join(' · ')}</Text>}
            <Pressable style={styles.kycProfileButton} onPress={openKyc}>
              <Text style={styles.kycProfileButtonText}>
                {verified ? 'View verification record' : kyc?.status === 'IN_REVIEW' ? 'View verification status' : kyc?.status === 'DECLINED' ? 'Continue identity verification' : 'Start KYC verification'}
              </Text>
              <Text style={styles.kycProfileArrow}>→</Text>
            </Pressable>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/technician/setup')}>
            <Text style={styles.secondaryButtonText}>Review onboarding details</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </>}
        <Text style={styles.footer}>Kraftnex Partner · Technician workspace</Text>
      </ScrollView>

      <Modal visible={kycPromptVisible} transparent animationType="fade" onRequestClose={() => {
        setKycPromptDismissed(true);
      }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.kycPromptCard}>
            <View style={styles.kycPromptIcon}><Text style={styles.kycPromptIconText}>▣</Text></View>
            <Text style={styles.kycPromptTitle}>Complete identity verification</Text>
            <Text style={styles.kycPromptCopy}>Your technician setup is saved. Start KYC to verify your identity before receiving service jobs.</Text>
            <Pressable style={styles.kycPromptPrimary} onPress={openKyc}>
              <Text style={styles.kycPromptPrimaryText}>Start KYC  →</Text>
            </Pressable>
            <Pressable style={styles.kycPromptSecondary} onPress={() => {
              setKycPromptDismissed(true);
              setTab('profile');
            }}>
              <Text style={styles.kycPromptSecondaryText}>Not now · Find it in Profile</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomNav}>
        <NavItem label="My Jobs" icon="briefcase" active={tab === 'jobs'} onPress={() => selectTab('jobs')} />
        <NavItem label="Earnings" icon="rupee" active={tab === 'earnings'} onPress={() => selectTab('earnings')} />
        <NavItem label="Past Jobs" icon="clock" active={tab === 'history'} onPress={() => selectTab('history')} />
        <NavItem label="Account" icon="user" active={tab === 'profile'} onPress={() => selectTab('profile')} />
      </View>
    </SafeAreaView>
  );
}

function NoticeCard({ tone, title, text, action, onAction }: {
  tone: 'warn' | 'danger' | 'info';
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return <View style={[styles.notice, tone === 'warn' && styles.noticeWarn, tone === 'danger' && styles.noticeDanger, tone === 'info' && styles.noticeInfo]}>
    <Text style={[styles.noticeTitle, tone === 'danger' && styles.noticeTitleDanger]}>{title}</Text>
    <Text style={styles.noticeText}>{text}</Text>
    {!!action && !!onAction && <Pressable onPress={onAction} style={[styles.noticeButton, tone === 'danger' && styles.noticeButtonDanger]}>
      <Text style={styles.noticeButtonText}>{action}  →</Text>
    </Pressable>}
  </View>;
}

function DetailTile({ label, value, note, icon }: { label: string; value: string; note: string; icon: string }) {
  return <View style={styles.detailTile}>
    <View style={styles.detailTop}><Text style={styles.detailIcon}>{icon}</Text><Text style={styles.detailLabel}>{label}</Text></View>
    <Text style={styles.detailValue}>{value}</Text>
    <Text numberOfLines={1} style={styles.detailNote}>{note}</Text>
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}>
    <Text numberOfLines={1} style={styles.metricLabel}>{label}</Text>
    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text>
  </View>;
}

function JobFilterButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable
    accessibilityRole="tab"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={[styles.jobFilterButton, selected && styles.jobFilterButtonSelected]}
  >
    <Text style={[styles.jobFilterText, selected && styles.jobFilterTextSelected]}>{label}</Text>
  </Pressable>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.sectionHeading}>
    <Text style={styles.pageTitle}>{title}</Text>
    <Text style={styles.muted}>{detail}</Text>
  </View>;
}

function IncomingJobCard({ booking, secondsLeft, busy, onNavigate, onAccept, onPass }: {
  booking: TechnicianBookingRecord;
  secondsLeft: number | null;
  busy: boolean;
  onNavigate: () => void;
  onAccept: () => void;
  onPass: () => void;
}) {
  const address = booking.customerDetails?.address;
  const place = [address?.locality, address?.city].filter(Boolean).join(', ');
  const title = booking.serviceSnapshot?.title || booking.serviceCategory || 'Service request';
  return <View style={styles.incomingCard}>
    <View style={styles.incomingEyebrow}>
      <Text style={styles.incomingEyebrowText}>INCOMING JOB OFFER · 10-MIN SLA</Text>
      {secondsLeft != null
        ? <Text style={[styles.incomingStatus, styles.countdown]}>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</Text>
        : <Text style={styles.incomingStatus}>{statusLabel(booking.status)}</Text>}
    </View>
    {typeof address?.lat === 'number' && typeof address.lng === 'number' && <Pressable onPress={onNavigate} style={styles.gpsRow}>
      <Text style={styles.gpsText}>GPS {address.lat.toFixed(5)}, {address.lng.toFixed(5)}</Text>
      <Text style={styles.gpsLink}>Preview route ↗</Text>
    </Pressable>}
    <Text style={styles.jobTitle}>{title}</Text>
    <Text style={styles.jobCustomer}>{booking.customerDetails?.name || 'Customer name unavailable'}{place ? ` · ${place}` : ''}</Text>
    <View style={styles.jobMetaRow}>
      <Text style={styles.jobMeta}>◷  {dateLabel(booking.scheduledDate, booking.scheduledSlot)}</Text>
      <Text style={styles.jobMeta}>{booking.bookingNumber || 'Booking reference unavailable'}</Text>
    </View>
    <View style={styles.bookingTotal}><Text style={styles.bookingTotalLabel}>BOOKING TOTAL</Text><Text style={styles.bookingTotalValue}>{money(booking.pricing?.totalAmount ?? 0)}</Text></View>
    <View style={styles.dispatchActions}>
      <Pressable disabled={busy} style={[styles.acceptButton, busy && styles.disabledButton]} onPress={onAccept}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>Accept dispatch</Text>}
      </Pressable>
      <Pressable disabled={busy} style={[styles.passButton, busy && styles.disabledButton]} onPress={onPass}>
        <Text style={styles.passText}>Pass</Text>
      </Pressable>
    </View>
  </View>;
}

const NEXT_STEP_LABEL: Record<string, string> = {
  EN_ROUTE: 'Verify arrival  →',
  ARRIVED: 'Document site & start work  →',
  SCOPE_CHANGE_PENDING: 'View scope change status  →',
  IN_PROGRESS: 'Document completed work  →',
  WORK_COMPLETED: 'Verify OTP & complete  →',
};

function ActiveJobCard({ booking, busy, onOpen, onStartTravel, onNavigate, onCall }: {
  booking: TechnicianBookingRecord;
  busy: boolean;
  onOpen: () => void;
  onStartTravel: () => void;
  onNavigate: () => void;
  onCall: () => void;
}) {
  const address = booking.customerDetails?.address;
  const place = [address?.street, address?.locality, address?.city].filter(Boolean).join(', ');
  const status = booking.status;
  return <View style={styles.activeCard}>
    <View style={styles.activeTop}>
      <Text style={styles.activeEyebrow}>ACTIVE JOB</Text>
      <Text style={styles.activeStatus}>{statusLabel(status)}</Text>
    </View>
    <Text style={styles.activeTitle}>{booking.serviceSnapshot?.title || booking.serviceCategory || 'Service job'}</Text>
    <Text style={styles.activeCustomer}>{booking.customerDetails?.name || 'Customer name unavailable'}</Text>
    <Text style={styles.activeMeta}>{dateLabel(booking.scheduledDate, booking.scheduledSlot)}</Text>
    {!!place && <Text style={styles.activeMeta}>{place}</Text>}
    <View style={styles.activeDivider} />
    <Text style={styles.activeNext}>
      {status === 'CONFIRMED'
        ? 'Start the trip when you are ready to travel.'
        : status === 'EN_ROUTE'
          ? 'You are marked en route. Complete arrival verification with the customer at the service location.'
          : status === 'WORK_COMPLETED'
            ? 'Work is marked complete. Confirm the customer completion code to close the booking.'
            : 'Follow the required verification and documentation steps for this booking.'}
    </Text>
    {status === 'CONFIRMED' && <Pressable disabled={busy} style={[styles.startTravelButton, busy && styles.disabledButton]} onPress={onStartTravel}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>Start trip</Text>}
    </Pressable>}
    {!!status && !!NEXT_STEP_LABEL[status] && <Pressable style={styles.startTravelButton} onPress={onOpen}>
      <Text style={styles.acceptText}>{NEXT_STEP_LABEL[status]}</Text>
    </Pressable>}
    {status === 'CONFIRMED' && <Pressable onPress={onOpen} style={styles.manageLink}><Text style={styles.manageLinkText}>Open job details / cancel</Text></Pressable>}
    <View style={styles.activeActions}>
      <Pressable style={styles.activeActionButton} onPress={onNavigate}><Text style={styles.activeActionText}>Open navigation</Text></Pressable>
      {!!booking.customerDetails?.phone && <Pressable style={styles.activeActionButton} onPress={onCall}><Text style={styles.activeActionText}>Call customer</Text></Pressable>}
    </View>
  </View>;
}

function HistoryCard({ booking }: { booking: TechnicianBookingRecord }) {
  const [open, setOpen] = useState(false);
  const before = booking.jobDocumentation?.beforePhotos || [];
  const after = booking.jobDocumentation?.afterPhotos || [];
  const note = booking.jobDocumentation?.workSummaryNote;
  const hasEvidence = before.length > 0 || after.length > 0 || !!note;
  const completed = booking.status === 'COMPLETED';
  return <View style={styles.historyCard}>
    <View style={styles.historyTop}>
      <View style={styles.flex}>
        <Text style={styles.ledgerRef}>{booking.bookingNumber ? `#${booking.bookingNumber}` : 'Booking'}</Text>
        <Text style={styles.cardTitle}>{booking.serviceSnapshot?.title || statusLabel(booking.serviceCategory) || 'Service job'}</Text>
        <Text style={styles.muted}>{dateLabel(booking.scheduledDate, booking.scheduledSlot)}</Text>
      </View>
      <View style={styles.historyStatus}>
        <Text style={styles.listAmount}>{money(booking.pricing?.totalAmount)}</Text>
        <Text style={[styles.historyStatusText, completed ? styles.statusDone : styles.statusOther]}>{statusLabel(booking.status)}</Text>
      </View>
    </View>
    {hasEvidence && <Pressable onPress={() => setOpen(value => !value)} style={styles.evidenceButton}>
      <Text style={styles.evidenceButtonText}>{open ? 'Hide evidence & work notes' : 'View evidence & work notes'}</Text>
    </Pressable>}
    {open && <View style={styles.evidenceBox}>
      {before.length > 0 && <><Text style={styles.metricLabel}>BEFORE WORK</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceThumbs}>{before.map((photo, index) => <Image key={photo.imageId || index} source={{ uri: photo.url }} style={styles.evidenceThumb} />)}</ScrollView></>}
      {after.length > 0 && <><Text style={styles.metricLabel}>AFTER REPAIR</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceThumbs}>{after.map((photo, index) => <Image key={photo.imageId || index} source={{ uri: photo.url }} style={styles.evidenceThumb} />)}</ScrollView></>}
      {!!note && <Text style={styles.muted}>{note}</Text>}
    </View>}
  </View>;
}

function ProfileRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.profileRow, last && styles.profileRowLast]}>
    <Text style={styles.profileLabel}>{label}</Text>
    <Text style={styles.profileValue}>{value}</Text>
  </View>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.errorBanner}>
    <Text style={styles.errorText}>{message}</Text>
    <Pressable onPress={onRetry}><Text style={styles.retryText}>Retry</Text></Pressable>
  </View>;
}

function EmptyCard({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.emptyCard}>
    <Text style={styles.emptyMark}>—</Text>
    <View style={styles.flex}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
    </View>
  </View>;
}

function NavItem({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return <Pressable style={styles.navItem} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
    <Icon name={icon} size={22} color={active ? '#07523e' : '#84928c'} />
    <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f3fc' },
  flex: { flex: 1 },
  header: { height: 55, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8ecea', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 34, height: 34, borderRadius: 18, backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 20 },
  jobsHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  proBadge: { backgroundColor: '#123d31', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  proBadgeText: { color: '#bce6ce', fontSize: 6, fontWeight: '900' },
  jobsTitle: { color: '#193b31', fontSize: 11, fontWeight: '900' },
  jobsSubtitle: { color: '#71817a', fontSize: 7, marginTop: 1 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5, marginBottom: 9 },
  identityIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#e2efe9', alignItems: 'center', justifyContent: 'center' },
  identityGlyph: { color: '#07523e', fontSize: 17 },
  name: { color: '#102d27', fontSize: 14, fontWeight: '900' },
  subheading: { color: '#60746c', fontSize: 10, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  onlinePill: { backgroundColor: '#e6f5ed' },
  offlinePill: { backgroundColor: '#edf0ef' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  onlineDot: { backgroundColor: '#1aa36f' },
  offlineDot: { backgroundColor: '#7c8883' },
  statusPillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
  onlineText: { color: '#126744' },
  offlineText: { color: '#63716c' },
  availabilityCard: { minHeight: 55, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#ebefed' },
  cardTitle: { color: '#123d31', fontSize: 11, fontWeight: '800' },
  muted: { color: '#71817a', fontSize: 9, lineHeight: 14, marginTop: 3 },
  detailsRow: { flexDirection: 'row', gap: 9, marginTop: 9 },
  detailTile: { flex: 1, minHeight: 76, backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#ebefed', paddingHorizontal: 10, paddingVertical: 8 },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailIcon: { color: '#236e53', fontSize: 10 },
  detailLabel: { color: '#6f8179', fontSize: 7, fontWeight: '900', letterSpacing: 0.45 },
  detailValue: { color: '#163d31', fontSize: 13, fontWeight: '900', marginTop: 6 },
  detailNote: { color: '#788780', fontSize: 8, marginTop: 2 },
  sectionTitle: { color: '#213e34', fontSize: 12, fontWeight: '900', marginTop: 13, marginBottom: 7 },
  countText: { color: '#74837d', fontSize: 10, fontWeight: '700' },
  jobFilters: { flexDirection: 'row', gap: 6, backgroundColor: '#e9e9f4', borderRadius: 10, padding: 4, marginTop: 10 },
  jobFilterButton: { flex: 1, minHeight: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  jobFilterButtonSelected: { backgroundColor: '#073c30' },
  jobFilterText: { color: '#64736d', fontSize: 8, fontWeight: '800' },
  jobFilterTextSelected: { color: '#fff' },
  performanceCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ebefed', paddingHorizontal: 8, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, minWidth: 0, paddingHorizontal: 5 },
  metricLabel: { color: '#74847d', fontSize: 7, fontWeight: '800', letterSpacing: 0.2 },
  metricValue: { color: '#07523e', fontSize: 13, fontWeight: '900', marginTop: 5 },
  metricDivider: { width: 1, height: 30, backgroundColor: '#e7ece9' },
  footnote: { color: '#74847d', fontSize: 8, marginTop: 5, textAlign: 'right' },
  incomingCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8eeea', borderRadius: 15, padding: 12, elevation: 1 },
  incomingEyebrow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  incomingEyebrowText: { color: '#16805b', fontSize: 7, fontWeight: '900', letterSpacing: 0.55 },
  incomingStatus: { color: '#21694e', backgroundColor: '#e8f4ee', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '800' },
  jobTitle: { color: '#173a30', fontSize: 14, lineHeight: 19, fontWeight: '900', marginTop: 7 },
  jobCustomer: { color: '#52685f', fontSize: 9, marginTop: 3, lineHeight: 14 },
  jobMetaRow: { gap: 4, marginTop: 9 },
  jobMeta: { color: '#71817a', fontSize: 8, lineHeight: 13 },
  bookingTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e9eeeb', marginTop: 9, paddingTop: 8 },
  bookingTotalLabel: { color: '#74847d', fontSize: 7, fontWeight: '800', letterSpacing: 0.35 },
  bookingTotalValue: { color: '#07523e', fontSize: 14, fontWeight: '900' },
  dispatchActions: { flexDirection: 'row', gap: 7, marginTop: 10 },
  acceptButton: { flex: 1, height: 38, borderRadius: 10, backgroundColor: '#12a878', alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  passButton: { width: 65, height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#d9e3de', alignItems: 'center', justifyContent: 'center' },
  passText: { color: '#52685f', fontSize: 9, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  activeCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8eeea', borderRadius: 14, padding: 12 },
  activeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeEyebrow: { color: '#16805b', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  activeStatus: { backgroundColor: '#e8f4ee', color: '#21694e', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '800' },
  activeTitle: { color: '#173a30', fontSize: 12, fontWeight: '900', marginTop: 7 },
  activeCustomer: { color: '#425c52', fontSize: 9, marginTop: 3 },
  activeMeta: { color: '#76867f', fontSize: 8, lineHeight: 13, marginTop: 4 },
  activeDivider: { height: 1, backgroundColor: '#e9eeeb', marginVertical: 8 },
  activeNext: { color: '#61736b', fontSize: 9, lineHeight: 14 },
  startTravelButton: { height: 36, borderRadius: 9, backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  activeActions: { flexDirection: 'row', gap: 7, marginTop: 8 },
  activeActionButton: { flex: 1, height: 34, borderRadius: 9, backgroundColor: '#e8f2ed', alignItems: 'center', justifyContent: 'center' },
  activeActionText: { color: '#07523e', fontSize: 8, fontWeight: '800' },
  complianceCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#ebefed', padding: 11, marginTop: 12 },
  complianceIcon: { width: 24, height: 24, textAlign: 'center', textAlignVertical: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5f4ec', color: '#146947', fontSize: 13, fontWeight: '900' },
  loadingCard: { minHeight: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 13, marginTop: 12 },
  errorBanner: { backgroundColor: '#fff0ef', borderRadius: 10, padding: 10, marginTop: 10 },
  errorText: { color: '#9b403b', fontSize: 9, lineHeight: 14 },
  retryText: { color: '#07523e', fontSize: 9, fontWeight: '900', marginTop: 7 },
  sectionHeading: { marginTop: 6, marginBottom: 10 },
  pageTitle: { color: '#10372d', fontSize: 20, fontWeight: '900' },
  summaryCard: { backgroundColor: '#073c30', borderRadius: 15, padding: 16 },
  earningsTotal: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 8 },
  twoMetrics: { flexDirection: 'row', gap: 9, marginTop: 9 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebefed', borderRadius: 13, padding: 12 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebefed', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 10, marginBottom: 8 },
  listAmount: { color: '#07523e', fontSize: 11, fontWeight: '900' },
  historyStatus: { alignItems: 'flex-end', gap: 5 },
  historyStatusText: { color: '#536d61', backgroundColor: '#edf4f0', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontSize: 7, fontWeight: '800' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebefed', borderRadius: 13, padding: 12 },
  emptyMark: { color: '#7b9388', fontSize: 20, width: 24, textAlign: 'center' },
  profileCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebefed', borderRadius: 14, paddingHorizontal: 12 },
  profileRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: 1, borderBottomColor: '#eef1ef', paddingVertical: 7 },
  profileRowLast: { borderBottomWidth: 0 },
  profileLabel: { color: '#75847d', fontSize: 9 },
  profileValue: { flex: 1, textAlign: 'right', color: '#193d32', fontSize: 9, fontWeight: '700' },
  secondaryButton: { height: 42, borderRadius: 11, backgroundColor: '#e7f2ec', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#07523e', fontSize: 10, fontWeight: '900' },
  kycProfileCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ebefed', padding: 11, marginTop: 9 },
  kycProfileHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kycIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' },
  kycIconText: { color: '#07523e', fontSize: 13 },
  kycProfileReason: { color: '#9b403b', fontSize: 8, lineHeight: 13, marginTop: 8 },
  kycProfileButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f2f7f4', borderRadius: 9, paddingHorizontal: 10, marginTop: 9 },
  kycProfileButtonText: { color: '#07523e', fontSize: 9, fontWeight: '900' },
  kycProfileArrow: { color: '#07523e', fontSize: 13, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7,31,24,0.58)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  kycPromptCard: { width: '100%', maxWidth: 390, backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
  kycPromptIcon: { width: 48, height: 48, backgroundColor: '#e8f4ee', borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  kycPromptIconText: { color: '#07523e', fontSize: 23 },
  kycPromptTitle: { color: '#122f29', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  kycPromptCopy: { color: '#65776f', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 7, marginBottom: 13 },
  kycPromptPrimary: { width: '100%', height: 43, borderRadius: 11, backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center' },
  kycPromptPrimaryText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  kycPromptSecondary: { paddingVertical: 11 },
  kycPromptSecondaryText: { color: '#667b71', fontSize: 9, fontWeight: '800' },
  countdown: { color: '#7a3d00', backgroundColor: '#fdecc8', fontSize: 11 },
  gpsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff7e6', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, marginTop: 8 },
  gpsText: { color: '#7a4a10', fontSize: 9, fontWeight: '700' },
  gpsLink: { color: '#7a3d00', fontSize: 9, fontWeight: '900', textDecorationLine: 'underline' },
  manageLink: { alignItems: 'center', paddingTop: 9 },
  manageLinkText: { color: '#71817a', fontSize: 9, fontWeight: '800' },
  heroLabel: { color: '#9fd8bf', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)', marginTop: 10, paddingTop: 9 },
  heroNote: { color: '#bfe3d3', fontSize: 10 },
  heroValue: { color: '#fff', fontSize: 11, fontWeight: '900' },
  settlementCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ebefed', padding: 12, marginTop: 9, gap: 4 },
  settlementTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settlementValue: { color: '#193d32', fontSize: 12, fontWeight: '800', marginTop: 4 },
  editLink: { color: '#07523e', fontSize: 11, fontWeight: '900' },
  ledgerCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebefed', borderRadius: 14, padding: 12, marginBottom: 8, gap: 6 },
  ledgerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  ledgerRef: { color: '#e08a1e', fontSize: 9, fontWeight: '900' },
  paidPill: { color: '#126744', backgroundColor: '#e6f5ed', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, fontSize: 8, fontWeight: '800' },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ledgerLabel: { color: '#71817a', fontSize: 10 },
  ledgerValue: { color: '#193d32', fontSize: 10, fontWeight: '800' },
  ledgerDeduction: { color: '#c0562b', fontSize: 10, fontWeight: '800' },
  ledgerNet: { borderTopWidth: 1, borderTopColor: '#e9eeeb', paddingTop: 7 },
  ledgerNetLabel: { color: '#123d31', fontSize: 11, fontWeight: '900' },
  historyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebefed', borderRadius: 14, padding: 12, marginBottom: 8 },
  historyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statusDone: { color: '#126744', backgroundColor: '#e6f5ed' },
  statusOther: { color: '#63716c', backgroundColor: '#edf0ef' },
  evidenceButton: { height: 36, borderRadius: 10, backgroundColor: '#f1f8f4', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  evidenceButtonText: { color: '#07523e', fontSize: 10, fontWeight: '900' },
  evidenceBox: { marginTop: 9, gap: 6 },
  evidenceThumbs: { gap: 7 },
  evidenceThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#e6ece9' },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ebefed', padding: 12, marginBottom: 9 },
  profilePhoto: { width: 62, height: 62, borderRadius: 16 },
  profilePhotoFallback: { backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center' },
  editButton: { height: 44, borderRadius: 12, backgroundColor: '#07523e', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  editButtonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  tagsCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ebefed', padding: 12, marginTop: 9, gap: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { color: '#3f5a50', backgroundColor: '#edf4f0', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  toolRow: { color: '#33463f', fontSize: 10, fontWeight: '700', lineHeight: 16 },
  notice: { borderRadius: 13, borderWidth: 1, padding: 12, marginTop: 10 },
  noticeWarn: { backgroundColor: '#fff7e6', borderColor: '#f3d9a4' },
  noticeDanger: { backgroundColor: '#fff0ef', borderColor: '#f0c4c0' },
  noticeInfo: { backgroundColor: '#eef4ff', borderColor: '#cddcf7' },
  noticeTitle: { color: '#5a3a08', fontSize: 11, fontWeight: '900' },
  noticeTitleDanger: { color: '#8c2a22' },
  noticeText: { color: '#5f6b66', fontSize: 10, lineHeight: 15, marginTop: 4 },
  noticeButton: { alignSelf: 'flex-start', backgroundColor: '#07523e', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, marginTop: 9 },
  noticeButtonDanger: { backgroundColor: '#c0392b' },
  noticeButtonText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  signOutButton: { height: 42, borderRadius: 11, borderWidth: 1, borderColor: '#e6c6c2', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  signOutText: { color: '#b3261e', fontSize: 10, fontWeight: '900' },
  footer: { color: '#89958f', fontSize: 8, textAlign: 'center', marginTop: 18, marginBottom: 4 },
  bottomNav: { minHeight: 62, flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e7ece9', paddingHorizontal: 5, paddingTop: 5 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingBottom: 4 },
  navIcon: { color: '#84928c', fontSize: 14, fontWeight: '700' },
  navLabel: { color: '#84928c', fontSize: 11, fontWeight: '700' },
  navActive: { color: '#07523e', fontWeight: '900' },
});
