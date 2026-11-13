import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, StatePanel, VerticalFrame } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { realtorApi } from '../../lib/partnerVerticalApi';

const tabs = [{ key: 'overview', label: 'Overview', icon: '⌂' }, { key: 'properties', label: 'Properties', icon: '▦' }, { key: 'listings', label: 'Listings', icon: '▤' }, { key: 'leads', label: 'Leads', icon: '◎' }, { key: 'more', label: 'Realty', icon: '•••' }];
type RecordData = Record<string, any>;
const empty = { name: '', description: '', headquarters: '', website: '', email: '', phone: '', establishedYear: '', operatingCities: '' };
const itemId = (value: any) => String(value?._id || value?.id || value || '');

export default function RealtorDeveloperScreen() {
  const [developer, setDeveloper] = useState<RecordData | null>(null);
  const [isOwner, setOwner] = useState(false);
  const [form, setForm] = useState(empty);
  const [agentId, setAgentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof empty) => (value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await realtorApi.developer.get();
      const dev = response.developer && typeof response.developer === 'object' ? response.developer as RecordData : null;
      setDeveloper(dev); setOwner(response.isOwner === true);
      if (dev) setForm({ name: dev.name || '', description: dev.description || '', headquarters: dev.headquarters || '', website: dev.website || '', email: dev.email || '', phone: dev.phone || '', establishedYear: dev.establishedYear ? String(dev.establishedYear) : '', operatingCities: Array.isArray(dev.operatingCities) ? dev.operatingCities.join(', ') : '' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load developer profile.'); }
    finally { setLoading(false); }
  }, []);
  // Load the server-owned developer profile on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!form.name.trim()) { setError('Enter the developer company name.'); return; }
    setBusy(true); setError('');
    const payload = { name: form.name.trim(), description: form.description, headquarters: form.headquarters, website: form.website, email: form.email, phone: form.phone, establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined, operatingCities: form.operatingCities.split(',').map(v => v.trim()).filter(Boolean) };
    try {
      const response = developer ? await realtorApi.developer.update(itemId(developer), payload) : await realtorApi.developer.create(payload);
      setDeveloper(response.developer as RecordData); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save developer profile.'); }
    finally { setBusy(false); }
  }
  async function agentAction(revoke = false, id = agentId) {
    if (!developer || !id.trim()) return;
    setBusy(true); setError('');
    try {
      const response = revoke ? await realtorApi.developer.revokeAgent(itemId(developer), id.trim()) : await realtorApi.developer.authorizeAgent(itemId(developer), id.trim());
      setDeveloper(response.developer as RecordData); setAgentId('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update authorized agents.'); }
    finally { setBusy(false); }
  }
  return <VerticalFrame title="Developer profile" subtitle="REALTY HUB" tabs={tabs} activeTab="more" onTab={key => router.replace(`/realtor/dashboard?tab=${key === 'dashboard' ? 'overview' : key}` as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="COMPANY PROFILE" title={developer ? 'Developer profile' : 'Create developer profile'} subtitle="Buyers see these company details on your projects." />
    {error ? <StatePanel title="Developer profile could not be saved" message={error} retry={() => void load()} /> : null}
    {loading ? <Panel><Text>Loading developer profile…</Text></Panel> : <>
      <Panel>
        <Field label="Company / developer name" value={form.name} onChangeText={set('name')} />
        <Field label="Company description" value={form.description} onChangeText={set('description')} multiline />
        <Field label="Headquarters" value={form.headquarters} onChangeText={set('headquarters')} />
        <Field label="Website" value={form.website} onChangeText={set('website')} />
        <Field label="Public email" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
        <Field label="Public phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Established year" value={form.establishedYear} onChangeText={set('establishedYear')} keyboardType="numeric" />
        <Field label="Operating cities (comma separated)" value={form.operatingCities} onChangeText={set('operatingCities')} />
        <PrimaryButton title={developer ? 'Save developer profile' : 'Create developer profile'} onPress={() => void save()} loading={busy} disabled={!isOwner && !!developer} />
        {!isOwner && developer ? <Text style={{ color: '#7b8a83', fontSize: 12 }}>An authorized agent can use this developer profile but cannot edit it.</Text> : null}
      </Panel>
      {developer && <Panel><Text style={{ fontSize: 16, fontWeight: '800' }}>Authorized agents</Text>
        {(developer.authorizedAgentIds || []).map((agent: any) => <View key={itemId(agent)}><DataRow title={agent.fullName || agent.name || itemId(agent)} detail={agent.email || agent.phone} /><PrimaryButton title="Revoke access" onPress={() => void agentAction(true, itemId(agent))} loading={busy} /></View>)}
        {isOwner ? <><Field label="Agent realtor account ID" value={agentId} onChangeText={setAgentId} /><PrimaryButton title="Authorize agent" onPress={() => void agentAction()} loading={busy} disabled={!agentId.trim()} /></> : <Text style={{ color: '#7b8a83' }}>Only the owning developer account can manage access.</Text>}
      </Panel>}
      {developer ? <PrimaryButton title="Manage projects & units" onPress={() => router.push('/realtor/project/new' as never)} /> : null}
    </>}
  </VerticalFrame>;
}
