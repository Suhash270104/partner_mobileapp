import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Text } from '../../../components/AppText';
import { useStudio } from '../../../components/studio/StudioContext';
import { Alert, Bar, Btn, Card, Chips, Empty, HEALTH, Muted, Pill, PmScreen, goBack, stageLabel, usePmLoad } from '../../../components/pm/PmUi';
import { loadProjectRows, type PmProjectRow } from '../../../lib/pm/projects';

type Filter = 'all' | 'active' | 'risk' | 'setup';

// Projects list: every awarded project with its stage, health and progress, like the "Projects" screen in the prototype.
export default function ProjectManagementScreen() {
  const { profile } = useStudio();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, loading, refreshing, reload } = usePmLoad(() => loadProjectRows(profile._id || ''), [profile._id]);

  const rows = useMemo(() => data || [], [data]);
  const counts = useMemo(() => ({
    all: rows.length,
    active: rows.filter(r => r.overview?.started).length,
    risk: rows.filter(r => r.overview?.execution?.health === 'at_risk' || r.overview?.execution?.health === 'delayed').length,
    setup: rows.filter(r => r.overview && !r.overview.started).length,
  }), [rows]);
  const shown = rows.filter(r => filter === 'all' || (filter === 'active' ? r.overview?.started : filter === 'risk' ? ['at_risk', 'delayed'].includes(r.overview?.execution?.health || '') : r.overview && !r.overview.started));

  // Links from other screens (reports, project details) carry a project id: go straight to it.
  if (projectId) return <Redirect href={`/professional/pm/${projectId}` as never} />;

  return (
    <PmScreen title="Projects" subtitle="Your awarded projects" onBack={() => goBack('/professional/studio')} loading={loading} error={error} refreshing={refreshing} onRefresh={() => void reload()}>
      {rows.length > 0 && (
        <Chips<Filter> value={filter} onChange={setFilter} options={[
          { key: 'all', label: `All ${counts.all}` }, { key: 'active', label: `Running ${counts.active}` },
          { key: 'risk', label: `At risk ${counts.risk}` }, { key: 'setup', label: `To set up ${counts.setup}` },
        ]} />
      )}
      {!loading && rows.length === 0 && !error && (
        <>
          <Empty title="No awarded projects yet" text="When a client awards a project to your studio, its workspace appears here: plan, site updates, payments and handover." />
          <Btn label="View submitted proposals" kind="green" onPress={() => router.navigate('/professional/proposals' as never)} />
        </>
      )}
      {shown.map(row => <ProjectCard key={row.project.id} row={row} />)}
      {rows.length > 0 && shown.length === 0 && <Empty title="Nothing in this filter" />}
    </PmScreen>
  );
}

function ProjectCard({ row }: { row: PmProjectRow }) {
  const { project, overview, problem } = row;
  const exec = overview?.execution;
  const place = project.location || project.city || '';
  const open = () => router.push(`/professional/pm/${project.id}` as never);

  if (problem === 'locked') {
    return (
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#14231D' }}>{project.title || 'Untitled project'}</Text>
        <Muted>{[project.clientName, place].filter(Boolean).join(' · ')}</Muted>
        <Alert tone="warn" text="This project is not assigned to your studio yet, so its workspace is closed. It opens when the client awards it to you." />
      </Card>
    );
  }

  const health = HEALTH[exec?.health || ''];
  return (
    <Card onPress={open}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#14231D' }} numberOfLines={2}>{project.title || 'Untitled project'}</Text>
          <Muted>{[project.clientName, project.propertyType, place].filter(Boolean).join(' · ')}</Muted>
        </View>
        {overview?.started && health ? <Pill text={health.label} tone={health.tone} /> : !overview?.started && !problem ? <Pill text="Not started" tone="gray" /> : null}
      </View>
      {overview?.started ? (
        <>
          <Muted>{stageLabel(exec?.stage)} · {Math.round(exec?.progressPct ?? 0)}% complete</Muted>
          <Bar pct={exec?.progressPct ?? 0} tone={exec?.health === 'delayed' ? 'bad' : exec?.health === 'at_risk' ? 'warn' : 'ok'} />
        </>
      ) : problem === 'error' ? (
        <Muted>{row.message || 'Could not load this project. Open it to retry.'}</Muted>
      ) : (
        <Muted>Set up the plan to start tracking progress, payments and updates.</Muted>
      )}
      {!!overview?.attention?.length && <Muted>{overview.attention.length} thing{overview.attention.length === 1 ? '' : 's'} need attention</Muted>}
    </Card>
  );
}
