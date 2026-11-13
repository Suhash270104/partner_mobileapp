import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CashfreeCheckout } from '../../../components/studio/CashfreeCheckout';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SelectChips, StatePanel, VerticalFrame, palette } from '../../../components/vertical/VerticalUi';
import { Text } from '../../../components/AppText';
import { PartnerApiError, CashfreeOrder, partnerApi } from '../../../lib/partnerApi';
import { realtorApi } from '../../../lib/partnerVerticalApi';

const TABS = [{ key: 'overview', label: 'Overview', icon: '⌂' }, { key: 'properties', label: 'Properties', icon: '▦' }, { key: 'listings', label: 'Listings', icon: '▤' }, { key: 'leads', label: 'Leads', icon: '♧' }, { key: 'more', label: 'Realty', icon: '•••' }];
const PROJECT_TYPES = ['apartment', 'villa', 'independent_house', 'plot', 'farmhouse', 'commercial'];
const empty = { name: '', projectType: 'apartment', city: '', locality: '', description: '', priceMin: '', priceMax: '', minArea: '', maxArea: '', constructionStatus: 'pre_launch', reraNumber: '' };
type Data = Record<string, unknown>;
const rowsOf = (response: Data, key: string): Data[] => Array.isArray(response[key]) ? response[key] as Data[] : [];
const nested = (response: Data, key: string): Data => response[key] && typeof response[key] === 'object' ? response[key] as Data : response;
const getId = (value: Data) => String(value._id || value.id || '');

