import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { partnerApi, StudioProjectDetail } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';
import { ProposalContext, ProposalSheet, UnlockSheet } from '../../../components/studio/leadSheets';

interface QA { _id?: string; q: string; a?: string }
interface Attachment { name: string; url?: string; size?: string }
interface Detail extends StudioProjectDetail {
  isOwner?: boolean;
  isLeadUnlocked?: boolean;
  clientPhone?: string;
  clientEmail?: string;
  exactAddress?: string;
  landmark?: string;
  coordinates?: { lat?: number; lng?: number };
  cityDetails?: { lat?: number; lng?: number };
  complexity?: string;
  executionType?: string;
  style?: string;
  keySpaces?: string[];
  projectStory?: string;
  requirements?: string;
  budgetMin?: number;
  budgetMax?: number;
  siteInfo?: Record<string, unknown>;
  requiredServices?: string[];
  deliverables?: string[];
  attachments?: Attachment[];
  clientPriorities?: string[];
  timelinePhases?: { step: string; duration: string }[];
  slotsAvailable?: number;
  qaList?: QA[];
  clientReputation?: { averageRating?: number; projectsCompleted?: number; avgResponseTime?: string; paymentSuccessPct?: number };
  kaiFitReport?: Record<string, number | string | undefined> & { recommendationText?: string };
}

const humanize = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, ch => ch.toUpperCase());
const digits = (value: string) => value.replace(/\D/g, '');
const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const FIT: [string, string][] = [['overallMatch', 'Overall Fit'], ['portfolioFit', 'Portfolio Fit'], ['budgetFit', 'Budget Fit'], ['experienceFit', 'Experience Fit'], ['timelineFit', 'Timeline Fit'], ['complexityFit', 'Complexity Fit']];

function Section({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}><Text style={s.cardTitle}>{title}</Text>{!!tag && <Text style={s.cardTag}>{tag}</Text>}</View>
      {children}
    </View>
  );
}

const Sub = ({ children }: { children: string }) => <Text style={s.sub}>{children.toUpperCase()}</Text>;

