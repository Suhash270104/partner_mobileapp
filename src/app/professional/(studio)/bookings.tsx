import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';

interface Meeting {
  _id?: string;
  id?: string;
  customerName?: string;
  customerPhone?: string;
  meetingType?: string;
  projectTitle?: string;
  title?: string;
  meetUrl?: string;
  date?: string;
  time?: string;
  status?: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
}

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  meetingType: string;
  projectTitle: string;
  meetUrl?: string;
  isVideo: boolean;
  date: string;
  dateFormatted: string;
  timeSlot: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
}

const formatDate = (raw: string) => {
  if (!raw) return 'Date TBC';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Combines the stored date and a "11:00 AM" style time into one Date, so real elapsed time is checked
// instead of trusting the stored status forever.
function parseWhen(dateStr: string, timeStr: string): Date | null {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const match = (timeStr || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return date;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  const merged = new Date(date);
  merged.setHours(hours, minutes, 0, 0);
  return merged;
}

// A Confirmed meeting stops counting as upcoming (and stops offering "Join") a while after it was due.
const GRACE_MS = 3 * 60 * 60 * 1000;
const graceElapsed = (b: Booking) => {
  const when = parseWhen(b.date, b.timeSlot);
  return when ? Date.now() - when.getTime() > GRACE_MS : false;
};

function toBooking(m: Meeting): Booking {
  const meetingType = m.meetingType || 'Video Call';
  const isVideo = /video|call/i.test(meetingType) && !/in[- ]?person/i.test(meetingType);
  return {
    id: String(m._id || m.id),
    clientName: m.customerName || 'Client',
    clientPhone: m.customerPhone || '',
    meetingType,
    projectTitle: m.projectTitle || m.title || 'Interior Project',
    meetUrl: isVideo ? m.meetUrl : undefined,
    isVideo,
    date: m.date || '',
    dateFormatted: formatDate(m.date || ''),
    timeSlot: m.time || '',
    status: m.status || 'Pending',
  };
}

const STATUS = {
  Confirmed: { bg: c.mint, fg: c.greenText },
  Pending: { bg: c.amberSoft, fg: c.amber },
  Completed: { bg: '#e6eefc', fg: '#2c5fb3' },
  Cancelled: { bg: c.redSoft, fg: c.red },
};

type Tab = 'all' | 'upcoming' | 'pending' | 'completed';

export default function BookingsScreen() {
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const meetings = await partnerApi.call<Meeting[]>('/designer/meetings');
      setList(Array.isArray(meetings) ? meetings.map(toBooking) : []);
      setError('');
    } catch (e) {
      setList([]);
      setError(e instanceof Error ? e.message : 'Could not load your meetings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function updateStatus(id: string, status: 'Confirmed' | 'Cancelled' | 'Completed') {
    setActing(id);
    setError('');
    try {
      const res = await partnerApi.call<{ meeting?: Meeting }>(`/designer/meetings/${id}/status`, 'PATCH', { status });
      if (res.meeting) setList(previous => previous.map(b => (b.id === id ? toBooking(res.meeting!) : b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this meeting. Please try again.');
    } finally {
      setActing('');
    }
  }

  const upcoming = list.filter(b => b.status === 'Confirmed' && !graceElapsed(b)).length;
  const pending = list.filter(b => b.status === 'Pending').length;
  const completed = list.filter(b => b.status === 'Completed').length;
  const q = query.trim().toLowerCase();
  const shown = list.filter(b => {
    const byTab = tab === 'all' ? true : tab === 'upcoming' ? b.status === 'Confirmed' && !graceElapsed(b) : tab === 'pending' ? b.status === 'Pending' : b.status === 'Completed';
    return byTab && (!q || b.clientName.toLowerCase().includes(q) || b.projectTitle.toLowerCase().includes(q) || b.meetingType.toLowerCase().includes(q));
  });
  const tabs: [Tab, string, number][] = [['all', 'All', list.length], ['upcoming', 'Upcoming', upcoming], ['pending', 'Pending', pending], ['completed', 'Completed', completed]];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Meetings</Text>
      <Text style={s.sub}>{upcoming} confirmed upcoming · {pending} awaiting confirmation</Text>
      <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search meetings…" placeholderTextColor="#98a59f" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {tabs.map(([key, label, count]) => (
          <Pressable key={key} style={[s.tab, tab === key && s.tabOn]} onPress={() => setTab(key)}><Text style={[s.tabText, tab === key && { color: '#fff' }]}>{label} {count}</Text></Pressable>
        ))}
      </ScrollView>

      {!!error && <ErrorText>{error}</ErrorText>}
      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 24 }} />}
      {!loading && shown.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No meetings found</Text>
          <Text style={s.emptyCopy}>No consultation or site visit meetings match your selected tab or search query.</Text>
        </View>
      )}

      {shown.map(b => {
        const elapsed = b.status === 'Confirmed' && graceElapsed(b);
        const tone = STATUS[b.status] || STATUS.Pending;
        const busy = acting === b.id;
        return (
          <View key={b.id} style={s.card}>
            <View style={s.top}>
              <View style={s.dateChip}><Text style={s.dateChipText}>{b.dateFormatted}</Text><Text style={s.timeChipText}>{b.timeSlot}</Text></View>
              <View style={[s.pill, { backgroundColor: elapsed ? '#eef1f0' : tone.bg }]}><Text style={[s.pillText, { color: elapsed ? c.body : tone.fg }]}>{elapsed ? 'Time passed' : b.status}</Text></View>
            </View>
            <Text style={s.name}>{b.clientName}</Text>
            <Text style={s.meta}>{b.meetingType} · {b.projectTitle}</Text>
            {!!b.clientPhone && <Pressable onPress={() => void Linking.openURL(`tel:${b.clientPhone}`)}><Text style={s.link}>{b.clientPhone}</Text></Pressable>}
            {b.isVideo && !!b.meetUrl && <Text style={s.meta} numberOfLines={1}>{b.meetUrl}</Text>}

            {b.status === 'Pending' && (
              <View style={s.actions}>
                <Pressable style={s.outline} disabled={busy} onPress={() => void updateStatus(b.id, 'Cancelled')}><Text style={s.outlineText}>Decline</Text></Pressable>
                <Pressable style={s.solid} disabled={busy} onPress={() => void updateStatus(b.id, 'Confirmed')}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Confirm</Text>}</Pressable>
              </View>
            )}
            {b.status === 'Confirmed' && (
              <View style={s.actions}>
                {elapsed || !(b.isVideo && b.meetUrl) ? (
                  <Pressable style={s.solid} disabled={busy} onPress={() => void updateStatus(b.id, 'Completed')}><Text style={s.solidText}>{busy ? 'Saving...' : 'Mark Completed'}</Text></Pressable>
                ) : (
                  <>
                    <Pressable style={s.solid} onPress={() => void Linking.openURL(b.meetUrl!)}><Text style={s.solidText}>Join Video Call</Text></Pressable>
                    <Pressable style={s.outline} disabled={busy} onPress={() => void updateStatus(b.id, 'Completed')}><Text style={s.outlineText}>{busy ? 'Saving...' : 'Mark Completed'}</Text></Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13, marginTop: 4, marginBottom: 14 },
  search: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14.5 },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  emptyCopy: { color: c.body, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12, gap: 5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dateChip: { backgroundColor: c.greenSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  dateChipText: { color: c.green, fontSize: 13, fontWeight: '800' },
  timeChipText: { color: c.greenText, fontSize: 11.5, fontWeight: '700' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  name: { color: c.ink, fontSize: 17, fontWeight: '800' },
  meta: { color: c.body, fontSize: 12.5 },
  link: { color: c.green, fontSize: 13.5, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  solid: { flex: 1, height: 46, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  solidText: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  outline: { flex: 1, height: 46, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: c.green, fontSize: 13.5, fontWeight: '800' },
});
