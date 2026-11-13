import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/AppText';
import * as ImagePicker from 'expo-image-picker';
import { partnerApi } from '../../../lib/partnerApi';
import {
  AVAILABLE_CITIES, BUDGET_OPTIONS, COMM_OPTIONS, DIFFERENTIATOR_OPTIONS, ENGAGEMENT_OPTIONS, establishedYears, EXPERTISE_OPTIONS,
  generatedFileName, INDUSTRY_OPTIONS, INVOLVEMENT_OPTIONS, normalizeMime, OPERATING_CITIES, OPERATION_TYPES, PROJECT_CAPACITY_OPTIONS,
  PROPERTY_OPTIONS, ROLES, SERVICE_OPTIONS, SIZE_OPTIONS, SPECIALIZATION_OPTIONS, SUPPORT_OPTIONS, TEAM_FIELDS, TIER_OPTIONS,
  TIMELINE_OPTIONS, uploadStudioFile, WORK_MODELS, WORK_MODES,
} from '../../../lib/professionalOnboarding';
import { c, ErrorText, Field } from '../../../components/professional/onboardingUi';
import { EditableRow } from '../../../components/studio/EditableRow';
import { Sheet } from '../../../components/studio/Sheet';
import { useStudio } from '../../../components/studio/StudioContext';

type Doc = Record<string, unknown>;

const WORK_MODEL_LABELS: Record<string, string> = { self: 'Self (Individual Professional)', registered: 'Company Registered', unregistered: 'Not Registered Company' };
const SIZE_LABELS = Object.fromEntries(SIZE_OPTIONS.map(item => [item.id, item.label]));
const VERIFICATION_DOCS = [
  { id: 'gst', name: 'GST Certificate', required: true }, { id: 'pan', name: 'PAN Card', required: true }, { id: 'registration', name: 'Business Registration', required: true },
  { id: 'license', name: 'Professional License' }, { id: 'insurance', name: 'Insurance Certificate' }, { id: 'awards', name: 'Awards & Recognition' },
  { id: 'certifications', name: 'Professional Certifications' }, { id: 'officePhotos', name: 'Office / Studio Photos' }, { id: 'teamPhotos', name: 'Team Photos' }, { id: 'other', name: 'Other Documents' },
];

