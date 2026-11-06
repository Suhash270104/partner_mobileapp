import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../../components/AppText';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { OpenClientProject, partnerApi } from '../../../lib/partnerApi';
import { generatedFileName, normalizeMime, uploadStudioFile } from '../../../lib/professionalOnboarding';
import { c, ErrorText, Field } from '../../../components/professional/onboardingUi';
import { Sheet } from '../../../components/studio/Sheet';
import { useStudio } from '../../../components/studio/StudioContext';

// Same limits and option lists as the desktop "Add New Project" form.
const MIN_PROJECT_IMAGES = 5;
const MAX_PROJECT_IMAGES = 10;
const MAX_IMAGE_MB = 20;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const PROPERTY_TYPES = ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Healthcare', 'Industrial', 'Landscape', 'Renovation'];
const SERVICE_TYPES = ['Interior Design', 'Architecture', 'Turnkey Execution', 'Design + Build', 'Modular Setup'];
const BUDGET_CATEGORIES = [
  { id: 'Standard', label: 'Standard (Up to ₹15 L)' },
  { id: 'Premium', label: 'Premium (₹15 L – ₹30 L)' },
  { id: 'Elite', label: 'Elite (Above ₹30 L)' },
];
const STATUSES = ['In Progress', 'Completed', 'Draft'];

type Filter = 'all' | 'in_progress' | 'completed' | 'draft';
interface Row { id: string; title: string; status: 'In Progress' | 'Completed' | 'Draft'; location: string; budget: string; duration: string; tags: string[]; img: string; client: string }

const clean = (value: string) => String(value || '').toLowerCase().replace(/\s+/g, '');

function toRow(item: OpenClientProject & { clientName?: string; tags?: string[]; serviceType?: string; galleryImages?: { main?: string }; images?: string[]; portfolioImages?: string[] }): Row {
  const status = clean(item.status || 'In Progress');
  const display = status === 'completed' || status === 'closed' ? 'Completed'
    : ['draft', 'submitted', 'underreview', 'shortlisted', 'open'].includes(status) ? 'Draft' : 'In Progress';
  return {
    id: String(item.id || item._id || ''),
    title: item.title || 'Untitled Project',
    status: display,
    location: item.location || [item.locality, item.city].filter(Boolean).join(', ') || item.city || '',
    budget: item.budgetRange || item.budgetCategory || '',
    duration: item.timeline || '',
    tags: Array.isArray(item.tags) && item.tags.length ? item.tags : [item.propertyType, item.serviceType].filter(Boolean) as string[],
    img: item.previewThumbnail || item.galleryImages?.main || item.images?.[0] || item.portfolioImages?.[0] || '',
    client: item.clientName || '',
  };
}

const emptyForm = { title: '', propertyType: '', serviceType: '', clientName: '', location: '', budgetCategory: '', budgetRange: '', areaSqFt: '', timeline: '', status: 'In Progress', description: '', tags: '' };

