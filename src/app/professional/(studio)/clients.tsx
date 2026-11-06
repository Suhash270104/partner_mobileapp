import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { router } from 'expo-router';
import { partnerApi, StudioAvailableLead, StudioLead } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { useStudio } from '../../../components/studio/StudioContext';
import { LeadProject, PlansSheet, ProposalContext, ProposalSheet, RefundSheet, UnlockSheet } from '../../../components/studio/leadSheets';

type Tab = 'unlocked' | 'available' | 'refunded';

const orNone = (value: unknown) => (value === null || value === undefined || value === '' ? 'Not provided' : String(value));

function leadStatus(lead: StudioLead) {
  if (lead.isAwarded || lead.proposalStatus === 'Awarded' || lead.proposalStatus === 'Won') return { label: 'Awarded', bg: c.mint, fg: c.greenText };
  if (lead.proposalStatus === 'Not Selected') return { label: 'Not Selected', bg: c.redSoft, fg: c.red };
  if (lead.hasSubmittedProposal || lead.proposalStatus === 'Submitted') return { label: 'Proposal Sent', bg: c.amberSoft, fg: c.amber };
  return { label: 'New', bg: '#eef1ef', fg: c.body };
}

function refundBadge(refund?: StudioLead['refund']) {
  if (!refund?.status) return null;
  if (refund.status === 'REQUESTED') return { label: 'Refund under review', bg: c.amberSoft, fg: c.amber };
  if (refund.status === 'APPROVED') return { label: 'Refunded', bg: '#e6eefc', fg: '#2c5fb3' };
  return { label: 'Refund declined', bg: c.redSoft, fg: c.red };
}

function leadSource(lead: StudioLead) {
  const origin = lead.origin === 'CLIENT_SHORTLIST' ? 'The client shortlisted your studio' : 'You found it on Find Projects';
  let payment: string | null = null;
  if (lead.unlockMethod === 'PAYMENT') payment = typeof lead.amountPaid === 'number' ? `Paid ₹${lead.amountPaid}` : 'Paid once';
  else if (lead.unlockMethod === 'CREDIT') payment = lead.creditWallet === 'BONUS' ? '1 free credit' : '1 plan credit';
  return { origin, payment };
}

