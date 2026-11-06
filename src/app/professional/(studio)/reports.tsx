import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';

interface ProjectRow { projectId: string; title: string; status: string; tasksDone: number; tasksTotal: number; visitsCompleted: number }
interface Summary { activeProjects: number; totalVisitsCompleted: number; totalTasksDone: number }

export default function ReportsScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const res = await partnerApi.call<{ summary?: Summary; projects?: ProjectRow[] }>('/execution/professional/reports');
      setSummary(res.summary || null);
      setProjects(res.projects || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load studio reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Reports</Text>
      <Text style={s.sub}>Studio-wide execution roll-up across your awarded projects.</Text>
      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}
      {!!error && <ErrorText>{error}</ErrorText>}

      {summary && (
        <View style={s.tiles}>
          {[['Active Projects', summary.activeProjects], ['Site Visits Completed', summary.totalVisitsCompleted], ['Tasks Completed', summary.totalTasksDone]].map(([label, value]) => (
            <View key={label as string} style={s.tile}><Text style={s.tileValue}>{value as number}</Text><Text style={s.tileLabel}>{label as string}</Text></View>
          ))}
        </View>
      )}

      {!loading && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Per-Project Execution</Text>
          {projects.length === 0 ? <Text style={s.empty}>No awarded projects yet.</Text> : projects.map(project => (
            <View key={project.projectId} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{project.title}</Text>
                <Text style={s.meta}>{project.status}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.rowTitle}>{project.tasksDone}/{project.tasksTotal} tasks</Text>
                <Text style={s.meta}>{project.visitsCompleted} visits</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12 },
  tileValue: { color: c.ink, fontSize: 24, fontWeight: '800' },
  tileLabel: { color: c.muted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 4 },
  cardTitle: { color: c.ink, fontSize: 15, fontWeight: '800', marginBottom: 6 },
  empty: { color: c.body, fontSize: 13, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
  rowTitle: { color: c.ink, fontSize: 13.5, fontWeight: '800' },
  meta: { color: c.muted, fontSize: 11.5, marginTop: 1 },
});