export default function ProjectsScreen() {
  const { profile } = useStudio();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const id = profile._id;
      let list: OpenClientProject[] = id ? await partnerApi.assignedStudioProjects(id).catch(() => []) : [];
      if (!Array.isArray(list) || list.length === 0) list = await partnerApi.assignedStudioProjectsMe().catch(() => []);
      const seen = new Set<string>();
      setRows((Array.isArray(list) ? list : []).filter(item => {
        const key = String(item.id || item._id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map(toRow));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your projects.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile._id]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const inProgress = rows.filter(r => r.status === 'In Progress').length;
  const completed = rows.filter(r => r.status === 'Completed').length;
  const drafts = rows.filter(r => r.status === 'Draft').length;
  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => {
    const tab = filter === 'all' ? true : filter === 'in_progress' ? r.status === 'In Progress' : filter === 'completed' ? r.status === 'Completed' : r.status === 'Draft';
    return tab && (!q || r.title.toLowerCase().includes(q) || r.location.toLowerCase().includes(q) || r.client.toLowerCase().includes(q));
  });
  const tabs: [Filter, string, number][] = [['all', 'All', rows.length], ['in_progress', 'In Progress', inProgress], ['completed', 'Completed', completed], ['draft', 'Draft', drafts]];

  return (
    <View style={s.flex}>
      <ScrollView style={s.flex} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.green} />}>
        <View style={s.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Projects</Text>
            <Text style={s.sub}>{rows.length} total · {inProgress} in progress, {completed} completed{drafts > 0 ? `, ${drafts} draft${drafts === 1 ? '' : 's'}` : ''}</Text>
          </View>
          <Pressable style={s.add} onPress={() => setAdding(true)}><Text style={s.addText}>＋ New Project</Text></Pressable>
        </View>

        <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search by project, client or place…" placeholderTextColor="#98a59f" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {tabs.map(([key, label, count]) => (
            <Pressable key={key} style={[s.tab, filter === key && s.tabOn]} onPress={() => setFilter(key)}>
              <Text style={[s.tabText, filter === key && { color: '#fff' }]}>{label} {count}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.stats}>
          {[['Total Projects', rows.length, c.greenSoft], ['In Progress', inProgress, '#e9f1fb'], ['Completed', completed, c.greenSoft], ['Drafts', drafts, '#fbf1e4']].map(([label, value, tint]) => (
            <View key={label as string} style={[s.stat, { backgroundColor: tint as string }]}><Text style={s.statValue}>{value as number}</Text><Text style={s.statLabel}>{label as string}</Text></View>
          ))}
        </View>

        {loading && <ActivityIndicator color={c.green} style={{ marginTop: 20 }} />}
        {!!error && <ErrorText>{error}</ErrorText>}
        {!loading && !error && shown.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{rows.length === 0 ? 'No projects yet' : 'No projects match'}</Text>
            {rows.length === 0 && <Pressable style={s.addSolid} onPress={() => setAdding(true)}><Text style={s.addText}>Add First Project</Text></Pressable>}
          </View>
        )}

        {shown.map(row => (
          <Pressable key={row.id} style={s.card} onPress={() => router.navigate({ pathname: '/professional/project-details', params: { id: row.id } } as never)}>
            {!!row.img && <Image source={{ uri: row.img }} style={s.image} />}
            <View style={s.badgeWrap}><Text style={[s.badge, row.status === 'Completed' ? s.badgeDone : row.status === 'Draft' ? s.badgeDraft : s.badgeLive]}>{row.status}</Text></View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle} numberOfLines={2}>{row.title}</Text>
              {!!row.client && <Text style={s.meta}>Client: {row.client}</Text>}
              {!!row.location && <Text style={s.meta} numberOfLines={1}>{row.location}</Text>}
              <View style={s.facts}>
                <View style={s.fact}><Text style={s.factLabel}>BUDGET</Text><Text style={s.factValue} numberOfLines={1}>{row.budget || '—'}</Text></View>
                <View style={s.fact}><Text style={s.factLabel}>TIMELINE</Text><Text style={s.factValue} numberOfLines={1}>{row.duration || '—'}</Text></View>
              </View>
              {row.tags.length > 0 && <Text style={s.tags} numberOfLines={1}>{row.tags.join('  ·  ')}</Text>}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <AddProjectSheet visible={adding} designerId={profile._id} studioName={profile.companyName || profile.businessName || ''} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); void load(); }} />
    </View>
  );
}

