import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';

type FollowUpStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
interface LeadItem {
  leadId: string;
  projectId: string;
  projectTitle: string;
  projectLocation?: string;
  projectStatus?: string | null;
  unlockedAt: string;
  followUp: { status: FollowUpStatus; nextFollowUpDate?: string | null; notes: { text: string; at: string }[] };
}
interface Funnel { unlocked: number; contacted: number; proposalsSubmitted: number; won: number }

const LABELS: Record<FollowUpStatus, string> = { new: 'New', contacted: 'Contacted', interested: 'Interested', converted: 'Converted', lost: 'Lost' };
const TONE: Record<FollowUpStatus, { bg: string; fg: string }> = {
  new: { bg: '#eef1f0', fg: c.body }, contacted: { bg: '#e6eefc', fg: '#2c5fb3' }, interested: { bg: c.amberSoft, fg: c.amber }, converted: { bg: c.mint, fg: c.greenText }, lost: { bg: c.redSoft, fg: c.red },
};

// "DD-MM-YYYY" -> ISO date, or null when it is not a real date.
function parseDate(value: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value.trim());
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(m[1]) ? null : date.toISOString();
}
const toInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
};

export default function FollowUpsScreen() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const [leadsRes, insightsRes] = await Promise.all([
        partnerApi.call<{ leads?: LeadItem[] }>('/execution/leads'),
        partnerApi.call<{ funnel?: Funnel }>('/execution/leads/insights'),
      ]);
      const items = leadsRes.leads || [];
      setLeads(items);
      setFunnel(insightsRes.funnel || null);
      setDates(Object.fromEntries(items.map(item => [item.leadId, toInput(item.followUp.nextFollowUpDate)])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your leads pipeline.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function update(leadId: string, patch: { status?: FollowUpStatus; nextFollowUpDate?: string | null; note?: string }) {
    setSaving(leadId);
    setError('');
    try {
      const res = await partnerApi.call<{ followUp?: LeadItem['followUp'] }>(`/execution/leads/${leadId}/follow-up`, 'PATCH', patch);
      const followUp = res.followUp;
      if (followUp) {
        setLeads(previous => previous.map(item => (item.leadId === leadId ? { ...item, followUp: { status: followUp.status, nextFollowUpDate: followUp.nextFollowUpDate, notes: followUp.notes || [] } } : item)));
        setDates(previous => ({ ...previous, [leadId]: toInput(followUp.nextFollowUpDate) }));
      }
      if (patch.note) setNotes(previous => ({ ...previous, [leadId]: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this lead.');
    } finally {
      setSaving('');
    }
  }

  function saveDate(leadId: string) {
    const raw = (dates[leadId] || '').trim();
    if (!raw) { void update(leadId, { nextFollowUpDate: null }); return; }
    const iso = parseDate(raw);
    if (!iso) { setError('Enter the follow-up date as DD-MM-YYYY.'); return; }
    void update(leadId, { nextFollowUpDate: iso });
  }

  const tiles = funnel ? [['Unlocked', funnel.unlocked], ['Contacted', funnel.contacted], ['Proposals Sent', funnel.proposalsSubmitted], ['Won', funnel.won]] as [string, number][] : [];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Follow-ups</Text>
      <Text style={s.sub}>Stay on top of client calls and proposal reminders.</Text>
      {!!error && <ErrorText>{error}</ErrorText>}
      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />}

      {tiles.length > 0 && (
        <View style={s.tiles}>
          {tiles.map(([label, value]) => <View key={label} style={s.tile}><Text style={s.tileValue}>{value}</Text><Text style={s.tileLabel}>{label.toUpperCase()}</Text></View>)}
        </View>
      )}

      {!loading && (
        <>
          <Text style={s.section}>FOLLOW-UP QUEUE</Text>
          {leads.length === 0 ? <Text style={s.empty}>No unlocked leads yet.</Text> : leads.map(lead => {
            const tone = TONE[lead.followUp.status];
            const busy = saving === lead.leadId;
            return (
              <View key={lead.leadId} style={s.card}>
                <View style={s.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{lead.projectTitle}</Text>
                    {!!lead.projectLocation && <Text style={s.meta}>{lead.projectLocation}</Text>}
                  </View>
                  <View style={[s.pill, { backgroundColor: tone.bg }]}><Text style={[s.pillText, { color: tone.fg }]}>{LABELS[lead.followUp.status]}</Text></View>
                </View>

                <View style={s.statusRow}>
                  {(Object.keys(LABELS) as FollowUpStatus[]).map(status => (
                    <Pressable key={status} disabled={busy} style={[s.statusChip, lead.followUp.status === status && s.statusChipOn]} onPress={() => void update(lead.leadId, { status })}>
                      <Text style={[s.statusChipText, lead.followUp.status === status && { color: '#fff' }]}>{LABELS[status]}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={s.label}>NEXT FOLLOW-UP (DD-MM-YYYY)</Text>
                <View style={s.row}>
                  <TextInput style={s.input} value={dates[lead.leadId] ?? ''} onChangeText={value => setDates(previous => ({ ...previous, [lead.leadId]: value }))} placeholder="25-12-2026" placeholderTextColor="#98a59f" keyboardType="numbers-and-punctuation" />
                  <Pressable style={s.save} disabled={busy} onPress={() => saveDate(lead.leadId)}><Text style={s.saveText}>Save</Text></Pressable>
                </View>

                {lead.followUp.notes.slice(-2).map((note, index) => <Text key={index} style={s.note}>{note.text}</Text>)}

                <View style={s.row}>
                  <TextInput style={s.input} value={notes[lead.leadId] || ''} onChangeText={value => setNotes(previous => ({ ...previous, [lead.leadId]: value }))} placeholder="Add a follow-up note…" placeholderTextColor="#98a59f" />
                  <Pressable style={[s.save, (!notes[lead.leadId]?.trim() || busy) && { opacity: 0.5 }]} disabled={!notes[lead.leadId]?.trim() || busy} onPress={() => void update(lead.leadId, { note: notes[lead.leadId] })}><Text style={s.saveText}>Add</Text></Pressable>
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13, marginTop: 4, marginBottom: 14 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  tile: { width: '48%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14 },
  tileValue: { color: c.ink, fontSize: 26, fontWeight: '800' },
  tileLabel: { color: c.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginTop: 2 },
  section: { color: c.ink, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 },
  empty: { color: c.body, fontSize: 13, fontStyle: 'italic' },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12, gap: 10 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  name: { color: c.ink, fontSize: 15, fontWeight: '800' },
  meta: { color: c.body, fontSize: 12, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#eef3f0' },
  statusChipOn: { backgroundColor: c.green },
  statusChipText: { color: c.body, fontSize: 11.5, fontWeight: '700' },
  label: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, paddingHorizontal: 12, color: c.ink, fontSize: 13.5 },
  save: { height: 44, borderRadius: 12, backgroundColor: c.green, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  note: { color: c.body, fontSize: 12.5, backgroundColor: '#f4f7f5', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
});
