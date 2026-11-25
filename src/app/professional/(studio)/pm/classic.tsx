import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import { partnerApi } from '../../../../lib/partnerApi';
import { c, ErrorText } from '../../../../components/professional/onboardingUi';
import { useStudio } from '../../../../components/studio/StudioContext';
import { ExecutionTab } from '../../../../components/studio/pms/ExecutionTab';
import { ProcurementTab } from '../../../../components/studio/pms/ProcurementTab';
import { QuotationTab } from '../../../../components/studio/pms/QuotationTab';
import { ReportTab } from '../../../../components/studio/pms/ReportTab';
import { openProjectChat } from '../../../../lib/projectChat';
import { isWonStatus } from '../../../../lib/studioMoney';
import { PmScreen } from '../../../../components/pm/PmUi';

type PmsTab = 'tasks' | 'quotations' | 'procurement' | 'report' | 'client';

interface PmsProject {
  id: string;
  title?: string;
  status?: string;
  location?: string;
  locality?: string;
  city?: string;
  budgetRange?: string;
  budgetMin?: number | string;
  budgetMax?: number | string;
  propertyType?: string;
  projectType?: string;
  timeline?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  description?: string;
  projectStory?: string;
  customerId?: { name?: string; email?: string; phone?: string };
  hasAwarded?: boolean;
  awardedToAnotherStudio?: boolean;
  proposalStatus?: string | null;
  selectedProfessionalId?: string;
  designerId?: string;
  awardedProfessional?: unknown;
  awardedDesignerId?: string;
}

// Only awarded projects have a workspace (same rule as desktop).
function isAwarded(p: PmsProject, designerId?: string): boolean {
  if (p.awardedToAnotherStudio) return false;
  if (p.hasAwarded) return true;
  if (p.proposalStatus && isWonStatus(p.proposalStatus)) return true;
  if (p.selectedProfessionalId || p.designerId || p.awardedProfessional || p.awardedDesignerId) return true;
  if (designerId && (String(p.selectedProfessionalId || '') === designerId || String(p.designerId || '') === designerId)) return true;
  const status = String(p.status || '').toLowerCase().replace(/[\s_-]+/g, '');
  return ['awarded', 'inprogress', 'completed', 'execution'].includes(status);
}

// The server says per project whether it really is assigned to this studio (older servers do not say,
// and then the project is treated as workable). The task board, visits and quotations only open for
// projects assigned to the studio; a project it merely has a "Won" proposal on stays read-only.
const isLocked = (p?: PmsProject | null) => p?.hasAwarded === false;

function statusBadge(p: PmsProject): { label: string; locked: boolean } {
  if (isLocked(p)) return { label: 'Not awarded yet', locked: true };
  const status = String(p.status || '');
  return { label: ['In Progress', 'Work in Progress'].includes(status) ? 'Active' : status || 'Active', locked: false };
}

const TABS: [PmsTab, string][] =[['tasks', 'Tasks & Milestones'], ['quotations', 'Quotations & Estimates'], ['procurement', 'Procurement & POs'], ['report', 'Project Report'], ['client', 'Client & Details']];