function AddProjectSheet({ visible, designerId, studioName, onClose, onCreated }: { visible: boolean; designerId?: string; studioName: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<{ uri: string; name: string; mimeType: string; size?: number | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const set = (key: keyof typeof emptyForm) => (value: string) => { setError(''); setForm(previous => ({ ...previous, [key]: value })); };

  function close() {
    if (busy) return;
    setForm(emptyForm);
    setImages([]);
    setError('');
    onClose();
  }

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9, selectionLimit: MAX_PROJECT_IMAGES });
    if (result.canceled) return;
    const rejected: string[] = [];
    const accepted: typeof images = [];
    for (const asset of result.assets) {
      const name = asset.fileName || generatedFileName('project');
      const mimeType = normalizeMime(asset.mimeType, name);
      if (!ACCEPTED.includes(mimeType)) { rejected.push(`${name} (not a JPG, PNG, WEBP or AVIF image)`); continue; }
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_MB * 1024 * 1024) { rejected.push(`${name} (over ${MAX_IMAGE_MB}MB)`); continue; }
      if ([...images, ...accepted].some(item => item.name === name && item.size === asset.fileSize)) continue;
      accepted.push({ uri: asset.uri, name, mimeType, size: asset.fileSize });
    }
    const room = MAX_PROJECT_IMAGES - images.length;
    const admitted = accepted.slice(0, Math.max(0, room));
    const notices: string[] = [];
    if (rejected.length) notices.push(`Skipped ${rejected.join(', ')}`);
    if (accepted.length > admitted.length) notices.push(`Only ${MAX_PROJECT_IMAGES} images allowed — ${accepted.length - admitted.length} not added`);
    setError(notices.join('. '));
    if (admitted.length) setImages(previous => [...previous, ...admitted]);
  }

  async function submit() {
    if (!form.title.trim()) { setError('Enter a project title.'); return; }
    const missing = [!form.propertyType && 'property type', !form.serviceType && 'service type', !form.location.trim() && 'location', !form.budgetCategory && 'budget category', !form.budgetRange.trim() && 'budget range', !form.areaSqFt.trim() && 'area', !form.timeline.trim() && 'timeline'].filter(Boolean);
    if (missing.length) { setError(`Fill in: ${missing.join(', ')}.`); return; }
    if (images.length < MIN_PROJECT_IMAGES) { setError(`Add at least ${MIN_PROJECT_IMAGES} images — you have ${images.length}.`); return; }
    setBusy(true);
    setError('');
    try {
      // Upload first: if storage fails, no half-made project is left pointing at images that never landed.
      const urls: string[] = [];
      const failed: string[] = [];
      for (let index = 0; index < images.length; index += 1) {
        setProgress(`Uploading ${index + 1} of ${images.length}…`);
        try { urls.push(await uploadStudioFile(images[index] as { uri: string; name: string; mimeType: string; size?: number | null }, 'designerPortfolioProject')); } catch { failed.push(images[index].name); }
      }
      if (failed.length) {
        setError(`${failed.length} image${failed.length > 1 ? 's' : ''} failed to upload (${failed.join(', ')}). Nothing was saved — remove or replace them and try again.`);
        return;
      }
      const tags = form.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      await partnerApi.createStudioProject({
        title: form.title.trim(),
        propertyType: form.propertyType,
        serviceType: form.serviceType,
        clientName: form.clientName.trim() || studioName,
        location: form.location.trim(),
        city: form.location.split(',').pop()?.trim() || form.location.trim(),
        budgetCategory: form.budgetCategory,
        budgetRange: form.budgetRange.trim(),
        areaSqFt: form.areaSqFt.trim(),
        timeline: form.timeline.trim(),
        status: form.status,
        description: form.description.trim() || form.title.trim(),
        previewThumbnail: urls[0],
        galleryImages: { main: urls[0], others: urls.slice(1) },
        tags,
        projectType: 'professional',
        designerId: designerId || undefined,
      });
      setForm(emptyForm);
      setImages([]);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? `Could not create the project. ${e.message}` : 'Could not create the project. Please try again.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  const options = (label: string, key: keyof typeof emptyForm, items: { id: string; label: string }[]) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.formLabel}>{label}</Text>
      <View style={s.optionRow}>
        {items.map(item => (
          <Pressable key={item.id} style={[s.option, form[key] === item.id && s.optionOn]} onPress={() => set(key)(item.id)}>
            <Text style={[s.optionText, form[key] === item.id && { color: '#fff' }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} title="Add New Project" eyebrow="PORTFOLIO" onClose={close} locked={busy}>
      <Field label="PROJECT TITLE *" value={form.title} onChangeText={set('title')} placeholder="e.g. Jubilee Hills 4BHK Luxury Villa Execution" />
      {options('PROPERTY TYPE *', 'propertyType', PROPERTY_TYPES.map(t => ({ id: t, label: t })))}
      {options('SERVICE TYPE *', 'serviceType', SERVICE_TYPES.map(t => ({ id: t, label: t })))}
      <Field label="CLIENT NAME" value={form.clientName} onChangeText={set('clientName')} placeholder="e.g. Mr. Rajesh Kumar / Private Client" />
      <Field label="LOCATION *" value={form.location} onChangeText={set('location')} placeholder="e.g. Jubilee Hills, Hyderabad" />
      {options('BUDGET CATEGORY *', 'budgetCategory', BUDGET_CATEGORIES)}
      <Field label="BUDGET RANGE *" value={form.budgetRange} onChangeText={set('budgetRange')} placeholder="e.g. ₹50 L – ₹1 Cr" />
      <Field label="AREA *" value={form.areaSqFt} onChangeText={set('areaSqFt')} placeholder="e.g. 3,500 sq.ft" />
      <Field label="TIMELINE *" value={form.timeline} onChangeText={set('timeline')} placeholder="e.g. 3 - 4 Months" />
      {options('STATUS', 'status', STATUSES.map(t => ({ id: t, label: t })))}
      <Field label="DESCRIPTION" value={form.description} onChangeText={set('description')} multiline placeholder="Describe key design features, materials used, lighting, home automation…" style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }} />
      <Field label="TAGS (COMMA SEPARATED)" value={form.tags} onChangeText={set('tags')} placeholder="Turnkey, Villa" />

      <Text style={s.formLabel}>PROJECT IMAGES * ({images.length}/{MAX_PROJECT_IMAGES}, minimum {MIN_PROJECT_IMAGES})</Text>
      <View style={s.thumbs}>
        {images.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={s.thumb}>
            <Image source={{ uri: image.uri }} style={s.thumbImg} />
            <Pressable style={s.thumbRemove} disabled={busy} onPress={() => setImages(previous => previous.filter((_, position) => position !== index))}><Text style={s.thumbRemoveText}>×</Text></Pressable>
          </View>
        ))}
        {images.length < MAX_PROJECT_IMAGES && <Pressable style={s.thumbAdd} disabled={busy} onPress={() => void pick()}><Text style={s.thumbAddText}>＋</Text></Pressable>}
      </View>
      {!!progress && <Text style={s.sub}>{progress}</Text>}
      {!!error && <ErrorText>{error}</ErrorText>}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Pressable style={[s.cancel, { flex: 1 }]} onPress={close} disabled={busy}><Text style={s.cancelText}>Cancel</Text></Pressable>
        <Pressable style={[s.addSolid, { flex: 1.5 }, busy && { opacity: 0.6 }]} onPress={() => void submit()} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.addText}>Create Project</Text>}
        </Pressable>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 12.5, marginTop: 2 },
  add: { backgroundColor: c.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  addSolid: { height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  addText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  search: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, color: c.ink, fontSize: 14.5 },
  tabs: { gap: 8, paddingVertical: 14 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: c.line },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, borderRadius: 12, padding: 10, minHeight: 64, justifyContent: 'space-between' },
  statValue: { color: c.ink, fontSize: 22, fontWeight: '800' },
  statLabel: { color: c.body, fontSize: 9.5, fontWeight: '700' },
  empty: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: c.line, padding: 24, alignItems: 'center', gap: 12 },
  emptyTitle: { color: c.ink, fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, marginBottom: 14, overflow: 'hidden' },
  image: { width: '100%', height: 170, backgroundColor: '#eef1ef' },
  badgeWrap: { position: 'absolute', top: 10, left: 10 },
  badge: { overflow: 'hidden', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 10.5, fontWeight: '800', color: '#fff' },
  badgeLive: { backgroundColor: '#c0562c' },
  badgeDone: { backgroundColor: c.green },
  badgeDraft: { backgroundColor: c.amber },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { color: c.ink, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  meta: { color: c.body, fontSize: 12.5 },
  facts: { flexDirection: 'row', gap: 8, marginTop: 4 },
  fact: { flex: 1, backgroundColor: '#f1f5f3', borderRadius: 11, padding: 9 },
  factLabel: { color: c.muted, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  factValue: { color: c.ink, fontSize: 12.5, fontWeight: '800', marginTop: 2 },
  tags: { color: c.greenText, fontSize: 12, fontWeight: '700' },
  formLabel: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 999, borderWidth: 1.5, borderColor: c.line, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#fff' },
  optionOn: { backgroundColor: c.green, borderColor: c.green },
  optionText: { color: c.body, fontSize: 12.5, fontWeight: '700' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  thumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eef1ef' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 16, lineHeight: 18 },
  thumbAdd: { width: '31%', aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b9c7c1', alignItems: 'center', justifyContent: 'center' },
  thumbAddText: { color: c.green, fontSize: 26 },
  cancel: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: c.green, fontSize: 14, fontWeight: '800' },
});
