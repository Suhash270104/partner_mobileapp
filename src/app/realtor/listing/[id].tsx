import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SelectChips, StatePanel, VerticalFrame } from '../../../components/vertical/VerticalUi';
import { Text } from '../../../components/AppText';
import { Data, REALTOR_TABS, SummaryHeader, errorText, firstText, formatPrice, locationText, nestedOf, toText } from '../../../components/realtor/RealtorShared';
import { realtorApi } from '../../../lib/partnerVerticalApi';

const EDITABLE = ['draft', 'changes_requested'];

export default function EditRealtorListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Data | null>(null);
  const [resource, setResource] = useState<Data | null>(null);
  const [purpose, setPurpose] = useState('sale');
  const [transaction, setTransaction] = useState('resale');
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const setField = (key: keyof typeof contact) => (value: string) => { setNotice(''); setContact(current => ({ ...current, [key]: value })); };

  const fill = (l: Data) => {
    setListing(l); setPurpose(toText(l.listingPurpose) || 'sale'); setTransaction(toText(l.transactionType) || 'resale');
    setContact({ name: toText(l.contact?.name), phone: toText(l.contact?.phone), email: toText(l.contact?.email) });
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const l = nestedOf(await realtorApi.listings('GET', undefined, String(id)), 'listing');
      fill(l);
      // Resolve the linked property / project so the summary shows something readable.
      try {
        if (l.propertyId) setResource(nestedOf(await realtorApi.properties('GET', undefined, String(l.propertyId)), 'property'));
        else if (l.projectId) setResource(nestedOf(await realtorApi.projects('GET', undefined, String(l.projectId)), 'project'));
      } catch { setResource(null); }
    } catch (cause) { setError(errorText(cause, 'Could not load this listing.')); }
    finally { setLoading(false); }
  }, [id]);
  // Pre-fill the form from the server on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const editable = !!listing && EDITABLE.includes(String(listing.status));
  const status = toText(listing?.status) || 'draft';

  async function save() {
    if (!contact.name.trim() || !contact.phone.trim()) { setError('Add the public contact name and phone number.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await realtorApi.listings('PUT', {
        listingPurpose: purpose, transactionType: purpose === 'rent' ? 'resale' : transaction,
        contact: { name: contact.name.trim(), phone: contact.phone.trim(), email: contact.email.trim() },
      }, String(id));
      fill(nestedOf(result, 'listing')); setNotice('Listing changes saved.');
    } catch (cause) { setError(errorText(cause, 'Could not save listing changes.')); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setError(''); setNotice('');
    try { await realtorApi.submitListing(String(id)); await load(); setNotice('Listing submitted for review.'); }
    catch (cause) { setError(errorText(cause, 'Could not submit listing for review.')); }
    finally { setBusy(false); }
  }

  function remove() {
    Alert.alert('Delete listing', 'This draft listing will be deleted permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setBusy(true); setError('');
        try { await realtorApi.listings('DELETE', undefined, String(id)); router.replace('/realtor/dashboard?tab=listings' as never); }
        catch (cause) { setError(errorText(cause, 'Could not delete listing.')); setBusy(false); }
      } },
    ]);
  }

  const name = firstText(resource?.title, resource?.name, listing?.title) || 'Listing';
  const price = resource ? formatPrice(resource.price && typeof resource.price === 'object' ? resource.price.min : resource.price ?? resource.monthlyRent) : '';
  return <VerticalFrame title="Edit listing" subtitle="MARKETPLACE" tabs={REALTOR_TABS} activeTab="listings" onTab={key => router.replace(`/realtor/dashboard?tab=${key === 'dashboard' ? 'overview' : key}` as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="EDIT LISTING" title={name} subtitle="Update the public contact details and listing purpose." />
    {loading ? <StatePanel title="Loading listing" message="Fetching the latest saved details…" /> : null}
    {error ? <StatePanel title={listing ? 'Listing update failed' : 'Could not load listing'} message={error} retry={listing ? undefined : () => void load()} /> : null}
    {notice ? <Panel tint><Text style={{ color: '#17684b', fontWeight: '700', fontSize: 12 }}>{notice}</Text></Panel> : null}
    {listing ? <>
      <SummaryHeader title={name} location={resource ? locationText(resource) : undefined} price={price || undefined} status={status} extra={[toText(listing.listingPurpose), toText(listing.transactionType).replaceAll('_', ' ')].filter(Boolean).join(' · ')} />
      {listing.moderationNote ? <Panel><DataRow title="Reviewer note" detail={toText(listing.moderationNote)} /></Panel> : null}
      {editable ? <Panel>
        <SelectChips label="Listing purpose" values={['sale', 'rent']} selected={purpose} onChange={value => { setNotice(''); setPurpose(String(value)); if (String(value) === 'rent') setTransaction('resale'); }} />
        {purpose === 'sale' ? <SelectChips label="Transaction type" values={['new_booking', 'resale']} selected={transaction} onChange={value => setTransaction(String(value))} /> : null}
        <Field label="Contact name" value={contact.name} onChangeText={setField('name')} />
        <Field label="Contact phone" value={contact.phone} onChangeText={setField('phone')} keyboardType="phone-pad" />
        <Field label="Contact email (optional)" value={contact.email} onChangeText={setField('email')} keyboardType="email-address" />
        <PrimaryButton title="Save changes" onPress={() => void save()} loading={busy} />
        <PrimaryButton title="Submit for review" onPress={() => void submit()} loading={busy} />
        <SecondaryButton title="Delete listing" onPress={remove} />
      </Panel> : <Panel>
        <Text style={{ color: '#4d5f57', fontSize: 12, lineHeight: 18 }}>This listing is “{status.replaceAll('_', ' ')}”, so it can’t be edited or deleted right now. Listings can only be changed while they are a draft or when changes have been requested.</Text>
        <DataRow title="Contact" detail={[contact.name, contact.phone, contact.email].filter(Boolean).join(' · ')} />
      </Panel>}
      {listing.propertyId ? <SecondaryButton title="Edit linked property" onPress={() => router.push(`/realtor/property/${String(listing.propertyId)}` as never)} /> : null}
      {listing.projectId ? <SecondaryButton title="Edit linked project" onPress={() => router.push(`/realtor/project/${String(listing.projectId)}` as never)} /> : null}
    </> : null}
  </VerticalFrame>;
}