export default function ProfileScreen() {
  const { profile, studioName: contextName, patchProfile } = useStudio();
  // The dashboard's own merge: saved onboarding answers underneath, the studio record on top.
  const [data, setData] = useState<Doc>(() => ({ ...((profile.onboardingData || {}) as Doc), ...(profile as unknown as Doc) }));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const get = <T,>(key: string) => data[key] as T | undefined;
  const studioName = (get<string>('businessName') || get<string>('companyName') || contextName || 'Professional Studio');
  const role = get<string>('role') || 'Architect & Interior Designer';
  const city = get<string[]>('cities')?.[0] || get<string[]>('primaryCities')?.[0] || get<string>('city') || '';
  const experience = get<number>('experience');
  const approved = Boolean(get<boolean>('isApproved'));
  const images = get<string[]>('portfolioImages') || [];
  const verified = (get<Record<string, unknown>>('verifiedDocs') || {});
  const team = (get<Record<string, number>>('team') || {});
  const tags = [...(get<string[]>('primaryExpertise') || []), ...(get<string[]>('industries') || []), ...(get<string[]>('specializations') || []), ...(get<string[]>('propertyTypes') || [])].slice(0, 6);

  const save = useCallback(async (field: string, value: unknown) => {
    const res = await partnerApi.updateStudioProfile({ [field]: value }) as { designer?: Doc };
    setData(previous => ({ ...previous, ...(res.designer || {}), [field]: value }));
    patchProfile({ [field]: value } as never);
  }, [patchProfile]);

  const row = (label: string, field: string, type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean', extra: { options?: string[]; optionLabels?: Record<string, string>; placeholder?: string; value?: unknown; saveAs?: string } = {}) => (
    <EditableRow key={field + label} label={label} type={type} value={extra.value !== undefined ? extra.value : data[field]} options={extra.options} optionLabels={extra.optionLabels} placeholder={extra.placeholder} onSave={value => save(extra.saveAs || field, value)} />
  );

  async function addImages() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (result.canceled) return;
    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        const name = asset.fileName || generatedFileName('portfolio');
        urls.push((await partnerApi.uploadMedia({ uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name) }, 'portfolios')).publicUrl);
      }
      await save('portfolioImages', [...images, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload image');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    Alert.alert('Remove image?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void save('portfolioImages', images.filter((_, position) => position !== index)).catch(e => setError(e instanceof Error ? e.message : 'Unable to remove image')); } },
    ]);
  }

  const processSteps = get<string[]>('processSteps') || [];
  const websiteLinks: [string, string][] = [['Website', 'websiteUrl'], ['Instagram', 'instagramUrl'], ['Behance / Pinterest', 'behanceUrl'], ['YouTube', 'youtubeUrl']];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}>
      <Text style={s.title}>Profile & Portfolio</Text>
      <Text style={s.sub}>How clients see {studioName}</Text>

      <View style={s.identity}>
        <View style={s.badges}>
          <View style={s.badge}><Text style={s.badgeText}>{get<string>('tier') || get<string>('membershipLevel') || 'Standard'} Member</Text></View>
          <View style={[s.badge, approved ? s.badgeGood : s.badgeWait]}><Text style={[s.badgeText, { color: approved ? c.greenText : c.amber }]}>{approved ? 'Verified Pro' : 'Pending Review'}</Text></View>
        </View>
        <View style={s.logo}><Text style={s.logoText}>{studioName.slice(0, 2).toUpperCase()}</Text></View>
        <Text style={s.name}>{studioName}</Text>
        <Text style={s.meta}>{[city, typeof experience === 'number' ? `${experience} ${experience === 1 ? 'Year' : 'Years'} Industry Experience` : '', role].filter(Boolean).join('  •  ')}</Text>
        {tags.length > 0 && <View style={s.tags}>{tags.map(tag => <View key={tag} style={s.tag}><Text style={s.tagText}>{tag}</Text></View>)}</View>}
        <Text style={s.hint}>Every field below is editable — tap a value to change it.</Text>
      </View>

      {!!error && <ErrorText>{error}</ErrorText>}

      <View style={s.card}>
        <Text style={s.cardTitle}>Portfolio</Text>
        {images.length === 0 ? <Text style={s.empty}>No portfolio images uploaded yet.</Text> : (
          <View style={s.grid}>
            {images.map((uri, index) => (
              <View key={`${uri}-${index}`} style={s.thumb}>
                <Image source={{ uri }} style={s.thumbImg} />
                <Pressable style={s.thumbRemove} onPress={() => removeImage(index)} accessibilityLabel="Remove image"><Text style={s.thumbRemoveText}>×</Text></Pressable>
              </View>
            ))}
          </View>
        )}
        <Pressable style={s.solid} disabled={uploading} onPress={() => void addImages()}>{uploading ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>＋ Add Images</Text>}</Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Identity</Text>
        {row('Work Model', 'workModel', 'select', { options: WORK_MODELS.map(item => item.id), optionLabels: WORK_MODEL_LABELS })}
        {row('Role', 'role', 'select', { options: ROLES })}
        {row('Operating Structure', 'operationType', 'select', { options: OPERATION_TYPES })}
        {row('Business Name', 'companyName', 'text', { value: studioName })}
        {row('Established Year', 'establishedYear', 'select', { options: establishedYears() })}
        {row('Experience (Years)', 'experience', 'number')}
        {row('Cities Served', 'cities', 'multiselect', { options: AVAILABLE_CITIES })}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Business DNA</Text>
        {row('Primary Expertise', 'primaryExpertise', 'multiselect', { options: EXPERTISE_OPTIONS })}
        {row('Industries', 'industries', 'multiselect', { options: INDUSTRY_OPTIONS })}
        {row('Property Types', 'propertyTypes', 'multiselect', { options: PROPERTY_OPTIONS })}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Expertise & Pricing</Text>
        {row('Services Offered', 'services', 'multiselect', { options: SERVICE_OPTIONS, value: get('services') || get('servicesOffered') })}
        {row('Specializations', 'specializations', 'multiselect', { options: SPECIALIZATION_OPTIONS })}
        {row('Budget Ranges', 'budgetRanges', 'multiselect', { options: BUDGET_OPTIONS })}
        {row('Studio Tier', 'tier', 'select', { options: TIER_OPTIONS.map(item => item.id), value: get('tier') || get('membershipLevel') })}
        {row('Typical Project Size', 'projectSize', 'select', { options: SIZE_OPTIONS.map(item => item.id), optionLabels: SIZE_LABELS })}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Links & Presence</Text>
        {websiteLinks.map(([label, field]) => row(label, field, 'text', { placeholder: 'https://…' }))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Operations</Text>
        {TEAM_FIELDS.map(item => (
          <EditableRow key={item.field} label={item.field === 'siteEngineers' ? 'Site / Project Engineers' : item.label} type="number" value={team[item.field]} onSave={value => save('team', { ...team, [item.field]: Number(value) || 0 })} />
        ))}
        {row('Simultaneous Projects', 'simultaneousProjects', 'select', { options: PROJECT_CAPACITY_OPTIONS })}
        {row('Typical Project Timeline', 'projectTimeline', 'select', { options: TIMELINE_OPTIONS })}
        {row('Client Work Mode', 'clientWorkMode', 'select', { options: WORK_MODES })}
        {row('Primary Operating Cities', 'primaryCities', 'multiselect', { options: OPERATING_CITIES })}
        {row('Willing to Travel', 'willingToTravel', 'boolean')}
        {row('Preferred Engagement', 'preferredEngagement', 'select', { options: ENGAGEMENT_OPTIONS })}
        {row('After-Project Support', 'afterProjectSupport', 'select', { options: SUPPORT_OPTIONS })}
        {row('In-House Manufacturing', 'inHouseManufacturing', 'boolean')}
        {row('Warranty Provided', 'warrantyProvided', 'boolean')}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Client Process</Text>
        {row('Communication Channels', 'commChannels', 'multiselect', { options: COMM_OPTIONS })}
        {row('Client Involvement', 'clientInvolvement', 'select', { options: INVOLVEMENT_OPTIONS })}
        {row('What Sets You Apart', 'differentiators', 'multiselect', { options: DIFFERENTIATOR_OPTIONS })}
        {processSteps.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={s.label}>PROJECT PROCESS FLOW</Text>
            <Text style={s.value}>{processSteps.join('  →  ')}</Text>
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Verification</Text>
        <Text style={s.hint}>Document status only — managed separately from admin-reviewed verification, not editable here.</Text>
        <View style={s.docGrid}>
          {VERIFICATION_DOCS.map(doc => {
            const uploaded = Boolean(verified[doc.id]);
            return (
              <View key={doc.id} style={[s.doc, uploaded && s.docOn]}>
                <Text style={[s.docText, uploaded && { color: c.greenText }]}>{uploaded ? '✓' : '○'} {doc.name}{doc.required && !uploaded ? ' *' : ''}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <SubmissionsPanel />

      {!!get<string>('_id') && (
        <Pressable style={s.outline} onPress={() => { const base = process.env.EXPO_PUBLIC_PUBLIC_SITE_URL?.replace(/\/+$/, ''); if (base) void Linking.openURL(`${base}/professionals/profile?id=${get<string>('_id')}`); }}>
          <Text style={s.outlineText}>Preview Public Profile  ↗</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// Designer-submitted showcase projects, hidden from the public profile until an admin approves them.
interface Submission {
  _id: string; title: string; rejectionReason?: string; status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description?: string; projectCity?: string; images?: string[]; propertyType?: string; areaSqFt?: string | number; budget?: string; style?: string; timeline?: string;
  spaces?: string[]; materials?: string[]; servicesDelivered?: string[];
}
const SUBMISSION_STYLE = { PENDING: { bg: c.amberSoft, fg: c.amber, icon: '◷' }, APPROVED: { bg: c.mint, fg: c.greenText, icon: '✓' }, REJECTED: { bg: c.redSoft, fg: c.red, icon: '✕' } };
const emptyForm = { title: '', description: '', projectCity: '', propertyType: '', areaSqFt: '', budget: '', style: '', timeline: '', spaces: '', materials: '', services: '' };

function SubmissionsPanel() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await partnerApi.call<{ projects?: Submission[] }>('/professional/portfolio-projects');
      setItems(Array.isArray(res.projects) ? res.projects : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Unable to load portfolio submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const set = (key: keyof typeof emptyForm) => (value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const list = (text: string) => text.split(',').map(item => item.trim()).filter(Boolean);

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
    if (result.canceled) return;
    setBusy(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        const name = asset.fileName || generatedFileName('submission');
        urls.push(await uploadStudioFile({ uri: asset.uri, name, mimeType: normalizeMime(asset.mimeType, name), size: asset.fileSize }, 'designerPortfolioProject'));
      }
      setImages(previous => [...previous, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload image');
    } finally {
      setBusy(false);
    }
  }

  function openEdit(item: Submission) {
    setError('');
    setEditingId(item._id);
    setForm({
      title: item.title || '', description: item.description || '', projectCity: item.projectCity || '', propertyType: item.propertyType || '',
      areaSqFt: item.areaSqFt != null ? String(item.areaSqFt) : '', budget: item.budget || '', style: item.style || '', timeline: item.timeline || '',
      spaces: (item.spaces || []).join(', '), materials: (item.materials || []).join(', '), services: (item.servicesDelivered || []).join(', '),
    });
    setImages(item.images || []);
    setOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) { setError('Enter a project title.'); return; }
    setBusy(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(), description: form.description, projectCity: form.projectCity, images,
        propertyType: form.propertyType, areaSqFt: form.areaSqFt, budget: form.budget, style: form.style, timeline: form.timeline,
        spaces: list(form.spaces), materials: list(form.materials), servicesDelivered: list(form.services),
      };
      if (editingId) await partnerApi.call(`/professional/portfolio-projects/${editingId}`, 'PUT', payload);
      else await partnerApi.call('/professional/portfolio-projects', 'POST', payload);
      setForm(emptyForm); setImages([]); setEditingId(''); setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit project');
    } finally {
      setBusy(false);
    }
  }

  function remove(item: Submission) {
    Alert.alert('Remove this project submission?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await partnerApi.call(`/professional/portfolio-projects/${item._id}`, 'DELETE');
            setItems(previous => previous.filter(p => p._id !== item._id));
          } catch (e) {
            setLoadError(e instanceof Error ? e.message : 'Unable to remove this project');
          }
        },
      },
    ]);
  }

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.cardTitle}>Portfolio Project Submissions</Text>
        <Pressable style={s.addSmall} onPress={() => { setError(''); setEditingId(''); setForm(emptyForm); setImages([]); setOpen(true); }}><Text style={s.addSmallText}>＋ Submit</Text></Pressable>
      </View>
      <Text style={s.hint}>Showcase projects go live on your public profile only after admin approval.</Text>
      {loading && <ActivityIndicator color={c.green} />}
      {!!loadError && <View style={{ gap: 6 }}><ErrorText>{loadError}</ErrorText><Pressable onPress={() => void load()}><Text style={s.link}>Retry</Text></Pressable></View>}
      {!loading && !loadError && items.length === 0 && <Text style={s.empty}>No portfolio projects submitted yet.</Text>}
      {items.map(item => {
        const tone = SUBMISSION_STYLE[item.status] || SUBMISSION_STYLE.PENDING;
        return (
          <View key={item._id} style={[s.submission, { backgroundColor: tone.bg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.submissionTitle, { color: tone.fg }]}>{tone.icon}  {item.title}</Text>
              {item.status === 'REJECTED' && !!item.rejectionReason && <Text style={s.hint}>Reason: {item.rejectionReason}</Text>}
            </View>
            {item.status !== 'APPROVED' && <Pressable onPress={() => openEdit(item)} hitSlop={8}><Text style={s.link}>Edit</Text></Pressable>}
            <Pressable onPress={() => remove(item)} hitSlop={8}><Text style={s.delete}>Remove</Text></Pressable>
          </View>
        );
      })}

      <Sheet visible={open} title={editingId ? 'Edit portfolio project' : 'Submit a portfolio project'} eyebrow={editingId ? 'RE-QUEUED FOR REVIEW ON SAVE' : 'FOR ADMIN REVIEW'} onClose={() => setOpen(false)} locked={busy}>
        <Field label="PROJECT TITLE *" value={form.title} onChangeText={set('title')} placeholder="Project title" />
        <Field label="SHORT DESCRIPTION" value={form.description} onChangeText={set('description')} placeholder="Short description" multiline style={{ minHeight: 70, textAlignVertical: 'top', paddingTop: 12 }} />
        <Field label="CITY" value={form.projectCity} onChangeText={set('projectCity')} placeholder="City" />
        <Field label="PROPERTY TYPE" value={form.propertyType} onChangeText={set('propertyType')} placeholder="e.g. Apartment" />
        <Field label="AREA" value={form.areaSqFt} onChangeText={set('areaSqFt')} placeholder="e.g. 2,100 sq.ft." />
        <Field label="PROJECT BUDGET" value={form.budget} onChangeText={set('budget')} placeholder="e.g. ₹27L" />
        <Field label="DESIGN STYLE" value={form.style} onChangeText={set('style')} placeholder="e.g. Modern Contemporary" />
        <Field label="TIMELINE" value={form.timeline} onChangeText={set('timeline')} placeholder="e.g. 6 months" />
        <Field label="SPACES DELIVERED (COMMA SEPARATED)" value={form.spaces} onChangeText={set('spaces')} placeholder="Living, Kitchen, Master Bedroom" />
        <Field label="MATERIALS USED (COMMA SEPARATED)" value={form.materials} onChangeText={set('materials')} placeholder="Wood, Stone, Glass" />
        <Field label="SERVICES DELIVERED (COMMA SEPARATED)" value={form.services} onChangeText={set('services')} placeholder="Interior Design, Execution" />
        <Text style={s.label}>IMAGES ({images.length})</Text>
        <View style={s.grid}>{images.map((uri, index) => <View key={`${uri}-${index}`} style={s.thumb}><Image source={{ uri }} style={s.thumbImg} /><Pressable style={s.thumbRemove} onPress={() => setImages(previous => previous.filter((_, position) => position !== index))}><Text style={s.thumbRemoveText}>×</Text></Pressable></View>)}</View>
        <Pressable style={s.outline} disabled={busy} onPress={() => void pick()}><Text style={s.outlineText}>＋ Add images</Text></Pressable>
        {!!error && <ErrorText>{error}</ErrorText>}
        <Pressable style={[s.solid, { marginTop: 12 }, (busy || !form.title.trim()) && { opacity: 0.6 }]} disabled={busy || !form.title.trim()} onPress={() => void submit()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.solidText}>{editingId ? 'Save & Resubmit' : 'Submit for Review'}</Text>}</Pressable>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 14 },
  title: { color: c.ink, fontSize: 28, fontWeight: '800' },
  sub: { color: c.body, fontSize: 13 },
  identity: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 16, alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  badge: { backgroundColor: '#eef3f0', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  badgeGood: { backgroundColor: c.mint },
  badgeWait: { backgroundColor: c.amberSoft },
  badgeText: { color: c.green, fontSize: 11, fontWeight: '800' },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  name: { color: c.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  meta: { color: c.body, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  tag: { backgroundColor: c.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: c.greenText, fontSize: 11, fontWeight: '700' },
  hint: { color: c.body, fontSize: 12.5, lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 4 },
  cardTitle: { color: c.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  empty: { color: c.body, fontSize: 13, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  thumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eef1ef' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 16, lineHeight: 18 },
  solid: { height: 48, borderRadius: 13, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  solidText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  outline: { height: 48, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  outlineText: { color: c.green, fontSize: 14, fontWeight: '800' },
  label: { color: c.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  value: { color: c.ink, fontSize: 13.5, fontWeight: '700', marginTop: 2, lineHeight: 20 },
  docGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  doc: { width: '48.5%', borderRadius: 11, borderWidth: 1, borderColor: c.line, backgroundColor: '#f6f8f7', padding: 10 },
  docOn: { backgroundColor: c.greenSoft, borderColor: '#bfe0cf' },
  docText: { color: c.muted, fontSize: 11.5, fontWeight: '700' },
  addSmall: { backgroundColor: c.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addSmallText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  link: { color: c.green, fontSize: 13, fontWeight: '800' },
  submission: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, padding: 12, marginTop: 6 },
  submissionTitle: { fontSize: 13.5, fontWeight: '800' },
  delete: { color: c.red, fontSize: 11.5, fontWeight: '800' },
});
