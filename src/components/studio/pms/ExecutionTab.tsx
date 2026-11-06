import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../AppText';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { partnerApi } from '../../../lib/partnerApi';
import { generatedFileName, normalizeMime } from '../../../lib/professionalOnboarding';
import { c, ErrorText, Field } from '../../professional/onboardingUi';
import { Sheet } from '../Sheet';

// The designer side of the desktop ExecutionWorkspace (isDesignerViewer = true): task board, site
// visits & audits, site progress feed and design documents. Talks only to /execution/*.
type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked';
interface Task { _id: string; title: string; phase?: string; status: TaskStatus; dueDate?: string | null; assignedToRole?: 'client' | 'professional' | null }
interface Entry { _id: string; mediaUrls: string[]; caption?: string; phase?: string; loggedByName?: string; createdAt: string }
interface NextAction { id: string; text: string; severity: 'info' | 'warning' | 'critical' }
type VisitStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled';
interface Visit { _id: string; scheduledFor: string; purpose?: string; status: VisitStatus; recurrence?: { freq: string }; checkIn?: { at?: string | null; photoUrl?: string | null }; checkOut?: { at?: string | null } }
type DocStatus = 'submitted' | 'in_review' | 'approved' | 'changes_requested';
type DocType = 'drawing' | 'render' | 'boq' | 'other';
interface DesignDoc { _id: string; title: string; fileUrl: string; fileName?: string; docType: DocType; version: number; status: DocStatus; reviewerComment?: string }

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' }, { id: 'doing', label: 'In Progress' }, { id: 'blocked', label: 'Blocked' }, { id: 'done', label: 'Done' },
];
const SEVERITY = {
  info: { label: 'Information', bg: '#fff', fg: c.greenText, border: c.green },
  warning: { label: 'Attention', bg: c.amberSoft, fg: c.amber, border: c.amber },
  critical: { label: 'Action Required', bg: c.redSoft, fg: c.red, border: c.red },
};
const VISIT_STYLE: Record<VisitStatus, { label: string; bg: string; fg: string }> = {
  scheduled: { label: 'Scheduled', bg: '#eef1f0', fg: c.body }, checked_in: { label: 'Checked in', bg: c.amberSoft, fg: c.amber },
  completed: { label: 'Completed', bg: c.mint, fg: c.greenText }, cancelled: { label: 'Cancelled', bg: c.redSoft, fg: c.red },
};
const DOC_STYLE: Record<DocStatus, { label: string; bg: string; fg: string }> = {
  submitted: { label: 'Submitted', bg: '#eef1f0', fg: c.body }, in_review: { label: 'In review', bg: c.amberSoft, fg: c.amber },
  approved: { label: 'Approved', bg: c.mint, fg: c.greenText }, changes_requested: { label: 'Changes requested', bg: c.redSoft, fg: c.red },
};
const DOC_TYPE: Record<DocType, string> = { drawing: '2D / CAD Drawing', render: '3D Render / Visual', boq: 'BOQ & Estimate', other: 'Specification / Moodboard' };
const RECURRENCE = [['none', 'One-time visit (Does not repeat)'], ['weekly', 'Repeats weekly'], ['biweekly', 'Repeats every 2 weeks'], ['monthly', 'Repeats monthly']] as const;

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
};

// "DD-MM-YYYY" + "HH:MM" -> Date, or null when it is not a real date/time.
function parseWhen(date: string, time: string): Date | null {
  const d = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const result = new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]), Number(t[2]));
  return Number.isNaN(result.getTime()) || result.getDate() !== Number(d[1]) || Number(t[1]) > 23 || Number(t[2]) > 59 ? null : result;
}

async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
    ]);
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

async function uploadFile(file: { uri: string; name: string; mimeType: string }, folder: string): Promise<string> {
  const result = await partnerApi.uploadMedia(file, folder);
  return result.publicUrl;
}