export default function RealtorProjectsScreen() {
  const [projects, setProjects] = useState<Data[]>([]);
  const [profile, setProfile] = useState<Data | null>(null);
  const [developer, setDeveloper] = useState<Data | null>(null);
  const [packs, setPacks] = useState<Data[]>([]);
  const [form, setForm] = useState(empty);
  const [configForm, setConfigForm] = useState({ name: '', propertyType: 'apartment', bhk: '', bedrooms: '', bathrooms: '', balconies: '', areaMin: '', areaMax: '', priceMin: '', priceMax: '', availableUnits: '' });
  const [configurations, setConfigurations] = useState<Data[]>([]);
  const [selectedProject, setSelectedProject] = useState<Data | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [order, setOrder] = useState<CashfreeOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creditMessage, setCreditMessage] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    try {
      const [profileResponse, projectResponse, developerResponse] = await Promise.all([realtorApi.profile(), realtorApi.projects(), realtorApi.developer.get()]);
      setProfile(nested(profileResponse, 'realtor'));
      setProjects(rowsOf(projectResponse, 'projects'));
      const dev = developerResponse.developer;
      setDeveloper(dev && typeof dev === 'object' ? dev as Data : null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load realtor projects.'); }
    finally { setLoading(false); }
  }, []);
  // Load developer, project and credit data from the backend on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function openCreditPacks() {
    setCreditsOpen(true); setError('');
    try {
      const result = await partnerApi.call<Data>('/pricing');
      setPacks(rowsOf(result, 'realEstateListingPacks'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load listing packs.'); }
  }

  async function buyPack(pack: Data) {
    setBusy(true); setError('');
    try {
      const created = await partnerApi.createCashfreeOrder({ itemType: 'REAL_ESTATE_LISTING_PACK', itemId: String(pack.id || pack._id) });
      setOrder(created as CashfreeOrder);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not begin checkout.'); }
    finally { setBusy(false); }
  }

  async function finishCheckout() {
    const currentOrder = order;
    setOrder(null);
    if (!currentOrder) return;
    setBusy(true);
    try {
      const result = await partnerApi.call<{ success: boolean; status: string }>('/payments/cashfree/verify', 'POST', { orderId: currentOrder.orderId });
      setCreditMessage(result.status === 'PAID' ? 'Payment received. Your listing credits are available.' : `Payment status: ${result.status.toLowerCase()}.`);
      if (result.status === 'PAID') { setCreditsOpen(false); await load(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not verify payment status.'); }
    finally { setBusy(false); }
  }

  async function createDeveloper() {
    if (!form.name.trim()) { setError('Enter the developer company name.'); return; }
    setBusy(true); setError('');
    try {
      const result = await realtorApi.developer.create({ name: form.name.trim(), operatingCities: form.city ? [form.city.trim()] : [] });
      setDeveloper(nested(result, 'developer'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create developer profile.'); }
    finally { setBusy(false); }
  }

  async function createProject() {
    setBusy(true); setError('');
    try {
      if (!developer) throw new Error('Create your developer profile first.');
      if (Number(profile?.listingQuota || 0) <= 0) { await openCreditPacks(); return; }
      const result = await realtorApi.projects('POST', {
        developerId: getId(developer), name: form.name.trim(), projectType: form.projectType,
        location: { city: form.city.trim(), locality: form.locality.trim() }, description: form.description.trim() || undefined,
        price: form.priceMin || form.priceMax ? { min: form.priceMin ? Number(form.priceMin) : undefined, max: form.priceMax ? Number(form.priceMax) : undefined } : undefined,
        minArea: form.minArea ? Number(form.minArea) : undefined, maxArea: form.maxArea ? Number(form.maxArea) : undefined,
        construction: { status: form.constructionStatus }, rera: form.reraNumber ? { applicable: true, registrationNumber: form.reraNumber } : undefined,
      });
      const created = nested(result, 'project');
      setProjects(current => [created, ...current]); setForm(empty); await load();
    } catch (cause) { setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not create project.'); }
    finally { setBusy(false); }
  }

  async function openConfigurations(project: Data) {
    setSelectedProject(project); setError('');
    try { const result = await realtorApi.configurations(getId(project)); setConfigurations(rowsOf(result, 'configurations')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load project configurations.'); }
  }

  async function addConfiguration() {
    if (!selectedProject) return;
    setBusy(true); setError('');
    try {
      const result = await realtorApi.configurations(getId(selectedProject), 'POST', {
        projectId: getId(selectedProject), propertyType: configForm.propertyType, name: configForm.name.trim(),
        bhk: configForm.bhk ? Number(configForm.bhk) : undefined, bedrooms: configForm.bedrooms ? Number(configForm.bedrooms) : undefined,
        bathrooms: configForm.bathrooms ? Number(configForm.bathrooms) : undefined, balconies: configForm.balconies ? Number(configForm.balconies) : undefined,
        area: configForm.areaMin || configForm.areaMax ? { min: configForm.areaMin ? Number(configForm.areaMin) : undefined, max: configForm.areaMax ? Number(configForm.areaMax) : undefined, unit: 'sqft' } : undefined,
        price: configForm.priceMin || configForm.priceMax ? { min: configForm.priceMin ? Number(configForm.priceMin) : undefined, max: configForm.priceMax ? Number(configForm.priceMax) : undefined } : undefined,
        availableUnits: configForm.availableUnits ? Number(configForm.availableUnits) : undefined,
      });
      const configuration = nested(result, 'configuration');
      setConfigurations(current => [...current, configuration]);
      setConfigForm({ name: '', propertyType: 'apartment', bhk: '', bedrooms: '', bathrooms: '', balconies: '', areaMin: '', areaMax: '', priceMin: '', priceMax: '', availableUnits: '' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add project configuration.'); }
    finally { setBusy(false); }
  }

  async function submitProject(project: Data) {
    setBusy(true); setError('');
    try { await realtorApi.submitProject(getId(project)); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit project for review.'); }
    finally { setBusy(false); }
  }

  return <VerticalFrame title="Projects" subtitle="REALTY HUB" tabs={TABS} activeTab="more" onTab={key => key === 'overview' ? router.push('/realtor/dashboard') : router.push('/realtor/dashboard')} onBack={() => router.back()}>
    <PageHeading eyebrow="DEVELOPER WORKSPACE" title="Projects" subtitle="Create a development, add available configurations and submit it for review." action={<Text style={s.creditBadge}>{String(profile?.listingQuota ?? '—')} credits</Text>} />
    {error ? <StatePanel title="Workspace update failed" message={error} retry={() => void load()} /> : null}
    {creditMessage ? <Panel tint><Text style={s.creditCopy}>{creditMessage}</Text></Panel> : null}
    {!developer ? <Panel>
      <Text style={s.sectionTitle}>Developer profile</Text><Text style={s.copy}>Create your developer identity before adding a project.</Text>
      <Field label="Company / developer name" value={form.name} onChangeText={set('name')} />
      <Field label="Operating city" value={form.city} onChangeText={set('city')} />
      <PrimaryButton title="Create developer profile" onPress={() => void createDeveloper()} loading={busy} />
    </Panel> : <Panel><DataRow title={String(developer.name || 'Developer profile')} detail={String(developer.slug || '')} status={String(developer.verificationStatus || 'pending')} /></Panel>}
    <Panel>
      <Text style={s.sectionTitle}>New project</Text>
      <Field label="Project name" value={form.name} onChangeText={set('name')} />
      <SelectChips label="Project type" values={PROJECT_TYPES} selected={form.projectType} onChange={value => set('projectType')(String(value))} />
      <Field label="City" value={form.city} onChangeText={set('city')} />
      <Field label="Locality" value={form.locality} onChangeText={set('locality')} />
      <Field label="Description" value={form.description} onChangeText={set('description')} multiline />
      <SelectChips label="Construction status" values={['pre_launch', 'under_construction', 'ready_to_move']} selected={form.constructionStatus} onChange={value => set('constructionStatus')(String(value))} />
      <Field label="Minimum price (₹)" value={form.priceMin} onChangeText={set('priceMin')} keyboardType="numeric" />
      <Field label="Maximum price (₹)" value={form.priceMax} onChangeText={set('priceMax')} keyboardType="numeric" />
      <Field label="Minimum area (sq ft)" value={form.minArea} onChangeText={set('minArea')} keyboardType="numeric" />
      <Field label="Maximum area (sq ft)" value={form.maxArea} onChangeText={set('maxArea')} keyboardType="numeric" />
      <Field label="RERA registration number" value={form.reraNumber} onChangeText={set('reraNumber')} />
      {Number(profile?.listingQuota || 0) <= 0 ? <SecondaryButton title="Buy listing credits" onPress={() => void openCreditPacks()} /> : null}
      <PrimaryButton title="Create project draft" onPress={() => void createProject()} loading={busy} disabled={!developer || !form.name.trim() || !form.city.trim() || !form.locality.trim()} />
    </Panel>
    <PageHeading title="Saved projects" subtitle={loading ? 'Loading projects…' : `${projects.length} projects`} />
    {!loading && !error && projects.length === 0 ? <StatePanel title="No projects yet" message="Your project drafts and published projects will appear here." /> : projects.map(project => <Panel key={getId(project)}>
      <DataRow title={String(project.name || 'Project')} detail={[String(project.projectType || ''), String((project.location as Data | undefined)?.city || '')].filter(Boolean).join(' · ')} status={String(project.status || 'draft')} />
      <View style={s.actions}><View style={{ flex: 1 }}><SecondaryButton title="Configurations" onPress={() => void openConfigurations(project)} /></View>{['draft', 'changes_requested'].includes(String(project.status)) ? <View style={{ flex: 1 }}><PrimaryButton title="Submit" onPress={() => void submitProject(project)} loading={busy} /></View> : null}</View>
    </Panel>)}
    <Modal visible={!!selectedProject} animationType="slide" transparent onRequestClose={() => setSelectedProject(null)}>
      <View style={s.backdrop}><View style={s.modal}>
        <View style={s.modalHeader}><Text style={s.modalTitle}>{String(selectedProject?.name || 'Project configurations')}</Text><Pressable onPress={() => setSelectedProject(null)}><Text style={s.close}>×</Text></Pressable></View>
        {configurations.map(config => <DataRow key={getId(config)} title={String(config.name || config.propertyType || 'Configuration')} detail={[config.bhk ? `${String(config.bhk)} BHK` : '', config.availableUnits ? `${String(config.availableUnits)} available` : ''].filter(Boolean).join(' · ')} status={String(config.status || '') || undefined} />)}
        <Field label="Configuration name" value={configForm.name} onChangeText={value => setConfigForm(current => ({ ...current, name: value }))} />
        <SelectChips label="Property type" values={PROJECT_TYPES} selected={configForm.propertyType} onChange={value => setConfigForm(current => ({ ...current, propertyType: String(value) }))} />
        <Field label="Bedrooms (BHK)" value={configForm.bhk} onChangeText={value => setConfigForm(current => ({ ...current, bhk: value }))} keyboardType="numeric" />
        <Field label="Bedrooms" value={configForm.bedrooms} onChangeText={value => setConfigForm(current => ({ ...current, bedrooms: value }))} keyboardType="numeric" />
        <Field label="Bathrooms" value={configForm.bathrooms} onChangeText={value => setConfigForm(current => ({ ...current, bathrooms: value }))} keyboardType="numeric" />
        <Field label="Balconies" value={configForm.balconies} onChangeText={value => setConfigForm(current => ({ ...current, balconies: value }))} keyboardType="numeric" />
        <Field label="Area min / max (sq ft)" value={configForm.areaMin} onChangeText={value => setConfigForm(current => ({ ...current, areaMin: value }))} keyboardType="numeric" />
        <Field label="Area maximum (sq ft)" value={configForm.areaMax} onChangeText={value => setConfigForm(current => ({ ...current, areaMax: value }))} keyboardType="numeric" />
        <Field label="Available units" value={configForm.availableUnits} onChangeText={value => setConfigForm(current => ({ ...current, availableUnits: value }))} keyboardType="numeric" />
        <PrimaryButton title="Add configuration" onPress={() => void addConfiguration()} loading={busy} disabled={!configForm.name.trim() || !selectedProject} />
        <SecondaryButton title="Close" onPress={() => setSelectedProject(null)} />
      </View></View>
    </Modal>
    <Modal visible={creditsOpen} animationType="slide" transparent onRequestClose={() => setCreditsOpen(false)}>
      <View style={s.backdrop}><View style={s.modal}>
        <View style={s.modalHeader}><Text style={s.modalTitle}>Listing credit packs</Text><Pressable onPress={() => setCreditsOpen(false)}><Text style={s.close}>×</Text></Pressable></View>
        <Text style={s.copy}>Each property or project listing uses a credit. Packs and prices come from Kraftnex pricing.</Text>
        {packs.map(pack => <Panel key={String(pack.id || pack._id)}><DataRow title={String(pack.name || '')} detail={`${String(pack.credits || '')} listings · ₹${String(pack.price || '')}`} status={pack.badge ? String(pack.badge) : undefined} /><PrimaryButton title="Buy pack" onPress={() => void buyPack(pack)} loading={busy} /></Panel>)}
        {!packs.length && !error ? <StatePanel title="No listing packs available" message="Kraftnex has not published any listing packs right now." /> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </View></View>
    </Modal>
    <CashfreeCheckout order={order} onClose={() => void finishCheckout()} />
  </VerticalFrame>;
}

const s = StyleSheet.create({ creditBadge: { color: palette.green, backgroundColor: palette.greenSoft, fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 }, sectionTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, copy: { color: palette.body, fontSize: 12, lineHeight: 18 }, creditCopy: { color: palette.greenText, fontSize: 12, fontWeight: '700' }, actions: { flexDirection: 'row', gap: 8 }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,35,28,0.48)' }, modal: { maxHeight: '90%', backgroundColor: palette.bg, padding: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 10 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', flex: 1 }, close: { color: palette.muted, fontSize: 28 }, error: { color: palette.red, fontSize: 12 } });
