import { REALTOR_TABS } from '../../../components/realtor/RealtorShared';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SelectChips, StatePanel, VerticalFrame, palette } from '../../../components/vertical/VerticalUi';
import { ListingCreditsSheet } from '../../../components/realtor/ListingCreditsSheet';
import { Text } from '../../../components/AppText';
import { PartnerApiError } from '../../../lib/partnerApi';
import { realtorApi } from '../../../lib/partnerVerticalApi';

const TABS = REALTOR_TABS;
type Data = Record<string, unknown>;
const list = (data: Data, key: string) => Array.isArray(data[key]) ? data[key] as Data[] : [];
const id = (row: Data) => String(row._id || row.id || '');
const title = (row: Data) => String(row.title || row.name || row.projectName || row.propertyType || 'Untitled');
const nested = (data: Data, key: string) => data[key] && typeof data[key] === 'object' ? data[key] as Data : data;

export default function NewRealtorListingScreen() {
  const [properties, setProperties] = useState<Data[]>([]);
  const [projects, setProjects] = useState<Data[]>([]);
  const [listings, setListings] = useState<Data[]>([]);
  const [profile, setProfile] = useState<Data | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [context, setContext] = useState<'property' | 'project'>('property');
  const [purpose, setPurpose] = useState('sale');
  const [transaction, setTransaction] = useState('resale');
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creditsOpen, setCreditsOpen] = useState(false);
  const setContactField = (key: keyof typeof contact) => (value: string) => setContact(current => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    try {
      const [profileResponse, propertyResponse, projectResponse, listingResponse] = await Promise.all([realtorApi.profile(), realtorApi.properties(), realtorApi.projects(), realtorApi.listings()]);
      const current = nested(profileResponse, 'realtor');
      setProfile(current);
      setProperties(list(propertyResponse, 'properties'));
      setProjects(list(projectResponse, 'projects'));
      setListings(list(listingResponse, 'listings'));
      setContact({ name: String(current.fullName || ''), phone: String(current.phone || ''), email: String(current.email || '') });
    } catch (cause) { setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not load listing data.'); }
    finally { setLoading(false); }
  }, []);
  // Load listing source records on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const entities = context === 'property' ? properties : projects;

  async function createListing() {
    if (!selectedId) { setError('Select a saved property or project.'); return; }
    if (!contact.name.trim() || !contact.phone.trim()) { setError('Add the public contact name and phone number for this listing.'); return; }
    setBusy(true); setError('');
    try {
      if (Number(profile?.listingQuota || 0) <= 0) { setCreditsOpen(true); return; }
      const result = await realtorApi.listings('POST', {
        ...(context === 'property' ? { propertyId: selectedId } : { projectId: selectedId }),
        listingPurpose: purpose,
        transactionType: purpose === 'rent' ? 'resale' : transaction,
        contact: { name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim() || undefined },
      });
      const listing = nested(result, 'listing');
      setListings(current => [listing, ...current]);
      setSelectedId(''); await load();
    } catch (cause) { setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not create listing.'); }
    finally { setBusy(false); }
  }

  async function submitListing(row: Data) {
    setBusy(true); setError('');
    try { await realtorApi.submitListing(id(row)); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit listing for review.'); }
    finally { setBusy(false); }
  }

  return <VerticalFrame title="Listings" subtitle="MARKETPLACE" tabs={TABS} activeTab="listings" onTab={key => router.replace(`/realtor/dashboard?tab=${key === 'dashboard' ? 'overview' : key}` as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="YOUR MARKETPLACE INVENTORY" title="Published listings" subtitle={loading ? 'Loading your listing data…' : `${listings.length} listings · ${String(profile?.listingQuota ?? '—')} credits`} />
    {error ? <StatePanel title="Listing request failed" message={error} retry={() => void load()} /> : null}
    <Panel>
      <Text style={s.sectionTitle}>Create listing</Text>
      <SelectChips label="List a" values={['property', 'project']} selected={context} onChange={value => { setContext(String(value) as 'property' | 'project'); setSelectedId(''); }} />
      {entities.length === 0 ? <Text style={s.emptyCopy}>No {context}s are available. Create one before making a marketplace listing.</Text> : entities.map(entity => <Pressable key={id(entity)} onPress={() => setSelectedId(id(entity))} style={[s.entity, selectedId === id(entity) && s.entityOn]}><DataRow title={title(entity)} detail={String((entity.location as Data | undefined)?.city || entity.city || '')} status={selectedId === id(entity) ? 'selected' : undefined} /></Pressable>)}
      <SelectChips label="Listing purpose" values={['sale', 'rent']} selected={purpose} onChange={value => { setPurpose(String(value)); if (String(value) === 'rent') setTransaction('resale'); }} />
      {purpose === 'sale' ? <SelectChips label="Transaction type" values={['new_booking', 'resale']} selected={transaction} onChange={value => setTransaction(String(value))} /> : null}
      <Field label="Contact name" value={contact.name} onChangeText={setContactField('name')} />
      <Field label="Contact phone" value={contact.phone} onChangeText={setContactField('phone')} keyboardType="phone-pad" />
      <Field label="Contact email (optional)" value={contact.email} onChangeText={setContactField('email')} keyboardType="email-address" />
      <PrimaryButton title="Create listing draft" onPress={() => void createListing()} loading={busy} disabled={!selectedId || !contact.name.trim() || !contact.phone.trim()} />
    </Panel>
    <PageHeading title="Existing listings" subtitle="Draft, review and published listings" />
    {!loading && listings.length === 0 ? <StatePanel title="No listings yet" message="Create a listing from a saved property or developer project." /> : listings.map(row => <Panel key={id(row)}>
      <DataRow title={title(row)} detail={[String(row.listingPurpose || ''), String(row.transactionType || '')].filter(Boolean).join(' · ')} status={String(row.status || 'draft')} />
      <SecondaryButton title="View / edit" onPress={() => router.push(`/realtor/listing/${id(row)}` as never)} />
      {['draft', 'changes_requested'].includes(String(row.status)) ? <PrimaryButton title="Submit for review" onPress={() => void submitListing(row)} loading={busy} /> : null}
    </Panel>)}
    <ListingCreditsSheet visible={creditsOpen} title="Buy listing credits to post" onClose={() => setCreditsOpen(false)} onPurchased={() => void load()} />
  </VerticalFrame>;
}

const s = StyleSheet.create({ sectionTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' }, emptyCopy: { color: palette.muted, fontSize: 12, lineHeight: 18 }, entity: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line, paddingHorizontal: 6, borderRadius: 10 }, entityOn: { borderColor: palette.green, borderWidth: 1, backgroundColor: palette.greenSoft }, });