export function ExecutionTab({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [actions, setActions] = useState<NextAction[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [documents, setDocuments] = useState<DesignDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [column, setColumn] = useState<TaskStatus>('todo');
  const [sheet, setSheet] = useState<'task' | 'visit' | 'progress' | 'doc' | null>(null);
  const [visitBusy, setVisitBusy] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const base = `/execution/projects/${projectId}`;
      const [taskRes, progressRes, actionsRes, visitsRes, docsRes] = await Promise.all([
        partnerApi.call<{ tasks?: Task[] }>(`${base}/tasks`),
        partnerApi.call<{ entries?: Entry[] }>(`${base}/progress`),
        partnerApi.call<{ actions?: NextAction[] }>(`${base}/next-actions`),
        partnerApi.call<{ visits?: Visit[] }>(`${base}/site-visits`),
        partnerApi.call<{ documents?: DesignDoc[] }>(`${base}/design-documents`),
      ]);
      setTasks(taskRes.tasks || []);
      setEntries(progressRes.entries || []);
      setActions(actionsRes.actions || []);
      setVisits(visitsRes.visits || []);
      setDocuments(docsRes.documents || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the execution workspace.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function changeStatus(taskId: string, status: TaskStatus) {
    const previous = tasks;
    setTasks(list => list.map(task => (task._id === taskId ? { ...task, status } : task)));
    try {
      await partnerApi.call(`/execution/tasks/${taskId}`, 'PATCH', { status });
    } catch {
      setTasks(previous);
      setError('Unable to update task status.');
    }
  }

  function confirmDelete(task: Task) {
    Alert.alert('Delete task?', task.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const previous = tasks;
          setTasks(list => list.filter(item => item._id !== task._id));
          try { await partnerApi.call(`/execution/tasks/${task._id}`, 'DELETE'); } catch { setTasks(previous); setError('Unable to delete task.'); }
        },
      },
    ]);
  }

  async function checkIn(visitId: string) {
    setVisitBusy(visitId);
    setError('');
    try {
      const position = await currentPosition();
      let photoUrl: string | undefined;
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.granted) {
        const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
        if (!shot.canceled) {
          const asset = shot.assets[0];
          const name = asset.fileName || generatedFileName('checkin');
          photoUrl = await uploadFile({ uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name) }, 'progress');
        }
      }
      const res = await partnerApi.call<{ visit?: Visit }>(`/execution/site-visits/${visitId}/check-in`, 'POST', { lat: position?.lat, lng: position?.lng, photoUrl });
      if (res.visit) setVisits(list => list.map(v => (v._id === visitId ? res.visit! : v)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check in to this visit.');
    } finally {
      setVisitBusy('');
    }
  }

  async function checkOut(visitId: string) {
    setVisitBusy(visitId);
    setError('');
    try {
      const position = await currentPosition();
      const res = await partnerApi.call<{ visit?: Visit }>(`/execution/site-visits/${visitId}/check-out`, 'POST', { lat: position?.lat, lng: position?.lng });
      if (res.visit) setVisits(list => list.map(v => (v._id === visitId ? res.visit! : v)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check out of this visit.');
    } finally {
      setVisitBusy('');
    }
  }

  const latestVersion = new Map<string, number>();
  documents.forEach(doc => latestVersion.set(doc.title, Math.max(latestVersion.get(doc.title) || 0, doc.version)));
  const inColumn = tasks.filter(task => task.status === column);

  if (loading) return <ActivityIndicator color={c.green} style={{ marginTop: 30 }} />;

  return (
    <View style={{ gap: 16 }}>
      {!!error && <ErrorText>{error}</ErrorText>}

      {actions.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.section}>Executive Attention & Next Steps</Text>
          {actions.map(action => {
            const tone = SEVERITY[action.severity] || SEVERITY.info;
            return (
              <View key={action.id} style={[s.action, { backgroundColor: tone.bg, borderLeftColor: tone.border }]}>
                <Text style={[s.actionLabel, { color: tone.fg }]}>{tone.label.toUpperCase()}</Text>
                <Text style={s.actionText}>{action.text}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={s.card}>
        <View style={s.head}>
          <Text style={s.section}>Task & Execution Board</Text>
          <Pressable style={s.addBtn} onPress={() => setSheet('task')}><Text style={s.addBtnText}>＋ Task</Text></Pressable>
        </View>
        <View style={s.segments}>
          {COLUMNS.map(item => (
            <Pressable key={item.id} style={[s.segment, column === item.id && s.segmentOn]} onPress={() => setColumn(item.id)}>
              <Text style={[s.segmentText, column === item.id && { color: '#fff' }]}>{item.label} {tasks.filter(task => task.status === item.id).length}</Text>
            </Pressable>
          ))}
        </View>
        {tasks.length === 0 ? <Text style={s.empty}>No tasks yet</Text> : inColumn.length === 0 ? <Text style={s.empty}>No tasks in this stage</Text> : inColumn.map(task => (
          <View key={task._id} style={s.task}>
            <View style={{ flex: 1 }}>
              <Text style={s.taskTitle}>{task.title}</Text>
              <Text style={s.taskMeta}>
                {[task.phase, task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : '', task.assignedToRole === 'client' ? 'Client' : task.assignedToRole === 'professional' ? 'Studio' : ''].filter(Boolean).join(' · ')}
              </Text>
              <View style={s.moveRow}>
                {COLUMNS.filter(item => item.id !== task.status).map(item => (
                  <Pressable key={item.id} style={s.move} onPress={() => void changeStatus(task._id, item.id)}><Text style={s.moveText}>→ {item.label}</Text></Pressable>
                ))}
              </View>
            </View>
            <Pressable onPress={() => confirmDelete(task)} hitSlop={8} accessibilityLabel="Delete task"><Text style={s.delete}>Delete</Text></Pressable>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <View style={s.head}>
          <Text style={s.section}>Site Visits & Audits</Text>
          <Pressable style={s.addBtn} onPress={() => setSheet('visit')}><Text style={s.addBtnText}>＋ Schedule</Text></Pressable>
        </View>
        {visits.length === 0 ? <Text style={s.empty}>No site visits scheduled yet</Text> : visits.map(visit => {
          const style = VISIT_STYLE[visit.status];
          return (
            <View key={visit._id} style={s.visit}>
              <View style={s.visitTop}>
                <Text style={s.taskTitle}>{new Date(visit.scheduledFor).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                <View style={[s.pill, { backgroundColor: style.bg }]}><Text style={[s.pillText, { color: style.fg }]}>{style.label}</Text></View>
              </View>
              {!!visit.purpose && <Text style={s.taskMeta}>{visit.purpose}</Text>}
              {!!visit.recurrence?.freq && visit.recurrence.freq !== 'none' && <Text style={s.taskMeta}>Repeats {visit.recurrence.freq}</Text>}
              {!!visit.checkIn?.at && <Text style={s.taskMeta}>Checked in {new Date(visit.checkIn.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>}
              {!!visit.checkOut?.at && <Text style={s.taskMeta}>Checked out {new Date(visit.checkOut.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>}
              {visit.status === 'scheduled' && (
                <Pressable style={s.solid} disabled={visitBusy === visit._id} onPress={() => void checkIn(visit._id)}>
                  {visitBusy === visit._id ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Check in at site</Text>}
                </Pressable>
              )}
              {visit.status === 'checked_in' && (
                <Pressable style={s.solid} disabled={visitBusy === visit._id} onPress={() => void checkOut(visit._id)}>
                  {visitBusy === visit._id ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Check out</Text>}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <View style={s.card}>
        <View style={s.head}>
          <Text style={s.section}>Site Progress Feed</Text>
          <Pressable style={s.addBtn} onPress={() => setSheet('progress')}><Text style={s.addBtnText}>＋ Update</Text></Pressable>
        </View>
        {entries.length === 0 ? <Text style={s.empty}>No site progress photos logged yet</Text> : entries.map(entry => (
          <View key={entry._id} style={s.entry}>
            <Text style={s.taskMeta}>{[entry.loggedByName, entry.phase, new Date(entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })].filter(Boolean).join(' · ')}</Text>
            {!!entry.caption && <Text style={s.taskTitle}>{entry.caption}</Text>}
            <View style={s.media}>{(entry.mediaUrls || []).map(uri => <Image key={uri} source={{ uri }} style={s.mediaImg} />)}</View>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <View style={s.head}>
          <Text style={s.section}>Design Documents & Blueprints</Text>
          <Pressable style={s.addBtn} onPress={() => setSheet('doc')}><Text style={s.addBtnText}>＋ Document</Text></Pressable>
        </View>
        {documents.length === 0 ? <Text style={s.empty}>No design documents submitted yet</Text> : documents.map(doc => {
          const style = DOC_STYLE[doc.status];
          const latest = latestVersion.get(doc.title) === doc.version;
          return (
            <View key={doc._id} style={s.visit}>
              <View style={s.visitTop}>
                <Text style={[s.taskTitle, { flex: 1 }]} numberOfLines={2}>{doc.title}</Text>
                <View style={[s.pill, { backgroundColor: style.bg }]}><Text style={[s.pillText, { color: style.fg }]}>{style.label}</Text></View>
              </View>
              <Text style={s.taskMeta}>{DOC_TYPE[doc.docType] || doc.docType} · v{doc.version}{latest ? ' · Latest' : ''}</Text>
              {!!doc.reviewerComment && <Text style={s.comment}>“{doc.reviewerComment}”</Text>}
              <Pressable onPress={() => void Linking.openURL(doc.fileUrl)}><Text style={s.link}>{doc.fileName || 'Open file'} ↗</Text></Pressable>
            </View>
          );
        })}
      </View>

      <TaskSheet visible={sheet === 'task'} projectId={projectId} onClose={() => setSheet(null)} onCreated={task => { setTasks(list => [task, ...list]); setColumn(task.status || 'todo'); setSheet(null); }} />
      <VisitSheet visible={sheet === 'visit'} projectId={projectId} onClose={() => setSheet(null)} onCreated={visit => { setVisits(list => [visit, ...list]); setSheet(null); }} />
      <ProgressSheet visible={sheet === 'progress'} projectId={projectId} onClose={() => setSheet(null)} onLogged={() => { setSheet(null); void load(); }} />
      <DocSheet visible={sheet === 'doc'} projectId={projectId} onClose={() => setSheet(null)} onCreated={doc => { setDocuments(list => [doc, ...list]); setSheet(null); }} />
    </View>
  );
}

function TaskSheet({ visible, projectId, onClose, onCreated }: { visible: boolean; projectId: string; onClose: () => void; onCreated: (task: Task) => void }) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState('');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState<'' | 'client' | 'professional'>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!title.trim()) { setError('Enter a task title.'); return; }
    let dueDate: string | undefined;
    if (due.trim()) {
      const parsed = parseWhen(due, '00:00');
      if (!parsed) { setError('Enter the due date as DD-MM-YYYY.'); return; }
      dueDate = parsed.toISOString();
    }
    setBusy(true);
    setError('');
    try {
      const res = await partnerApi.call<{ task?: Task }>(`/execution/projects/${projectId}/tasks`, 'POST', { title: title.trim(), phase: phase.trim() || undefined, dueDate, assignedToRole: assignee || undefined });
      if (res.task) { onCreated(res.task); setTitle(''); setPhase(''); setDue(''); setAssignee(''); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create task.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="New task" eyebrow="TASK & EXECUTION BOARD" onClose={onClose} locked={busy}>
      <Field label="TASK TITLE *" value={title} onChangeText={setTitle} placeholder="e.g. Install master bedroom custom wardrobes" />
      <Field label="PHASE" value={phase} onChangeText={setPhase} placeholder="e.g. Carpentry / Civil" />
      <Field label="DUE DATE (DD-MM-YYYY)" value={due} onChangeText={setDue} placeholder="25-12-2026" keyboardType="numbers-and-punctuation" />
      <Text style={s.label}>ASSIGNED TO</Text>
      <View style={s.optionRow}>
        {([['', 'Unassigned'], ['professional', 'Studio (Designer / Execution)'], ['client', 'Client (Homeowner)']] as const).map(([value, label]) => (
          <Pressable key={label} style={[s.option, assignee === value && s.optionOn]} onPress={() => setAssignee(value)}><Text style={[s.optionText, assignee === value && { color: '#fff' }]}>{label}</Text></Pressable>
        ))}
      </View>
      {!!error && <ErrorText>{error}</ErrorText>}
      <Pressable style={[s.solid, { marginTop: 16 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => void save()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Add Task</Text>}</Pressable>
    </Sheet>
  );
}

function VisitSheet({ visible, projectId, onClose, onCreated }: { visible: boolean; projectId: string; onClose: () => void; onCreated: (visit: Visit) => void }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [recurrence, setRecurrence] = useState<(typeof RECURRENCE)[number][0]>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const when = parseWhen(date, time);
    if (!when) { setError('Enter the date as DD-MM-YYYY and the time as HH:MM (24-hour).'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await partnerApi.call<{ visit?: Visit }>(`/execution/projects/${projectId}/site-visits`, 'POST', { scheduledFor: when.toISOString(), purpose: purpose.trim() || undefined, recurrenceFreq: recurrence });
      if (res.visit) { onCreated(res.visit); setDate(''); setTime(''); setPurpose(''); setRecurrence('none'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to schedule the site visit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Schedule a site visit" eyebrow="SITE VISITS & AUDITS" onClose={onClose} locked={busy}>
      <Field label="DATE (DD-MM-YYYY) *" value={date} onChangeText={setDate} placeholder="25-12-2026" keyboardType="numbers-and-punctuation" />
      <Field label="TIME (HH:MM, 24-HOUR) *" value={time} onChangeText={setTime} placeholder="14:30" keyboardType="numbers-and-punctuation" />
      <Field label="PURPOSE" value={purpose} onChangeText={setPurpose} placeholder="e.g. Electrical conduit inspection & woodwork measurements" />
      <Text style={s.label}>REPEATS</Text>
      <View style={s.optionRow}>
        {RECURRENCE.map(([value, label]) => (
          <Pressable key={value} style={[s.option, recurrence === value && s.optionOn]} onPress={() => setRecurrence(value)}><Text style={[s.optionText, recurrence === value && { color: '#fff' }]}>{label}</Text></Pressable>
        ))}
      </View>
      {!!error && <ErrorText>{error}</ErrorText>}
      <Pressable style={[s.solid, { marginTop: 16 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => void save()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Schedule Visit</Text>}</Pressable>
    </Sheet>
  );
}

function ProgressSheet({ visible, projectId, onClose, onLogged }: { visible: boolean; projectId: string; onClose: () => void; onLogged: () => void }) {
  const [caption, setCaption] = useState('');
  const [phase, setPhase] = useState('');
  const [files, setFiles] = useState<{ uri: string; name: string; mimeType: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = (assets: ImagePicker.ImagePickerAsset[]) => setFiles(list => [...list, ...assets.map(asset => {
    const name = asset.fileName || generatedFileName('progress');
    return { uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name) };
  })]);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (!result.canceled) add(result.assets);
  }
  async function shoot() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Allow camera access in Settings to take a photo.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled) add(result.assets);
  }

  async function post() {
    if (!files.length) { setError('Add at least one photo.'); return; }
    setBusy(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadFile(file, 'progress'));
      await partnerApi.call(`/execution/projects/${projectId}/progress`, 'POST', { mediaUrls: urls, caption: caption.trim() || undefined, phase: phase.trim() || undefined });
      setCaption(''); setPhase(''); setFiles([]);
      onLogged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to log the progress update.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Post a site update" eyebrow="SITE PROGRESS FEED" onClose={onClose} locked={busy}>
      <View style={s.optionRow}>
        <Pressable style={s.option} onPress={() => void pick()} disabled={busy}><Text style={s.optionText}>Choose photos</Text></Pressable>
        <Pressable style={s.option} onPress={() => void shoot()} disabled={busy}><Text style={s.optionText}>Take photo</Text></Pressable>
      </View>
      <View style={s.media}>
        {files.map((file, index) => (
          <View key={`${file.uri}-${index}`}>
            <Image source={{ uri: file.uri }} style={s.mediaImg} />
            <Pressable style={s.remove} disabled={busy} onPress={() => setFiles(list => list.filter((_, position) => position !== index))}><Text style={s.removeText}>×</Text></Pressable>
          </View>
        ))}
      </View>
      <Field label="EXECUTION PHASE" value={phase} onChangeText={setPhase} placeholder="e.g. False Ceiling, Civil Work, Electrical" />
      <Field label="CAPTION" value={caption} onChangeText={setCaption} placeholder="Describe what was accomplished on site today…" multiline style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }} />
      {!!error && <ErrorText>{error}</ErrorText>}
      <Pressable style={[s.solid, { marginTop: 8 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => void post()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Post Progress Update</Text>}</Pressable>
    </Sheet>
  );
}

function DocSheet({ visible, projectId, onClose, onCreated }: { visible: boolean; projectId: string; onClose: () => void; onCreated: (doc: DesignDoc) => void }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocType>('drawing');
  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string; size?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: normalizeMime(asset.mimeType, asset.name), size: asset.size });
  }

  async function submit() {
    if (!title.trim() || !file) { setError('Add a title and choose a file.'); return; }
    setBusy(true);
    setError('');
    try {
      const fileUrl = await uploadFile(file, 'design-documents');
      const res = await partnerApi.call<{ document?: DesignDoc }>(`/execution/projects/${projectId}/design-documents`, 'POST', { fileUrl, fileName: file.name, title: title.trim(), docType });
      if (res.document) { onCreated(res.document); setTitle(''); setFile(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit the design document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Submit a design document" eyebrow="DESIGN DOCUMENTS & BLUEPRINTS" onClose={onClose} locked={busy}>
      <Field label="DOCUMENT TITLE *" value={title} onChangeText={setTitle} placeholder="e.g. Master Bedroom 3D Visual, Kitchen Elevation" />
      <Text style={s.label}>DOCUMENT CATEGORY</Text>
      <View style={s.optionRow}>
        {(Object.keys(DOC_TYPE) as DocType[]).map(key => (
          <Pressable key={key} style={[s.option, docType === key && s.optionOn]} onPress={() => setDocType(key)}><Text style={[s.optionText, docType === key && { color: '#fff' }]}>{DOC_TYPE[key]}</Text></Pressable>
        ))}
      </View>
      <Pressable style={[s.pickFile, { marginTop: 14 }]} onPress={() => void pick()} disabled={busy}>
        <Text style={s.optionText}>{file ? `${file.name}${file.size ? ` · ${formatBytes(file.size)}` : ''}` : 'Select document'}</Text>
      </Pressable>
      {!!error && <ErrorText>{error}</ErrorText>}
      <Pressable style={[s.solid, { marginTop: 16 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => void submit()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>Submit Document</Text>}</Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  section: { color: c.ink, fontSize: 16, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addBtn: { backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { color: c.body, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  action: { borderRadius: 14, borderWidth: 1, borderColor: c.line, borderLeftWidth: 4, padding: 12, gap: 3 },
  actionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  actionText: { color: c.ink, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eef3f0' },
  segmentOn: { backgroundColor: c.green },
  segmentText: { color: c.body, fontSize: 12, fontWeight: '700' },
  task: { flexDirection: 'row', gap: 10, backgroundColor: '#f6f8f7', borderRadius: 14, padding: 12 },
  taskTitle: { color: c.ink, fontSize: 14, fontWeight: '800' },
  taskMeta: { color: c.body, fontSize: 12, marginTop: 2 },
  moveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  move: { borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 9, paddingVertical: 5 },
  moveText: { color: c.green, fontSize: 11, fontWeight: '800' },
  delete: { color: c.red, fontSize: 11.5, fontWeight: '800' },
  visit: { backgroundColor: '#f6f8f7', borderRadius: 14, padding: 12, gap: 4 },
  visitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  solid: { height: 46, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  entry: { backgroundColor: '#f6f8f7', borderRadius: 14, padding: 12, gap: 6 },
  media: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  mediaImg: { width: 96, height: 96, borderRadius: 12, backgroundColor: '#eef1ef' },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#fff', fontSize: 15, lineHeight: 17 },
  comment: { color: c.body, fontSize: 12.5, fontStyle: 'italic' },
  link: { color: c.green, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  label: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 999, borderWidth: 1.5, borderColor: c.line, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#fff' },
  optionOn: { backgroundColor: c.green, borderColor: c.green },
  optionText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  pickFile: { minHeight: 52, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b9c7c1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