export default function ProjectDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qa, setQa] = useState<QA[]>([]);
  const [question, setQuestion] = useState('');
  const [qaError, setQaError] = useState('');
  const [posting, setPosting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answering, setAnswering] = useState('');
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [proposalTarget, setProposalTarget] = useState<ProposalContext | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const result = await partnerApi.call<Detail>(`/client-projects/${encodeURIComponent(String(id))}`);
      setProject(result);
      setQa(Array.isArray(result.qaList) ? result.qaList : []);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load this project.'));
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (!project) {
    return (
      <View style={[s.flex, s.center]}>
        {error ? <><ErrorText>{error}</ErrorText><Pressable onPress={() => router.navigate('/professional/find-projects' as never)}><Text style={s.link}>Explore Projects</Text></Pressable></> : <ActivityIndicator color={c.green} />}
      </View>
    );
  }

  const realId = String(project.id || project._id || id);
  const isOwner = Boolean(project.isOwner);
  const unlocked = Boolean(project.isLeadUnlocked);
  const photos = Array.from(new Set([project.galleryImages?.main, project.previewThumbnail, ...(project.galleryImages?.others || [])].filter(Boolean) as string[])).filter(url => !failed.has(url));
  const place = project.location || [project.locality, project.city].filter(Boolean).join(', ');
  const lat = typeof project.coordinates?.lat === 'number' ? project.coordinates.lat : typeof project.cityDetails?.lat === 'number' ? project.cityDetails.lat : null;
  const lng = typeof project.coordinates?.lng === 'number' ? project.coordinates.lng : typeof project.cityDetails?.lng === 'number' ? project.cityDetails.lng : null;
  const chips = [project.serviceType, project.propertyType, project.complexity, project.executionType, project.style, ...(project.tags || []), ...(project.keySpaces || [])].filter(Boolean) as string[];
  const siteInfo = Object.entries(project.siteInfo || {}).filter(([, value]) => Boolean(value));
  const description = project.description || project.requirements || '';
  const longDescription = description.length > 280;
  const maxSlots = typeof project.maxProposals === 'number' ? project.maxProposals : null;
  const received = typeof project.proposalsReceived === 'number' ? project.proposalsReceived : 0;
  const remaining = typeof project.slotsAvailable === 'number' ? project.slotsAvailable : maxSlots !== null ? Math.max(0, maxSlots - received) : null;
  const rep = project.clientReputation;
  const fit = project.kaiFitReport;
  const budget = project.budgetRange || (project.budgetMin && project.budgetMax ? `₹${project.budgetMin.toLocaleString('en-IN')} - ₹${project.budgetMax.toLocaleString('en-IN')}` : '');
  const siteBase = process.env.EXPO_PUBLIC_PARTNER_SITE_URL;

  const metrics: [string, string][] = [
    ['TARGET BUDGET', budget], ['BUILT-UP AREA', project.areaSqFt ? `${project.areaSqFt} sq.ft` : ''],
    ['TARGET TIMELINE', project.timeline || ''], ['EXECUTION STYLE', project.style || project.executionType || project.propertyType || ''],
  ];

  async function share() {
    if (!siteBase) return;
    try { await Share.share({ message: `Check out this project requirement on KraftNex: ${project?.title || ''}\n${siteBase}/projects/details?id=${realId}` }); } catch { /* share sheet dismissed */ }
  }

  async function copyCoords() {
    if (lat === null || lng === null) return;
    await Clipboard.setStringAsync(`${lat}, ${lng}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function postQuestion() {
    if (!question.trim()) return;
    setPosting(true);
    setQaError('');
    try {
      const res = await partnerApi.call<{ qaList?: QA[] }>(`/client-projects/${realId}/questions`, 'POST', { q: question.trim() });
      if (Array.isArray(res?.qaList)) setQa(res.qaList);
      setQuestion('');
    } catch (e) {
      setQaError(errorMessage(e, 'Unable to submit your question. Please try again.'));
    } finally {
      setPosting(false);
    }
  }

  async function answer(questionId: string) {
    const text = (drafts[questionId] || '').trim();
    if (!text) return;
    setAnswering(questionId);
    setQaError('');
    try {
      const res = await partnerApi.call<{ qaList?: QA[] }>(`/client-projects/${realId}/questions/${questionId}`, 'PUT', { a: text });
      if (Array.isArray(res?.qaList)) setQa(res.qaList);
      setDrafts(previous => ({ ...previous, [questionId]: '' }));
    } catch (e) {
      setQaError(errorMessage(e, 'Unable to submit your answer. Please try again.'));
    } finally {
      setAnswering('');
    }
  }

  const proposalContext: ProposalContext = { projectId: realId, clientName: project.clientName, projectTitle: project.title, location: project.city || project.location, budget: project.budgetRange, timeline: project.timeline };

  return (
    <View style={s.flex}>
      <ScrollView style={s.flex} contentContainerStyle={s.content}>
        <View style={s.topRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate('/professional/find-projects' as never))}><Text style={s.back}>← Back</Text></Pressable>
          {!!siteBase && <Pressable onPress={() => void share()}><Text style={s.link}>Share ↗</Text></Pressable>}
        </View>

        {photos.length > 0 && (
          <Pressable onPress={() => setLightbox(true)} style={s.hero}>
            <Image source={{ uri: photos[Math.min(photo, photos.length - 1)] }} style={s.heroImage} onError={() => setFailed(previous => new Set(previous).add(photos[Math.min(photo, photos.length - 1)]))} />
            <View style={s.heroBadges}>
              <Text style={s.status}>● {project.status || 'Open'}</Text>
              {!!project.membershipLevel && <Text style={s.tier}>{project.membershipLevel} Tier</Text>}
            </View>
            <Text style={s.count}>{Math.min(photo, photos.length - 1) + 1} / {photos.length} Photos</Text>
          </Pressable>
        )}
        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
            {photos.map((uri, index) => (
              <Pressable key={uri} onPress={() => setPhoto(index)}><Image source={{ uri }} style={[s.thumb, index === photo && s.thumbOn]} /></Pressable>
            ))}
          </ScrollView>
        )}

        <View style={s.card}>
          <View style={s.chipRow}>
            <Text style={s.verified}>✓ Verified Requirement</Text>
            {!!project.serviceType && <Text style={s.service}>{project.serviceType}</Text>}
            {photos.length === 0 && !!project.status && <Text style={s.service}>{project.status}</Text>}
          </View>
          <Text style={s.title}>{project.title}</Text>
          <View style={s.locRow}>
            <Text style={s.loc} numberOfLines={1}>📍 {place}</Text>
            {!!project.createdAt && <Text style={s.date}>{new Date(project.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>}
          </View>
        </View>

        <View style={s.metrics}>
          {metrics.filter(([, value]) => value).map(([label, value]) => (
            <View key={label} style={s.metric}><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue} numberOfLines={2}>{value}</Text></View>
          ))}
        </View>

        <Section title="What is the Project" tag="Project Brief">
          {description ? (
            <>
              <Text style={s.body} numberOfLines={expanded || !longDescription ? undefined : 4}>{description}</Text>
              {longDescription && <Pressable onPress={() => setExpanded(value => !value)}><Text style={s.link}>{expanded ? 'Read Less' : 'Read Full Description'}</Text></Pressable>}
            </>
          ) : null}
          {!!project.projectStory && <Text style={s.story}>&ldquo;{project.projectStory}&rdquo;</Text>}
          {chips.length > 0 && (<><Sub>Target Scope & Tags</Sub><View style={s.chipRow}>{chips.map((chip, index) => <Text key={`${chip}${index}`} style={s.chip}>{chip}</Text>)}</View></>)}
          {siteInfo.length > 0 && (
            <>
              <Sub>Site & Engineering Specifications</Sub>
              <View style={s.grid}>{siteInfo.map(([key, value]) => (
                <View key={key} style={s.spec}><Text style={s.metricLabel}>{humanize(key).toUpperCase()}</Text><Text style={s.specValue} numberOfLines={2}>{String(value)}</Text></View>
              ))}</View>
            </>
          )}
          {lat !== null && lng !== null && (
            <>
              <View style={s.rowBetween}>
                <Sub>Site Location</Sub>
                <Pressable onPress={() => void copyCoords()}><Text style={s.link}>{copied ? 'Copied' : `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`}</Text></Pressable>
              </View>
              {!!project.exactAddress && <Text style={s.body}>{project.exactAddress}</Text>}
              {!!project.landmark && <Text style={s.landmark}>📍 Landmark: {project.landmark}</Text>}
              <Pressable style={s.ghost} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)}><Text style={s.ghostText}>Open in Google Maps</Text></Pressable>
            </>
          )}
          {!!project.attachments?.length && (
            <>
              <Sub>{`Blueprints & Project Drawings (${project.attachments.length})`}</Sub>
              {project.attachments.map((doc, index) => (
                <Pressable key={`${doc.name}${index}`} style={s.attach} disabled={!doc.url} onPress={() => doc.url && void Linking.openURL(doc.url)}>
                  <Text style={s.attachName} numberOfLines={1}>📄 {doc.name}</Text>
                  {!!doc.size && <Text style={s.metricLabel}>{doc.size}</Text>}
                </Pressable>
              ))}
            </>
          )}
        </Section>

        <Section title="What are the Requirements" tag="Confirmed Scope">
          {project.requiredServices?.length ? (
            <>
              <Sub>Required Services & Trades</Sub>
              {project.requiredServices.map((service, index) => <Text key={`${service}${index}`} style={s.good}>✓  {service}</Text>)}
            </>
          ) : null}
          {!!project.deliverables?.length && (<><Sub>Key Project Deliverables</Sub>{project.deliverables.map((item, index) => <Text key={`${item}${index}`} style={s.line}>✓  {item}</Text>)}</>)}
          {!!project.timelinePhases?.length && (
            <>
              <Sub>Execution Phases</Sub>
              {project.timelinePhases.map((phase, index) => <View key={`${phase.step}${index}`} style={s.attach}><Text style={s.attachName}>{phase.step}</Text><Text style={s.metricLabel}>{phase.duration}</Text></View>)}
            </>
          )}
          {!!project.clientPriorities?.length && (<><Sub>Client Priorities</Sub><View style={s.chipRow}>{project.clientPriorities.map((item, index) => <Text key={`${item}${index}`} style={s.priority}>★ {item}</Text>)}</View></>)}
          <View style={s.slot}>
            <View style={{ flex: 1 }}>
              <Text style={s.slotTitle}>{remaining !== null ? `${remaining} Slots Remaining` : 'Accepting Proposals'}</Text>
              <Text style={s.metricLabel}>{received} proposals submitted{maxSlots !== null ? ` (max ${maxSlots})` : ''}</Text>
            </View>
            <Text style={s.activeSlot}>Active Slot</Text>
          </View>
        </Section>

        <Section title="Who are the Market Clients" tag="Verified Client">
          <View style={s.client}>
            <View style={s.avatar}><Text style={s.avatarText}>{isOwner ? 'You' : (project.clientName || '?').charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName} numberOfLines={1}>{isOwner ? 'You (Project Owner)' : project.clientName || 'Client'}</Text>
              <Text style={s.metricLabel} numberOfLines={1}>{[project.locality, project.city].filter(Boolean).join(', ')}</Text>
            </View>
          </View>
          {rep && (
            <View style={s.grid}>
              {rep.averageRating != null && <View style={s.rep}><Text style={s.repValue}>★ {Number(rep.averageRating).toFixed(1)}</Text><Text style={s.metricLabel}>CLIENT RATING</Text></View>}
              {rep.projectsCompleted != null && <View style={s.rep}><Text style={s.repValue}>{rep.projectsCompleted}</Text><Text style={s.metricLabel}>COMPLETED</Text></View>}
              {!!rep.avgResponseTime && <View style={s.rep}><Text style={s.repValue}>{rep.avgResponseTime}</Text><Text style={s.metricLabel}>RESPONSE TIME</Text></View>}
              {rep.paymentSuccessPct != null && <View style={s.rep}><Text style={[s.repValue, { color: c.greenText }]}>{rep.paymentSuccessPct}%</Text><Text style={s.metricLabel}>PAYMENT SUCCESS</Text></View>}
            </View>
          )}

          <Sub>Direct Contact Access</Sub>
          {unlocked || isOwner ? (
            <>
              <View style={s.unlocked}>
                <Text style={s.unlockedTitle}>🔓 Direct Contact Verified & Unlocked</Text>
                {!!project.clientPhone && <Text style={s.contact}>📞 {project.clientPhone}</Text>}
                {!!project.clientEmail && <Text style={s.contact} numberOfLines={1}>✉ {project.clientEmail}</Text>}
              </View>
              {!isOwner && !!project.clientPhone && (
                <View style={s.actions}>
                  <Pressable style={s.solid} onPress={() => void Linking.openURL(`tel:${digits(project.clientPhone || '')}`)}><Text style={s.solidText}>Call Client</Text></Pressable>
                  <Pressable style={[s.solid, { backgroundColor: '#25d366' }]} onPress={() => void Linking.openURL(`https://wa.me/${digits(project.clientPhone || '')}`)}><Text style={s.solidText}>WhatsApp</Text></Pressable>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={s.attach}><Text style={s.metricLabel}>Phone</Text><Text style={s.attachName}>{project.clientPhone || '+91 •••••••••• (Locked)'}</Text></View>
              <View style={s.attach}><Text style={s.metricLabel}>Email</Text><Text style={s.attachName}>{project.clientEmail || '••••••@••••••.com (Locked)'}</Text></View>
              <Pressable style={s.cta} onPress={() => setUnlockOpen(true)}><Text style={s.solidText}>🔒 Unlock Direct Contact</Text></Pressable>
              <Text style={s.line}>🛡 100% Genuine & Phone Verified Client Lead</Text>
              <Text style={s.line}>✓ Instant access to direct phone, WhatsApp & email</Text>
            </>
          )}
        </Section>

        {fit && FIT.some(([key]) => fit[key] != null) && (
          <Section title="KAI AI Suitability Fit" tag="KAI Engine">
            {!!fit.recommendationText && <Text style={s.recommend}>{fit.recommendationText}</Text>}
            <View style={s.grid}>
              {FIT.filter(([key]) => fit[key] != null).map(([key, label]) => (
                <View key={key} style={s.rep}><Text style={[s.repValue, { color: c.greenText }]}>{String(fit[key])}%</Text><Text style={s.metricLabel}>{label.toUpperCase()}</Text></View>
              ))}
            </View>
          </Section>
        )}

        <Section title="Project Clarifications" tag={`${qa.length} Questions`}>
          {!!qaError && <ErrorText>{qaError}</ErrorText>}
          {qa.length === 0 && <Text style={s.empty}>No clarifying questions posted yet.</Text>}
          {qa.map((item, index) => (
            <View key={item._id || `${item.q}${index}`} style={s.qa}>
              <Text style={s.q}>Q. {item.q}</Text>
              {item.a ? <Text style={s.a}><Text style={{ fontWeight: '800', color: c.greenText }}>Client: </Text>{item.a}</Text>
                : isOwner && item._id ? (
                  <View style={{ gap: 6 }}>
                    <TextInput style={s.input} value={drafts[item._id] || ''} onChangeText={value => setDrafts(previous => ({ ...previous, [item._id as string]: value }))} placeholder="Write your clarification..." placeholderTextColor="#98a59f" />
                    <Pressable style={[s.small, answering === item._id && { opacity: 0.6 }]} disabled={answering === item._id} onPress={() => void answer(item._id as string)}><Text style={s.solidText}>{answering === item._id ? 'Saving…' : 'Submit Reply'}</Text></Pressable>
                  </View>
                ) : <Text style={s.empty}>Awaiting client clarification</Text>}
            </View>
          ))}
          {!isOwner && (
            <View style={{ gap: 8 }}>
              <TextInput style={s.input} value={question} onChangeText={setQuestion} placeholder="Ask the client a clarifying question regarding scope or drawings..." placeholderTextColor="#98a59f" />
              <Pressable style={[s.small, (posting || !question.trim()) && { opacity: 0.6 }]} disabled={posting || !question.trim()} onPress={() => void postQuestion()}><Text style={s.solidText}>{posting ? 'Posting…' : 'Post Question'}</Text></Pressable>
            </View>
          )}
        </Section>
      </ScrollView>

      <View style={s.footer}>
        {isOwner ? (
          <Pressable style={s.cta} onPress={() => router.navigate('/professional/project-management' as never)}><Text style={s.solidText}>Manage Project</Text></Pressable>
        ) : unlocked ? (
          <View style={s.actions}>
            <Pressable style={[s.cta, { flex: 1 }]} onPress={() => setProposalTarget(proposalContext)}><Text style={s.solidText}>✦ Submit Proposal</Text></Pressable>
            {!!project.clientPhone && <Pressable style={s.callBtn} onPress={() => void Linking.openURL(`tel:${digits(project.clientPhone || '')}`)} accessibilityLabel="Call client"><Text style={s.solidText}>📞</Text></Pressable>}
          </View>
        ) : (
          <Pressable style={s.cta} onPress={() => setUnlockOpen(true)}><Text style={s.solidText}>🔒 Unlock Direct Contact</Text></Pressable>
        )}
      </View>

      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
        <SafeAreaView style={s.lightbox}>
          <Pressable style={s.close} onPress={() => setLightbox(false)} accessibilityLabel="Close gallery"><Text style={s.closeText}>✕</Text></Pressable>
          {photos.length > 0 && <Image source={{ uri: photos[Math.min(photo, photos.length - 1)] }} style={s.big} resizeMode="contain" />}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 12 }}>
            {photos.map((uri, index) => <Pressable key={uri} onPress={() => setPhoto(index)}><Image source={{ uri }} style={[s.thumb, index === photo ? s.thumbOn : { opacity: 0.6 }]} /></Pressable>)}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <UnlockSheet
        project={unlockOpen ? { id: realId, title: project.title, location: place, budgetRange: project.budgetRange, areaSqFt: project.areaSqFt, timeline: project.timeline, proposalsReceived: project.proposalsReceived, maxProposals: project.maxProposals } : null}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => { void load(); }}
        onSubmitProposal={() => { setUnlockOpen(false); setProposalTarget(proposalContext); }}
      />
      <ProposalSheet context={proposalTarget} onClose={() => setProposalTarget(null)} onSubmitted={() => { void load(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  content: { padding: 16, paddingBottom: 100, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { color: c.green, fontSize: 14, fontWeight: '800' },
  link: { color: c.green, fontSize: 12.5, fontWeight: '800' },
  hero: { height: 230, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0f382c' },
  heroImage: { width: '100%', height: '100%' },
  heroBadges: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  status: { backgroundColor: 'rgba(16,185,129,0.92)', color: '#fff', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  tier: { backgroundColor: 'rgba(245,158,11,0.92)', color: '#fff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 10.5, fontWeight: '800', overflow: 'hidden' },
  count: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#eef1ef', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: '#34d399' },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  cardTitle: { flex: 1, color: c.ink, fontSize: 15.5, fontWeight: '800' },
  cardTag: { color: c.greenText, backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  verified: { color: c.greenText, backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  service: { color: c.body, backgroundColor: '#eef1ef', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  title: { color: c.ink, fontSize: 21, fontWeight: '800', lineHeight: 27 },
  locRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  loc: { flex: 1, color: c.body, fontSize: 12.5, fontWeight: '600' },
  date: { color: c.muted, fontSize: 11 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  metric: { width: '48.5%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 12, gap: 4 },
  metricLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  metricValue: { color: c.ink, fontSize: 14, fontWeight: '800' },
  body: { color: c.body, fontSize: 13, lineHeight: 20 },
  story: { color: c.body, fontSize: 12.5, fontStyle: 'italic', lineHeight: 19, backgroundColor: '#f5f7f6', borderRadius: 12, padding: 11 },
  sub: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, marginTop: 4 },
  chip: { color: c.ink, backgroundColor: '#f5f7f6', borderWidth: 1, borderColor: c.line, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11.5, fontWeight: '700', overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  spec: { width: '48.5%', backgroundColor: '#f5f7f6', borderRadius: 12, padding: 10, gap: 2 },
  specValue: { color: c.ink, fontSize: 12.5, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  landmark: { color: c.greenText, backgroundColor: c.mint, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  ghost: { height: 42, borderRadius: 12, backgroundColor: '#eef1ef', alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: c.ink, fontSize: 13, fontWeight: '800' },
  attach: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, backgroundColor: '#f5f7f6', borderRadius: 12, padding: 11 },
  attachName: { flexShrink: 1, color: c.ink, fontSize: 12.5, fontWeight: '800' },
  good: { color: c.ink, backgroundColor: c.greenSoft, borderRadius: 13, padding: 11, fontSize: 13, fontWeight: '800', overflow: 'hidden' },
  line: { color: c.ink, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  priority: { color: c.greenText, backgroundColor: c.greenSoft, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11.5, fontWeight: '800', overflow: 'hidden' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f7f6', borderRadius: 14, padding: 12 },
  slotTitle: { color: c.ink, fontSize: 13.5, fontWeight: '800' },
  activeSlot: { color: c.greenText, backgroundColor: c.mint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  client: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f5f7f6', borderRadius: 16, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  clientName: { color: c.ink, fontSize: 14, fontWeight: '800' },
  rep: { width: '48.5%', backgroundColor: '#f5f7f6', borderRadius: 12, padding: 10, alignItems: 'center', gap: 2 },
  repValue: { color: c.ink, fontSize: 15, fontWeight: '800' },
  unlocked: { backgroundColor: c.greenSoft, borderRadius: 14, borderWidth: 1, borderColor: '#bfe0cf', padding: 12, gap: 6 },
  unlockedTitle: { color: c.greenText, fontSize: 12, fontWeight: '800' },
  contact: { color: c.ink, backgroundColor: '#fff', borderRadius: 11, padding: 10, fontSize: 13, fontWeight: '700', overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8 },
  solid: { flex: 1, height: 46, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  cta: { height: 50, borderRadius: 16, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  small: { alignSelf: 'flex-end', height: 40, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  callBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  recommend: { color: c.greenText, backgroundColor: c.mint, borderRadius: 12, padding: 11, fontSize: 12.5, fontWeight: '700', lineHeight: 18, overflow: 'hidden' },
  empty: { color: c.muted, fontSize: 12.5, fontStyle: 'italic', textAlign: 'center', paddingVertical: 4 },
  qa: { backgroundColor: '#f5f7f6', borderRadius: 14, padding: 12, gap: 6 },
  q: { color: c.ink, fontSize: 13, fontWeight: '800' },
  a: { color: c.body, fontSize: 12.5, lineHeight: 18, backgroundColor: '#fff', borderLeftWidth: 3, borderLeftColor: c.green, padding: 9, borderRadius: 8 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 12, color: c.ink, fontSize: 13.5 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  close: { position: 'absolute', top: 40, right: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  big: { width: '100%', height: '70%' },
});
