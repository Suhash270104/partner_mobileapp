import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../AppText';
import { partnerApi, ExecutionProjectReport } from '../../../lib/partnerApi';
import { c, ErrorText } from '../../professional/onboardingUi';

// Per-project execution summary (GET /execution/projects/:id/report): tasks, site progress and visits.
export function ReportTab({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<ExecutionProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await partnerApi.executionProjectReport(projectId);
      setReport(res.report || null);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : 'Could not load the project report.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading) return <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />;
  if (error) {
    return (
      <View style={{ gap: 8 }}>
        <ErrorText>{error}</ErrorText>
        <Pressable onPress={() => void load()}><Text style={s.link}>Try again</Text></Pressable>
      </View>
    );
  }
  if (!report) return <Text style={s.empty}>No report is available for this project yet.</Text>;

  const taskPct = report.tasksTotal > 0 ? Math.round((report.tasksDone / report.tasksTotal) * 100) : 0;
  const tiles: [string, string, string][] = [
    ['Tasks done', `${report.tasksDone} / ${report.tasksTotal}`, 'Milestones & tasks'],
    ['Progress updates', String(report.progressEntries), 'Site-progress logs'],
    ['Site visits', `${report.visitsCompleted} / ${report.visitsScheduled}`, 'Completed / scheduled'],
    ['On-time check-ins', report.onTimeCheckInRate == null ? '—' : `${report.onTimeCheckInRate}%`, 'Within 30 min of schedule'],
  ];

  return (
    <View style={{ gap: 12 }}>
      <View style={s.card}>
        <View style={s.head}><Text style={s.title}>Task completion</Text><Text style={s.pct}>{taskPct}%</Text></View>
        <View style={s.track}><View style={[s.fill, { width: `${taskPct}%` }]} /></View>
      </View>
      <View style={s.grid}>
        {tiles.map(([label, value, foot]) => (
          <View key={label} style={s.tile}>
            <Text style={s.tileLabel}>{label}</Text>
            <Text style={s.tileValue}>{value}</Text>
            <Text style={s.tileFoot}>{foot}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { color: c.body, fontSize: 13.5, lineHeight: 20 },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: c.ink, fontSize: 15, fontWeight: '800' },
  pct: { color: c.greenText, fontSize: 15, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#e6ebe8', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: c.green },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 14, gap: 2 },
  tileLabel: { color: c.muted, fontSize: 12, fontWeight: '600' },
  tileValue: { color: c.ink, fontSize: 22, fontWeight: '800' },
  tileFoot: { color: c.muted, fontSize: 10.5 },
});
