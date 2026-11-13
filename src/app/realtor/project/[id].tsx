import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SectionTitle, SelectChips, StatePanel, VerticalFrame } from '../../../components/vertical/VerticalUi';
import { Text } from '../../../components/AppText';
import { Data, MediaManager, REALTOR_TABS, SummaryHeader, asRows, errorText, formatPrice, idOf, locationText, nestedOf, toNum, toText } from '../../../components/realtor/RealtorShared';
import { realtorApi } from '../../../lib/partnerVerticalApi';

const PROJECT_TYPES = ['apartment', 'villa', 'independent_house', 'plot', 'farmhouse', 'commercial'];
const EDITABLE = ['draft', 'changes_requested'];
const emptyConfig = { name: '', propertyType: 'apartment', bhk: '', bedrooms: '', bathrooms: '', balconies: '', areaMin: '', areaMax: '', priceMin: '', priceMax: '', availableUnits: '' };
type ConfigForm = typeof emptyConfig;

const configToForm = (c: Data): ConfigForm => ({
  name: toText(c.name), propertyType: toText(c.propertyType) || 'apartment', bhk: toText(c.bhk), bedrooms: toText(c.bedrooms), bathrooms: toText(c.bathrooms), balconies: toText(c.balconies),
  areaMin: toText(c.area?.min), areaMax: toText(c.area?.max), priceMin: toText(c.price?.min), priceMax: toText(c.price?.max), availableUnits: toText(c.availableUnits),
});