export default function ProjectManagementScreen() {
  const { profile } = useStudio();
  const params = useLocalSearchParams<{ projectId?: string; tab?: string }>();
  const [projects, setProjects] = useState<PmsProject[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [details, setDetails] = useState<PmsProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<PmsTab>(TABS.some(([key]) => key === params.tab) ? (params.tab as PmsTab) : 'tasks');
  const [picker, setPicker] = useState(false);
  const [version, setVersion] = useState(0);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const designerId = profile._id || '';

  async function openChat() {
    setChatBusy(true);
    setChatError('');
    try {
      await openProjectChat(selectedId);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Could not open the conversation. Please try again.');
    } finally {
      setChatBusy(false);
    }
  }

  const loadProjects = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      let list: unknown = designerId ? await partnerApi.assignedStudioProjects(designerId).catch(() => []) : [];
      if (!Array.isArray(list) || list.length === 0) list = await partnerApi.assignedStudioProjectsMe().catch(() => []);
      const raw = (Array.isArray(list) ? list : ((list as { projects?: unknown[] })?.projects || [])) as PmsProject[];
      const awarded = raw.map(p => ({ ...p, id: String(p.id || (p as { _id?: string })._id) })).filter(p => isAwarded(p, designerId));
      setProjects(awarded);
      setSelectedId(current => (params.projectId && awarded.some(p => p.id === params.projectId) ? String(params.projectId) : awarded.some(p => p.id === current) ? current : awarded[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your awarded projects.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [designerId, params.projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadProjects(); }, 0);
    return () => clearTimeout(timer);
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    partnerApi.call<PmsProject>(`/client-projects/${selectedId}`).then(
      res => { if (!cancelled && (res.id || (res as { _id?: string })._id || res.title)) setDetails(res); },
      () => { if (!cancelled) setDetails(null); },
    );
    return () => { cancelled = true; };
  }, [selectedId]);

  const current = (details && (details.id === selectedId || (details as { _id?: string })._id === selectedId) ? details : null) || projects.find(p => p.id === selectedId);
  const place = current?.location || [current?.locality, current?.city].filter(Boolean).join(', ');
  const budget = current?.budgetRange || (current?.budgetMin ? `₹${current.budgetMin} - ₹${current.budgetMax}` : '');
  const clientName = current?.clientName || current?.customerId?.name || '';
  const clientEmail = current?.clientEmail || current?.customerId?.email;
  const clientPhone = current?.clientPhone || current?.customerId?.phone;
  const locked = isLocked(projects.find(p => p.id === selectedId));

  const refreshAll = () => { void loadProjects(true); setVersion(v => v + 1); };
  const header = { title: 'Tasks, quotes & procurement', subtitle: current?.title || undefined };

  if (projects.length === 0) {
    return (
      <PmScreen {...header} loading={loading} error={error} refreshing={refreshing} onRefresh={() => void loadProjects(true)}>
        <Text style={s.copy}>When a client awards an interior design project to your studio, the live collaborative workspace (task board, site visits, BOQ quotations, procurement POs and blueprints) will appear right here.</Text>
        <Pressable style={s.solid} onPress={() => router.navigate('/professional/proposals' as never)}><Text style={s.solidText}>View Submitted Proposals</Text></Pressable>
        <Pressable style={s.outline} onPress={() => router.navigate('/professional/clients' as never)}><Text style={s.outlineText}>Browse Project Leads</Text></Pressable>
      </PmScreen>
    );
  }

  return (
    <PmScreen {...header} loading={loading} refreshing={refreshing} onRefresh={refreshAll}>
      <Text style={s.eyebrow}>STUDIO EXECUTION PMS · ID: KS-{selectedId.slice(-4)}</Text>
      <Text style={s.title}>{current?.title || 'Interior Design Project'}</Text>
      <Text style={s.meta}>{[place, current?.propertyType || current?.projectType, budget, current?.timeline].filter(Boolean).join('  •  ')}</Text>

      {projects.length > 1 && (
        <View>
          <Pressable style={s.picker} onPress={() => setPicker(open => !open)}><Text style={s.pickerText}>Switch project ({projects.length})</Text><Text style={s.pickerText}>{picker ? '▲' : '▼'}</Text></Pressable>
          {picker && (
            <View style={s.pickerList}>
              {projects.map(project => (
                <Pressable key={project.id} style={[s.pickerItem, project.id === selectedId && { backgroundColor: c.greenSoft }]} onPress={() => { setSelectedId(project.id); setPicker(false); setDetails(null); }}>
                  <Text style={[s.pickerItemText, project.id === selectedId && { color: c.green }]} numberOfLines={1}>{project.title || 'Untitled'}</Text>
                  <Text style={[s.active, statusBadge(project).locked && { color: c.amber }]}>{statusBadge(project).label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.clientBar}>
        <View style={s.avatar}><Text style={s.avatarText}>{(clientName || 'C').trim().charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.clientName}>{clientName || 'Client'}</Text>
          <Text style={s.meta}>{locked ? 'Project Owner' : 'Project Owner · Awarded Client'}</Text>
        </View>
        <Pressable style={s.chat} disabled={chatBusy} onPress={() => void openChat()}>{chatBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.chatText}>Chat</Text>}</Pressable>
      </View>
      {!!chatError && <ErrorText>{chatError}</ErrorText>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {TABS.map(([key, label]) => (
          <Pressable key={key} style={[s.tab, tab === key && s.tabOn]} onPress={() => setTab(key)}><Text style={[s.tabText, tab === key && { color: '#fff' }]}>{label}</Text></Pressable>
        ))}
      </ScrollView>

      {tab !== 'client' && locked && (
        <View style={s.lockCard}>
          <Text style={s.lockTitle}>This project is not assigned to your studio yet</Text>
          <Text style={s.copy}>
            The task board, site visits, quotations and purchase orders open once the client awards this project to your studio.
            Until then you can chat with the client and read the project brief.
          </Text>
          <Pressable style={s.solid} onPress={() => void openChat()} disabled={chatBusy}><Text style={s.solidText}>Chat with the client</Text></Pressable>
        </View>
      )}
      {!locked && tab === 'tasks' && <ExecutionTab key={`${selectedId}-${version}`} projectId={selectedId} />}
      {!locked && tab === 'quotations' && <QuotationTab key={`${selectedId}-${version}`} projectId={selectedId} />}
      {!locked && tab === 'procurement' && <ProcurementTab key={`${selectedId}-${version}`} projectId={selectedId} />}
      {!locked && tab === 'report' && <ReportTab key={`${selectedId}-${version}`} projectId={selectedId} />}
      {tab === 'client' && (
        <View style={{ gap: 12 }}>
          <View style={s.card}>
            <Text style={s.label}>CLIENT CONTACT</Text>
            <Text style={s.value}>{clientName || 'Not provided'}</Text>
            {!!clientPhone && <Pressable onPress={() => void Linking.openURL(`tel:${clientPhone}`)}><Text style={s.link}>{clientPhone}</Text></Pressable>}
            {!!clientEmail && <Pressable onPress={() => void Linking.openURL(`mailto:${clientEmail}`)}><Text style={s.link}>{clientEmail}</Text></Pressable>}
            <Pressable style={s.solid} onPress={() => void openChat()} disabled={chatBusy}>{chatBusy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Open Direct Chat</Text>}</Pressable>
          </View>
          <View style={s.card}>
            <Text style={s.label}>PROJECT BRIEF</Text>
            {!!current?.propertyType && <Text style={s.value}>{current.propertyType}</Text>}
            <Text style={s.copy}>{current?.description || current?.projectStory || 'No project brief provided.'}</Text>
          </View>
        </View>
      )}
    </PmScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  empty: { padding: 24, gap: 12, alignItems: 'stretch' },
  eyebrow: { color: c.greenText, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: c.ink, fontSize: 20, fontWeight: '800', lineHeight: 25 },
  meta: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  copy: { color: c.body, fontSize: 13.5, lineHeight: 20 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: c.line, padding: 13 },
  pickerText: { color: c.ink, fontSize: 12.5, fontWeight: '800' },
  pickerList: { backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: c.line, marginTop: 6, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 13, gap: 10 },
  pickerItemText: { flex: 1, color: c.ink, fontSize: 12.5, fontWeight: '700' },
  active: { color: c.greenText, fontSize: 10.5, fontWeight: '800' },
  clientBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.green, fontSize: 14.5, fontWeight: '800' },
  clientName: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  chat: { backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  chatText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  tabs: { gap: 8, paddingVertical: 4 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 },
  lockCard: { backgroundColor: c.amberSoft, borderRadius: 16, borderWidth: 1, borderColor: c.amber, padding: 14, gap: 10 },
  lockTitle: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  label: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 },
  value: { color: c.ink, fontSize: 14.5, fontWeight: '800' },
  link: { color: c.green, fontSize: 13.5, fontWeight: '800' },
  solid: { height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  outline: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 13.5, fontWeight: '800' },
});
