import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { router } from 'expo-router';
import { partnerApi } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../../components/professional/onboardingUi';

interface ProjectRow {
  projectId: string;
  title: string;
  status: string;
  clientName?: string;
  location?: string;
  tasksDone: number;
  tasksTotal: number;
  visitsCompleted: number;
  visitsUpcoming?: number;
  nextVisitAt?: string | null;
}
interface Summary {
  totalProjects?: number;
  activeProjects: number;
  completedProjects?: number;
  totalTasks?: number;
  totalVisitsCompleted: number;
  totalVisitsUpcoming?: number;
  totalTasksDone: number;
}

type Filter = 'all' | 'active' | 'completed';

const ACTIVE = ['In Progress', 'Work in Progress'];
const COMPLETED = 'Completed';

const dateOf = (iso?: string | null) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
};

const tone = (status: string) => (ACTIVE.includes(status) ? { bg: c.greenSoft, fg: c.green, label: 'In progress' }
  : status === COMPLETED ? { bg: '#e6eefc', fg: '#2c5fb3', label: 'Completed' }
  : { bg: '#eef1ef', fg: c.body, label: status || 'Open' });

// Studio-wide roll-up across the projects awarded to this studio: how many are running or finished,
// and how far each one is. Tapping a project opens its workspace.
export default function ReportsScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
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

  const shown = projects.filter(project => filter === 'all' || (filter === 'active' ? ACTIVE.includes(project.status) : project.status === COMPLETED));
  const count = (f: Filter) => projects.filter(project => f === 'all' || (f === 'active' ? ACTIVE.includes(project.status) : project.status === COMPLETED)).length;
  const tiles: [string, number | undefined][] = [
    ['Awarded projects', summary?.totalProjects ?? projects.length],
    ['Active projects', summary?.activeProjects],
    ['Completed projects', summary?.completedProjects ?? count('completed')],
    ['Tasks done', summary ? summary.totalTasksDone : undefined],
    ['Visits completed', summary?.totalVisitsCompleted],
    ['Visits coming up', summary?.totalVisitsUpcoming],
  ];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
      <Text style={s.title}>Reports</Text>
      <Text style={s.sub}>Execution roll-up across the projects awarded to your studio.</Text>
      {loading && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}
      {!!error && <ErrorText>{error}</ErrorText>}

      {summary && (
        <View style={s.tiles}>
          {tiles.map(([label, value]) => (
            <View key={label} style={s.tile}><Text style={s.tileValue}>{value ?? '—'}</Text><Text style={s.tileLabel}>{label}</Text></View>
          ))}
        </View>
      )}

      {!loading && !error && (
        <>
          <View style={s.filters}>
            {([['all', 'All'], ['active', 'Active'], ['completed', 'Completed']] as [Filter, string][]).map(([id, label]) => (
              <Pressable key={id} style={[s.filter, filter === id && s.filterOn]} onPress={() => setFilter(id)}>
                <Text style={[s.filterText, filter === id && { color: '#fff' }]}>{label} ({count(id)})</Text>
              </Pressable>
            ))}
          </View>

          {shown.length === 0 ? (
            <View style={s.card}><Text style={s.empty}>{projects.length === 0 ? 'No projects have been awarded to your studio yet. When a client accepts your proposal, its progress is reported here.' : 'No projects in this filter.'}</Text></View>
          ) : shown.map(project => {
            const badge = tone(project.status);
            const pct = project.tasksTotal > 0 ? Math.round((project.tasksDone / project.tasksTotal) * 100) : 0;
            return (
              <Pressable
                key={project.projectId}
                style={s.card}
                onPress={() => router.navigate({ pathname: '/professional/project-management', params: { projectId: project.projectId } } as never)}
                accessibilityRole="button"
              >
                <View style={s.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={2}>{project.title}</Text>
                    {!!(project.clientName || project.location) && <Text style={s.meta} numberOfLines={1}>{[project.clientName, project.location].filter(Boolean).join(' · ')}</Text>}
                  </View>
                  <View style={[s.badge, { backgroundColor: badge.bg }]}><Text style={[s.badgeText, { color: badge.fg }]}>{badge.label}</Text></View>
                </View>
                <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>
                <View style={s.rowBottom}>
                  <Text style={s.meta}>{project.tasksTotal > 0 ? `${project.tasksDone}/${project.tasksTotal} tasks done (${pct}%)` : 'No tasks yet'}</Text>
                  <Text style={s.meta}>{project.visitsCompleted} visit{project.visitsCompleted === 1 ? '' : 's'} done{project.nextVisitAt ? ` · next ${dateOf(project.nextVisitAt)}` : ''}</Text>
                </View>
                <View style={s.open}><Text style={s.openText}>Open project</Text><Icon name="chevronRight" size={15} color={c.green} /></View>
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 12 },
  title: { color: c.ink, fontSize: 22, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12 },
  tileValue: { color: c.ink, fontSize: 20, fontWeight: '800' },
  tileLabel: { color: c.muted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  filterOn: { backgroundColor: c.green, borderColor: c.green },
  filterText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  empty: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  rowTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: c.muted, fontSize: 11.5, marginTop: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#e9eeeb', overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: c.green },
  rowBottom: { gap: 2 },
  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  openText: { color: c.green, fontSize: 12, fontWeight: '800' },
});