export default function ClientsScreen() {
  const { profile } = useStudio();
  const [leads, setLeads] = useState<StudioLead[]>([]);
  const [available, setAvailable] = useState<StudioAvailableLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>('unlocked');
  const [expanded, setExpanded] = useState('');
  const [credits, setCredits] = useState<number | null>(typeof profile.leadCredits === 'number' ? profile.leadCredits : null);
  const [bonus, setBonus] = useState<number | null>(typeof profile.bonusLeadCredits === 'number' ? profile.bonusLeadCredits : null);
  const [openingChat, setOpeningChat] = useState('');
  const [unlockTarget, setUnlockTarget] = useState<LeadProject | null>(null);
  const [proposalTarget, setProposalTarget] = useState<ProposalContext | null>(null);
  const [refundTarget, setRefundTarget] = useState<StudioLead | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const flash = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadAll = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    const [leadResult, availableResult, profileResult] = await Promise.allSettled([
      partnerApi.studioLeads(),
      partnerApi.studioAvailableLeads(),
      partnerApi.professionalProfile(),
    ]);
    if (leadResult.status === 'fulfilled') {
      if (Array.isArray(leadResult.value)) setLeads(leadResult.value);
      else setError('Invalid leads response');
    } else {
      setLeads([]);
      setError(leadResult.reason instanceof Error ? leadResult.reason.message : 'Unable to load your leads.');
    }
    setAvailable(availableResult.status === 'fulfilled' && Array.isArray(availableResult.value) ? availableResult.value : []);
    if (profileResult.status === 'fulfilled') {
      const record = profileResult.value as { leadCredits?: number; bonusLeadCredits?: number };
      if (typeof record.leadCredits === 'number') setCredits(record.leadCredits);
      if (typeof record.bonusLeadCredits === 'number') setBonus(record.bonusLeadCredits);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadAll(); }, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const active = leads.filter(lead => lead.status !== 'refunded');
  const refunded = leads.filter(lead => lead.status === 'refunded');
  const projectLeads = active.filter(lead => lead.project && (lead.project.title || lead.project.propertyType || lead.project.id || lead.project._id));
  const now = new Date();
  const unlockedThisMonth = active.filter(lead => {
    if (!lead.unlockedAt) return false;
    const date = new Date(lead.unlockedAt);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const awarded = active.filter(lead => lead.isAwarded || lead.proposalStatus === 'Awarded' || lead.proposalStatus === 'Won').length;
  const conversion = active.length > 0 ? Math.round((awarded / active.length) * 100) : 0;

  const creditsLine = credits === null
    ? 'Only clients who unlocked your profile are shown here.'
    : bonus === null ? `${credits} lead credits remaining` : `${bonus} of 2 free welcome unlocks left · ${Math.max(0, credits - bonus)} plan credits`;

  async function openChat(lead: StudioLead) {
    const key = String(lead.id || lead._id);
    setOpeningChat(key);
    try {
      let roomId = lead.roomId;
      if (!roomId) {
        const result = await partnerApi.openProfessionalChatRoom(String(lead.projectId));
        roomId = result.room?.roomId;
      }
      router.navigate({ pathname: '/professional/messages', params: roomId ? { room: roomId } : {} } as never);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not open the conversation. Please try again.', true);
    } finally {
      setOpeningChat('');
    }
  }

  function proposalFor(lead: StudioLead): ProposalContext {
    return {
      projectId: String(lead.projectId || lead.project?._id || lead.project?.id || ''),
      clientName: lead.customer?.name,
      projectTitle: lead.project?.title,
      location: lead.project?.location,
      budget: lead.project?.budgetRange,
      timeline: lead.project?.timeline,
    };
  }

  const tabs: [Tab, string][] = [['unlocked', `Unlocked (${projectLeads.length})`], ['available', `New Leads (${available.length})`], ['refunded', `Refunded (${refunded.length})`]];

  return (
    <View style={s.flex}>
      <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll(true)} tintColor={c.green} />}>
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Clients & Leads</Text>
          </View>
          <Pressable style={s.buy} onPress={() => setPlansOpen(true)}><Text style={s.buyText}>＋ Buy Credits</Text></Pressable>
        </View>

        <View style={s.creditCard}>
          <View style={s.creditIcon}><Text style={s.creditGlyph}>⚡</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.creditValue}>{credits === null ? '—' : credits} Credits Left</Text>
            <Text style={s.creditSub}>{creditsLine}</Text>
          </View>
        </View>

        {!!toast && <View style={[s.toast, toast.bad && s.toastBad]}><Text style={s.toastText}>{toast.text}</Text></View>}

        <View style={s.tiles}>
          {[
            { label: 'Unlocked This Month', value: String(unlockedThisMonth), tint: c.greenSoft },
            { label: 'Free Unlocks Left', value: bonus === null ? '—' : String(bonus), tint: '#fbf1e4' },
            { label: 'Conversion Rate', value: `${conversion}%`, tint: '#e9f1fb' },
          ].map(tile => (
            <View key={tile.label} style={[s.tile, { backgroundColor: tile.tint }]}>
              <Text style={s.tileValue}>{tile.value}</Text>
              <Text style={s.tileLabel}>{tile.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {tabs.map(([id, label]) => (
            <Pressable key={id} style={[s.tab, tab === id && s.tabOn]} onPress={() => setTab(id)}>
              <Text style={[s.tabText, tab === id && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading && <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />}
        {!loading && !!error && (
          <View style={s.emptyCard}>
            <ErrorText>{error}</ErrorText>
            <Pressable style={s.retry} onPress={() => { setLoading(true); void loadAll(); }}><Text style={s.retryText}>Try again</Text></Pressable>
          </View>
        )}

        {!loading && !error && tab === 'unlocked' && (projectLeads.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No active unlocked leads</Text>
            <Text style={s.emptyCopy}>When clients unlock your profile or request proposals for their projects, they will appear here.</Text>
          </View>
        ) : projectLeads.map(lead => {
          const project = lead.project || {};
          const customer = lead.customer || {};
          const key = String(lead.id || lead._id);
          const open = expanded === key;
          const status = leadStatus(lead);
          const refund = refundBadge(lead.refund);
          const badge = refund || status;
          const source = leadSource(lead);
          const initials = (customer.name || project.title || 'CL').trim().slice(0, 2).toUpperCase();
          const isAwarded = lead.isAwarded || lead.proposalStatus === 'Awarded' || lead.proposalStatus === 'Won';
          return (
            <View key={key} style={s.lead}>
              <Pressable style={s.leadHead} onPress={() => setExpanded(open ? '' : key)}>
                <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.leadName} numberOfLines={1}>{customer.name || 'Verified Client'}</Text>
                  <Text style={s.leadProject} numberOfLines={1}>{project.title || 'Interior Project'}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: badge.bg }]}><Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text></View>
                <Text style={s.chevron}>{open ? '⌄' : '›'}</Text>
              </Pressable>
              <View style={s.metaRow}>
                <Text style={s.meta} numberOfLines={1}>{project.location || project.city || '—'}</Text>
                <Text style={s.metaStrong} numberOfLines={1}>{project.budgetRange || '—'}</Text>
                <Text style={s.meta}>{lead.unlockedAt ? new Date(lead.unlockedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</Text>
              </View>

              {open && (
                <View style={s.detail}>
                  <View style={s.grid}>
                    {[['Property Type', project.propertyType], ['Timeline', project.timeline], ['Scope', project.serviceType || 'Full Interior'], ['Client Budget', project.budgetRange]].map(([label, value]) => (
                      <View key={label as string} style={s.gridCell}><Text style={s.gridLabel}>{label}</Text><Text style={s.gridValue}>{orNone(value)}</Text></View>
                    ))}
                  </View>
                  <View style={s.grid}>
                    <View style={s.gridCell}><Text style={s.gridLabel}>Lead source</Text><Text style={s.gridValue}>{source.origin}</Text></View>
                    <View style={s.gridCell}><Text style={s.gridLabel}>Unlocked with</Text><Text style={s.gridValue}>{source.payment || 'Not recorded'}</Text></View>
                  </View>

                  {!!lead.refund && (
                    <View style={[s.refundBox, lead.refund.status === 'REJECTED' && { backgroundColor: c.redSoft }]}>
                      <Text style={s.refundTitle}>{lead.refund.status === 'REQUESTED' ? 'Refund request under review' : 'Refund declined'}</Text>
                      <Text style={s.emptyCopy}>Reason: {lead.refund.reasonLabel}</Text>
                      {!!lead.refund.adminNote && <Text style={s.emptyCopy}>KraftNex: {lead.refund.adminNote}</Text>}
                    </View>
                  )}

                  <View style={s.contact}>
                    <Text style={s.contactTitle}>UNLOCKED CLIENT CONTACT</Text>
                    <Text style={s.contactLine}>Name: {orNone(customer.name)}</Text>
                    <Text style={s.contactLine}>Email: {orNone(customer.email)}</Text>
                    <Text style={s.contactLine}>Phone: {orNone(customer.phone)}</Text>
                    <Text style={s.contactLine}>Unlocked: {lead.unlockedAt ? new Date(lead.unlockedAt).toLocaleDateString() : 'Active'}</Text>
                  </View>

                  <View style={s.actions}>
                    <Pressable style={[s.action, s.actionSolid]} disabled={openingChat === key} onPress={() => void openChat(lead)}>
                      {openingChat === key ? <ActivityIndicator color="#fff" /> : <Text style={s.actionSolidText}>{lead.roomId ? 'Open Chat' : 'Message Client'}</Text>}
                    </Pressable>
                    {isAwarded ? (
                      <View style={[s.action, s.actionSolid]}><Text style={s.actionSolidText}>Accepted / Awarded</Text></View>
                    ) : lead.proposalStatus === 'Not Selected' ? (
                      <View style={[s.action, { backgroundColor: c.redSoft }]}><Text style={[s.actionSolidText, { color: c.red }]}>Not Selected</Text></View>
                    ) : lead.hasSubmittedProposal || lead.proposalStatus === 'Submitted' ? (
                      <View style={[s.action, { backgroundColor: c.amberSoft }]}><Text style={[s.actionSolidText, { color: c.amber }]}>Waiting to Accept</Text></View>
                    ) : (
                      <Pressable style={[s.action, s.actionSolid]} onPress={() => setProposalTarget(proposalFor(lead))}><Text style={s.actionSolidText}>Send Proposal</Text></Pressable>
                    )}
                  </View>

                  {!lead.refund && !lead.isAwarded && (
                    <Pressable onPress={() => setRefundTarget(lead)}><Text style={s.refundLink}>Problem with this lead? Request a refund</Text></Pressable>
                  )}
                </View>
              )}
            </View>
          );
        }))}

        {!loading && !error && tab === 'available' && (available.length === 0 ? (
          <View style={s.emptyCard}><Text style={s.emptyTitle}>No new leads right now</Text><Text style={s.emptyCopy}>New client projects that match your studio will appear here to unlock.</Text></View>
        ) : available.map(project => {
          const meta = [project.location || project.city, project.budgetRange, project.propertyType, project.timeline].filter(Boolean).join(' · ');
          return (
            <View key={project.id} style={s.lockedCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.lockedTitle} numberOfLines={1}>{project.title || 'Interior Design Project'}</Text>
                <Text style={s.emptyCopy} numberOfLines={2}>{meta || 'Details unlock instantly'}</Text>
              </View>
              <Pressable style={s.unlock} onPress={() => setUnlockTarget({ id: String(project.id), title: project.title, location: project.location || project.city, budgetRange: project.budgetRange, areaSqFt: project.areaSqFt, timeline: project.timeline, proposalsReceived: project.proposalsReceived, maxProposals: project.maxProposals })}>
                <Text style={s.unlockText}>🔒 Unlock · {credits && credits >= 1 ? '1 credit' : 'pay once'}</Text>
              </Pressable>
            </View>
          );
        }))}

        {!loading && !error && tab === 'refunded' && (refunded.length === 0 ? (
          <View style={s.emptyCard}><Text style={s.emptyTitle}>No refunded leads</Text><Text style={s.emptyCopy}>Approved refund requests show up here.</Text></View>
        ) : refunded.map(lead => (
          <View key={String(lead.id)} style={s.lead}>
            <View style={s.leadHead}>
              <Text style={[s.leadName, { flex: 1 }]} numberOfLines={1}>{lead.project?.title || 'Interior project'}</Text>
              <View style={[s.badge, { backgroundColor: '#e6eefc' }]}><Text style={[s.badgeText, { color: '#2c5fb3' }]}>Refunded</Text></View>
            </View>
            <Text style={[s.emptyCopy, { paddingHorizontal: 14, paddingBottom: 12 }]}>
              {lead.refund?.creditReturned ? '1 lead credit returned to your account' : 'Payment refunded to your original payment method'}
              {lead.refund?.reviewedAt ? ` · ${new Date(lead.refund.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
              {lead.refund?.adminNote ? `\nKraftNex: ${lead.refund.adminNote}` : ''}
            </Text>
          </View>
        )))}
      </ScrollView>

      <UnlockSheet
        project={unlockTarget}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={({ projectId, leadCredits, bonusLeadCredits }) => {
          if (typeof leadCredits === 'number') setCredits(leadCredits);
          if (typeof bonusLeadCredits === 'number') setBonus(bonusLeadCredits);
          setAvailable(previous => previous.filter(item => String(item.id) !== projectId));
          void loadAll();
        }}
        onSubmitProposal={project => {
          setUnlockTarget(null);
          setProposalTarget({ projectId: project.id, projectTitle: project.title, location: project.location, budget: project.budgetRange, timeline: project.timeline });
        }}
      />
      <ProposalSheet context={proposalTarget} onClose={() => { setProposalTarget(null); void loadAll(); }} />
      <RefundSheet
        target={refundTarget ? { projectId: String(refundTarget.projectId || ''), projectTitle: refundTarget.project?.title, unlockMethod: refundTarget.unlockMethod, amountPaid: refundTarget.amountPaid } : null}
        onClose={() => setRefundTarget(null)}
        onRequested={() => { setRefundTarget(null); flash('Refund request sent. You will see the decision on this page.'); void loadAll(); }}
      />
      <PlansSheet visible={plansOpen} onClose={() => setPlansOpen(false)} onPurchased={() => { partnerApi.professionalProfile().then(record => { if (typeof record.leadCredits === 'number') setCredits(record.leadCredits); }, () => undefined); }} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  buy: { backgroundColor: c.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  buyText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  creditCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.greenSoft, borderRadius: 16, borderWidth: 1, borderColor: '#bfe0cf', padding: 14, marginTop: 14 },
  creditIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  creditGlyph: { color: '#fff', fontSize: 18 },
  creditValue: { color: c.ink, fontSize: 18, fontWeight: '800' },
  creditSub: { color: c.body, fontSize: 12, marginTop: 1 },
  toast: { backgroundColor: c.green, borderRadius: 14, padding: 12, marginTop: 12 },
  toastBad: { backgroundColor: '#7a3434' },
  toastText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tile: { flex: 1, borderRadius: 14, padding: 12, minHeight: 84, justifyContent: 'space-between' },
  tileValue: { color: c.ink, fontSize: 26, fontWeight: '800' },
  tileLabel: { color: c.body, fontSize: 11, fontWeight: '700' },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 22, alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  retry: { marginTop: 8, height: 42, paddingHorizontal: 22, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  lead: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, marginBottom: 12, overflow: 'hidden' },
  leadHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.green, fontSize: 13, fontWeight: '800' },
  leadName: { color: c.ink, fontSize: 15, fontWeight: '800' },
  leadProject: { color: c.muted, fontSize: 12, marginTop: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },
  chevron: { color: c.muted, fontSize: 18 },
  metaRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  meta: { flex: 1, color: c.body, fontSize: 12 },
  metaStrong: { flex: 1, color: c.ink, fontSize: 12, fontWeight: '800' },
  detail: { padding: 14, gap: 12, backgroundColor: '#f6f8f7', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  gridCell: { width: '47%' },
  gridLabel: { color: c.muted, fontSize: 11, fontWeight: '600' },
  gridValue: { color: c.ink, fontSize: 13, fontWeight: '800', marginTop: 1 },
  refundBox: { backgroundColor: c.amberSoft, borderRadius: 14, padding: 12, gap: 2 },
  refundTitle: { color: c.ink, fontSize: 13, fontWeight: '800' },
  contact: { backgroundColor: c.greenSoft, borderRadius: 14, borderWidth: 1, borderColor: '#bfe0cf', padding: 12, gap: 4 },
  contactTitle: { color: c.greenText, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, marginBottom: 2 },
  contactLine: { color: c.body, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  actionSolid: { backgroundColor: c.green },
  actionSolidText: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  refundLink: { color: c.muted, fontSize: 12, fontWeight: '700' },
  lockedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 10 },
  lockedTitle: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  unlock: { borderRadius: 12, borderWidth: 1.5, borderColor: c.green, paddingHorizontal: 12, paddingVertical: 10 },
  unlockText: { color: c.green, fontSize: 12, fontWeight: '800' },
});