export default function EditRealtorProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Data | null>(null);
  const [form, setForm] = useState({ name: '', projectType: 'apartment', description: '', city: '', locality: '', priceMin: '', priceMax: '', constructionStatus: 'pre_launch', reraNumber: '' });
  const [configs, setConfigs] = useState<Data[]>([]);
  const [configForm, setConfigForm] = useState<ConfigForm>(emptyConfig);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const set = (key: keyof typeof form) => (value: string) => { setNotice(''); setForm(current => ({ ...current, [key]: value })); };
  const setCfg = (key: keyof ConfigForm) => (value: string) => setConfigForm(current => ({ ...current, [key]: value }));

  const fill = (p: Data) => {
    setProject(p);
    setForm({ name: toText(p.name), projectType: toText(p.projectType) || 'apartment', description: toText(p.description), city: toText(p.location?.city), locality: toText(p.location?.locality),
      priceMin: toText(p.price?.min), priceMax: toText(p.price?.max), constructionStatus: toText(p.construction?.status) || 'pre_launch', reraNumber: toText(p.rera?.registrationNumber) });
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      fill(nestedOf(await realtorApi.projects('GET', undefined, String(id)), 'project'));
      setConfigs(asRows((await realtorApi.configurations(String(id))).configurations));
    } catch (cause) { setError(errorText(cause, 'Could not load this project.')); }
    finally { setLoading(false); }
  }, [id]);
  // Pre-fill the form from the server on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const editable = !!project && EDITABLE.includes(String(project.status));
  const status = toText(project?.status) || 'draft';

  async function save() {
    if (form.name.trim().length < 2) { setError('Enter a project name.'); return; }
    if (!form.city.trim() || !form.locality.trim()) { setError('Enter the project city and locality.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await realtorApi.projects('PUT', {
        name: form.name.trim(), projectType: form.projectType, description: form.description.trim(),
        // Location is replaced as a whole by the backend, so keep the existing pin and address fields.
        location: { ...(project?.location || {}), city: form.city.trim(), locality: form.locality.trim() },
        price: form.priceMin || form.priceMax ? { ...(project?.price || {}), min: toNum(form.priceMin), max: toNum(form.priceMax) } : undefined,
        construction: { ...(project?.construction || {}), status: form.constructionStatus },
        rera: form.reraNumber.trim() ? { ...(project?.rera || {}), applicable: true, registrationNumber: form.reraNumber.trim() } : undefined,
      }, String(id));
      fill(nestedOf(result, 'project')); setNotice('Project changes saved.');
    } catch (cause) { setError(errorText(cause, 'Could not save project changes.')); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setError(''); setNotice('');
    try { await realtorApi.submitProject(String(id)); await load(); setNotice('Project submitted for review.'); }
    catch (cause) { setError(errorText(cause, 'Could not submit project for review.')); }
    finally { setBusy(false); }
  }

  async function saveConfig() {
    if (!configForm.name.trim()) { setError('Enter a configuration name.'); return; }
    setBusy(true); setError(''); setNotice('');
    const payload: Data = {
      propertyType: configForm.propertyType, name: configForm.name.trim(), bhk: toNum(configForm.bhk), bedrooms: toNum(configForm.bedrooms), bathrooms: toNum(configForm.bathrooms), balconies: toNum(configForm.balconies),
      area: configForm.areaMin || configForm.areaMax ? { min: toNum(configForm.areaMin), max: toNum(configForm.areaMax), unit: 'sqft' } : undefined,
      price: configForm.priceMin || configForm.priceMax ? { min: toNum(configForm.priceMin), max: toNum(configForm.priceMax) } : undefined,
      availableUnits: toNum(configForm.availableUnits),
    };
    try {
      if (editingConfig && editingConfig !== 'new') await realtorApi.configurations(String(id), 'PUT', payload, editingConfig);
      else await realtorApi.configurations(String(id), 'POST', { ...payload, projectId: String(id) });
      setEditingConfig(null); setConfigForm(emptyConfig);
      setConfigs(asRows((await realtorApi.configurations(String(id))).configurations)); setNotice('Configuration saved.');
    } catch (cause) { setError(errorText(cause, 'Could not save configuration.')); }
    finally { setBusy(false); }
  }

  function removeConfig(config: Data) {
    Alert.alert('Delete configuration', `Delete “${toText(config.name) || 'this configuration'}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try { await realtorApi.configurations(String(id), 'DELETE', undefined, idOf(config)); setConfigs(current => current.filter(item => idOf(item) !== idOf(config))); }
        catch (cause) { setError(errorText(cause, 'Could not delete configuration.')); }
        finally { setBusy(false); }
      } },
    ]);
  }

  const priceRange = project?.price ? [formatPrice(project.price.min), formatPrice(project.price.max)].filter(Boolean).join(' – ') : '';
  return <VerticalFrame title="Edit project" subtitle="REALTY HUB" tabs={REALTOR_TABS} activeTab="more" onTab={key => router.replace(`/realtor/dashboard?tab=${key === 'dashboard' ? 'overview' : key}` as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="EDIT PROJECT" title={toText(project?.name) || 'Project'} subtitle="Update project details, photos and available configurations." />
    {loading ? <StatePanel title="Loading project" message="Fetching the latest saved details…" /> : null}
    {error ? <StatePanel title={project ? 'Project update failed' : 'Could not load project'} message={error} retry={project ? undefined : () => void load()} /> : null}
    {notice ? <Panel tint><Text style={{ color: '#17684b', fontWeight: '700', fontSize: 12 }}>{notice}</Text></Panel> : null}
    {project ? <>
      <SummaryHeader title={toText(project.name) || 'Project'} location={locationText(project)} price={priceRange || undefined} status={status} extra={toText(project.projectType).replaceAll('_', ' ')} />
      {project.moderationNote ? <Panel><DataRow title="Reviewer note" detail={toText(project.moderationNote)} /></Panel> : null}
      {editable ? <Panel>
        <Field label="Project name" value={form.name} onChangeText={set('name')} />
        <SelectChips label="Project type" values={PROJECT_TYPES} selected={form.projectType} onChange={value => set('projectType')(String(value))} />
        <Field label="City" value={form.city} onChangeText={set('city')} />
        <Field label="Locality" value={form.locality} onChangeText={set('locality')} />
        <Field label="Description" value={form.description} onChangeText={set('description')} multiline />
        <SelectChips label="Construction status" values={['pre_launch', 'under_construction', 'ready_to_move']} selected={form.constructionStatus} onChange={value => set('constructionStatus')(String(value))} />
        <Field label="Minimum price (₹)" value={form.priceMin} onChangeText={set('priceMin')} keyboardType="numeric" />
        <Field label="Maximum price (₹)" value={form.priceMax} onChangeText={set('priceMax')} keyboardType="numeric" />
        <Field label="RERA registration number" value={form.reraNumber} onChangeText={set('reraNumber')} />
        <PrimaryButton title="Save changes" onPress={() => void save()} loading={busy} />
        <SecondaryButton title="Submit for review" onPress={() => void submit()} />
      </Panel> : <Panel><Text style={{ color: '#4d5f57', fontSize: 12, lineHeight: 18 }}>This project is “{status.replaceAll('_', ' ')}”, so its details can’t be edited right now. Projects can only be changed while they are a draft or when changes have been requested. Configurations below can still be updated.</Text></Panel>}
      <MediaManager resourceType="project" resourceId={String(id)} />
      <SectionTitle title="Configurations" action={editingConfig ? undefined : <SecondaryButton title="＋ Add" onPress={() => { setConfigForm(emptyConfig); setEditingConfig('new'); }} />} />
      {!configs.length && !editingConfig ? <StatePanel title="No configurations yet" message="Add the unit types (for example 2 BHK) buyers can choose from." /> : null}
      {configs.map(config => <Panel key={idOf(config)}>
        <DataRow title={toText(config.name) || 'Configuration'} detail={[config.bhk ? `${toText(config.bhk)} BHK` : '', config.availableUnits != null ? `${toText(config.availableUnits)} available` : '', config.price?.min ? formatPrice(config.price.min) : ''].filter(Boolean).join(' · ')} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><SecondaryButton title="Edit" onPress={() => { setConfigForm(configToForm(config)); setEditingConfig(idOf(config)); }} /></View>
          <View style={{ flex: 1 }}><SecondaryButton title="Delete" onPress={() => removeConfig(config)} /></View>
        </View>
      </Panel>)}
      {editingConfig ? <Panel>
        <Text style={{ fontWeight: '800', fontSize: 14, color: '#10231c' }}>{editingConfig === 'new' ? 'New configuration' : 'Edit configuration'}</Text>
        <Field label="Configuration name" value={configForm.name} onChangeText={setCfg('name')} />
        <SelectChips label="Property type" values={PROJECT_TYPES} selected={configForm.propertyType} onChange={value => setCfg('propertyType')(String(value))} />
        <Field label="Bedrooms (BHK)" value={configForm.bhk} onChangeText={setCfg('bhk')} keyboardType="numeric" />
        <Field label="Bedrooms" value={configForm.bedrooms} onChangeText={setCfg('bedrooms')} keyboardType="numeric" />
        <Field label="Bathrooms" value={configForm.bathrooms} onChangeText={setCfg('bathrooms')} keyboardType="numeric" />
        <Field label="Balconies" value={configForm.balconies} onChangeText={setCfg('balconies')} keyboardType="numeric" />
        <Field label="Minimum area (sq ft)" value={configForm.areaMin} onChangeText={setCfg('areaMin')} keyboardType="numeric" />
        <Field label="Maximum area (sq ft)" value={configForm.areaMax} onChangeText={setCfg('areaMax')} keyboardType="numeric" />
        <Field label="Minimum price (₹)" value={configForm.priceMin} onChangeText={setCfg('priceMin')} keyboardType="numeric" />
        <Field label="Maximum price (₹)" value={configForm.priceMax} onChangeText={setCfg('priceMax')} keyboardType="numeric" />
        <Field label="Available units" value={configForm.availableUnits} onChangeText={setCfg('availableUnits')} keyboardType="numeric" />
        <PrimaryButton title="Save configuration" onPress={() => void saveConfig()} loading={busy} disabled={!configForm.name.trim()} />
        <SecondaryButton title="Cancel" onPress={() => { setEditingConfig(null); setConfigForm(emptyConfig); }} />
      </Panel> : null}
    </> : null}
  </VerticalFrame>;
}
