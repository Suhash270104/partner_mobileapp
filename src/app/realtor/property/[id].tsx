import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { BooleanField, Field, PageHeading, Panel, PrimaryButton, SelectChips, StatePanel, VerticalFrame } from '../../../components/vertical/VerticalUi';
import { Text } from '../../../components/AppText';
import { Data, MediaManager, REALTOR_TABS, errorText, nestedOf, toList, toNum, toText } from '../../../components/realtor/RealtorShared';
import { realtorApi } from '../../../lib/partnerVerticalApi';

const PROPERTY_TYPES = ['apartment', 'villa', 'independent_house', 'plot', 'farmhouse', 'commercial', 'office', 'shop', 'warehouse', 'land', 'pg', 'other'];
const FACING = ['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west'];
type Form = Record<string, string>;

function toForm(p: Data): Form {
  const loc: Data = p.location || {}, fd: Data = p.furnishingDetails || {}, pk: Data = p.parking || {}, ut: Data = p.utilities || {}, sale: Data = p.saleTerms || {}, rent: Data = p.rentalTerms || {};
  const b = (v: unknown) => String(v === true);
  return {
    propertyType: toText(p.propertyType) || 'apartment', title: toText(p.title), description: toText(p.description), societyName: toText(p.societyName),
    city: toText(loc.city), locality: toText(loc.locality), subLocality: toText(loc.subLocality), pincode: toText(loc.pincode), addressLine: toText(loc.addressLine),
    bhk: toText(p.bhk), bedrooms: toText(p.bedrooms), bathrooms: toText(p.bathrooms), balconies: toText(p.balconies),
    superBuiltUpArea: toText(p.superBuiltUpArea), builtUpArea: toText(p.builtUpArea), carpetArea: toText(p.carpetArea), plotArea: toText(p.plotArea),
    floorNumber: toText(p.floorNumber), totalFloors: toText(p.totalFloors), facing: toText(p.facing), furnishing: toText(p.furnishing) || 'unfurnished',
    propertyAge: toText(p.propertyAge), possessionStatus: toText(p.possessionStatus) || 'expected', gatedSecurity: b(p.gatedSecurity), isCornerPlot: b(p.isCornerPlot),
    additionalRooms: (p.additionalRooms || []).join(', '), overlooking: (p.overlooking || []).join(', '),
    wardrobesCount: toText(fd.wardrobesCount), acCount: toText(fd.acCount), bedCount: toText(fd.bedCount), geyserCount: toText(fd.geyserCount), modularKitchen: b(fd.modularKitchen),
    coveredCars: toText(pk.coveredCars), openCars: toText(pk.openCars), twoWheeler: b(pk.twoWheeler), evCharging: b(pk.evCharging),
    waterSource: (ut.waterSource || []).join(', '), powerBackup: toText(ut.powerBackup) || 'none', pipedGas: b(ut.pipedGas), liftsCount: toText(ut.liftsCount),
    price: toText(p.price), priceNegotiable: b(sale.priceNegotiable), ownershipType: toText(sale.ownershipType) || 'freehold', khataType: toText(sale.khataType), bankApprovals: (sale.bankApprovals || []).join(', '),
    monthlyRent: toText(p.monthlyRent), securityDeposit: toText(p.securityDeposit), maintenance: toText(p.maintenance),
    preferredTenants: toText(rent.preferredTenants) || 'any', petFriendly: b(rent.petFriendly), vegOnly: b(rent.vegOnly), lockInPeriodMonths: toText(rent.lockInPeriodMonths), noticePeriodMonths: toText(rent.noticePeriodMonths),
    floorPlanUrl: toText(p.floorPlanUrl), videoTourUrl: toText(p.videoTourUrl),
  };
}

export default function EditRealtorPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Data | null>(null);
  const [form, setForm] = useState<Form>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (key: string) => (value: string) => { setSaved(false); setForm(current => ({ ...current, [key]: value })); };
  const flag = (key: string) => form[key] === 'true';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const p = nestedOf(await realtorApi.properties('GET', undefined, String(id)), 'property'); setProperty(p); setForm(toForm(p)); }
    catch (cause) { setError(errorText(cause, 'Could not load this property.')); }
    finally { setLoading(false); }
  }, [id]);
  // Pre-fill the form from the server on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!property) return;
    if (form.title.trim().length < 4) { setError('Enter a property title with at least 4 characters.'); return; }
    if (!form.city.trim() || !form.locality.trim()) { setError('Enter the property city and locality.'); return; }
    const sale = property.listingPurpose === 'sale';
    if (sale && !form.price.trim()) { setError('Enter the sale price.'); return; }
    if (!sale && !form.monthlyRent.trim()) { setError('Enter the monthly rent.'); return; }
    setBusy(true); setError(''); setSaved(false);
    const payload: Data = {
      propertyType: form.propertyType, title: form.title.trim(), description: form.description.trim(), societyName: form.societyName.trim(),
      // The backend replaces the whole location object, so existing fields (including the map pin) are carried over.
      location: { ...(property.location || {}), city: form.city.trim(), locality: form.locality.trim(), subLocality: form.subLocality.trim(), pincode: form.pincode.trim(), addressLine: form.addressLine.trim() },
      furnishing: form.furnishing, propertyAge: form.propertyAge, possessionStatus: form.possessionStatus, facing: form.facing || undefined,
      floorPlanUrl: form.floorPlanUrl.trim(), videoTourUrl: form.videoTourUrl.trim(),
      additionalRooms: toList(form.additionalRooms), overlooking: toList(form.overlooking), gatedSecurity: flag('gatedSecurity'), isCornerPlot: flag('isCornerPlot'),
      furnishingDetails: { ...(property.furnishingDetails || {}), modularKitchen: flag('modularKitchen'), wardrobesCount: toNum(form.wardrobesCount) ?? 0, acCount: toNum(form.acCount) ?? 0, bedCount: toNum(form.bedCount) ?? 0, geyserCount: toNum(form.geyserCount) ?? 0 },
      parking: { ...(property.parking || {}), coveredCars: toNum(form.coveredCars) ?? 0, openCars: toNum(form.openCars) ?? 0, twoWheeler: flag('twoWheeler'), evCharging: flag('evCharging') },
      utilities: { ...(property.utilities || {}), waterSource: toList(form.waterSource), powerBackup: form.powerBackup, pipedGas: flag('pipedGas'), liftsCount: toNum(form.liftsCount) ?? 0 },
    };
    for (const key of ['bhk', 'bedrooms', 'bathrooms', 'balconies', 'superBuiltUpArea', 'builtUpArea', 'carpetArea', 'plotArea', 'floorNumber', 'totalFloors']) {
      const value = toNum(form[key]); if (value !== undefined) payload[key] = value;
    }
    if (sale) {
      payload.price = toNum(form.price);
      payload.saleTerms = { ...(property.saleTerms || {}), priceNegotiable: flag('priceNegotiable'), ownershipType: form.ownershipType, khataType: form.khataType, bankApprovals: toList(form.bankApprovals) };
    } else {
      payload.monthlyRent = toNum(form.monthlyRent); payload.securityDeposit = toNum(form.securityDeposit); payload.maintenance = toNum(form.maintenance);
      payload.rentalTerms = { ...(property.rentalTerms || {}), preferredTenants: form.preferredTenants, petFriendly: flag('petFriendly'), vegOnly: flag('vegOnly'), lockInPeriodMonths: toNum(form.lockInPeriodMonths) ?? null, noticePeriodMonths: toNum(form.noticePeriodMonths) ?? null };
    }
    // Strip server-managed keys that the update schema does not accept.
    for (const nestedKey of ['furnishingDetails', 'parking', 'utilities', 'saleTerms', 'rentalTerms']) delete (payload[nestedKey] as Data | undefined)?._id;
    try { setProperty(nestedOf(await realtorApi.properties('PUT', payload, String(id)), 'property')); setSaved(true); }
    catch (cause) { setError(errorText(cause, 'Could not save property changes.')); }
    finally { setBusy(false); }
  }

  const sale = property?.listingPurpose === 'sale';
  return <VerticalFrame title="Edit property" subtitle="REALTY LISTING" tabs={REALTOR_TABS} activeTab="properties" onTab={key => router.replace(`/realtor/dashboard?tab=${key === 'dashboard' ? 'overview' : key}` as never)} onBack={() => router.back()}>
    <PageHeading eyebrow="EDIT PROPERTY" title={property ? toText(property.title) || 'Property' : 'Property'} subtitle="Changes are saved to your Kraftnex property record." />
    {loading ? <StatePanel title="Loading property" message="Fetching the latest saved details…" /> : null}
    {error ? <StatePanel title={property ? 'Could not save changes' : 'Could not load property'} message={error} retry={property ? undefined : () => void load()} /> : null}
    {saved ? <Panel tint><Text style={{ color: '#17684b', fontWeight: '700', fontSize: 12 }}>Property changes saved.</Text></Panel> : null}
    {property ? <>
      <Panel>
        <SelectChips label="Property type" values={PROPERTY_TYPES} selected={form.propertyType} onChange={value => set('propertyType')(String(value))} />
        <Text style={{ color: '#7b8a83', fontSize: 11 }}>Listing purpose: {toText(property.listingPurpose)} · {toText(property.transactionType).replaceAll('_', ' ')} (fixed after creation)</Text>
        <Field label="Property title" value={form.title} onChangeText={set('title')} />
        <Field label="Description" value={form.description} onChangeText={set('description')} multiline />
        <Field label="Society / building name" value={form.societyName} onChangeText={set('societyName')} />
        <Field label="City" value={form.city} onChangeText={set('city')} />
        <Field label="Locality" value={form.locality} onChangeText={set('locality')} />
        <Field label="Sub-locality" value={form.subLocality} onChangeText={set('subLocality')} />
        <Field label="PIN code" value={form.pincode} onChangeText={set('pincode')} keyboardType="numeric" />
        <Field label="Address" value={form.addressLine} onChangeText={set('addressLine')} />
      </Panel>
      <Panel>
        <SelectChips label="Facing" values={FACING} selected={form.facing} onChange={value => set('facing')(String(value))} />
        <Field label="Bedrooms (BHK)" value={form.bhk} onChangeText={set('bhk')} keyboardType="numeric" />
        <Field label="Bedrooms" value={form.bedrooms} onChangeText={set('bedrooms')} keyboardType="numeric" />
        <Field label="Bathrooms" value={form.bathrooms} onChangeText={set('bathrooms')} keyboardType="numeric" />
        <Field label="Balconies" value={form.balconies} onChangeText={set('balconies')} keyboardType="numeric" />
        <Field label="Super built-up area (sq ft)" value={form.superBuiltUpArea} onChangeText={set('superBuiltUpArea')} keyboardType="decimal-pad" />
        <Field label="Built-up area (sq ft)" value={form.builtUpArea} onChangeText={set('builtUpArea')} keyboardType="decimal-pad" />
        <Field label="Carpet area (sq ft)" value={form.carpetArea} onChangeText={set('carpetArea')} keyboardType="decimal-pad" />
        {['plot', 'land'].includes(form.propertyType) ? <Field label="Plot area (sq ft)" value={form.plotArea} onChangeText={set('plotArea')} keyboardType="decimal-pad" /> : null}
        <Field label="Floor number" value={form.floorNumber} onChangeText={set('floorNumber')} keyboardType="numeric" />
        <Field label="Total floors" value={form.totalFloors} onChangeText={set('totalFloors')} keyboardType="numeric" />
      </Panel>
      <Panel>
        <SelectChips label="Furnishing" values={['unfurnished', 'semi_furnished', 'fully_furnished']} selected={form.furnishing} onChange={value => set('furnishing')(String(value))} />
        <Field label="Property age" value={form.propertyAge} onChangeText={set('propertyAge')} placeholder="e.g. 1 to 3 years" />
        <SelectChips label="Possession" values={['announced', 'expected', 'actual']} selected={form.possessionStatus} onChange={value => set('possessionStatus')(String(value))} />
        <BooleanField label="Gated security" value={flag('gatedSecurity')} onChange={value => set('gatedSecurity')(String(value))} />
        <BooleanField label="Corner plot" value={flag('isCornerPlot')} onChange={value => set('isCornerPlot')(String(value))} />
        <Field label="Additional rooms (comma-separated)" value={form.additionalRooms} onChangeText={set('additionalRooms')} />
        <Field label="Overlooking (comma-separated)" value={form.overlooking} onChangeText={set('overlooking')} />
        <Field label="Wardrobes" value={form.wardrobesCount} onChangeText={set('wardrobesCount')} keyboardType="numeric" />
        <Field label="Air conditioners" value={form.acCount} onChangeText={set('acCount')} keyboardType="numeric" />
        <Field label="Beds" value={form.bedCount} onChangeText={set('bedCount')} keyboardType="numeric" />
        <Field label="Geysers" value={form.geyserCount} onChangeText={set('geyserCount')} keyboardType="numeric" />
        <BooleanField label="Modular kitchen" value={flag('modularKitchen')} onChange={value => set('modularKitchen')(String(value))} />
        <Field label="Covered car parking spaces" value={form.coveredCars} onChangeText={set('coveredCars')} keyboardType="numeric" />
        <Field label="Open car parking spaces" value={form.openCars} onChangeText={set('openCars')} keyboardType="numeric" />
        <BooleanField label="Two-wheeler parking" value={flag('twoWheeler')} onChange={value => set('twoWheeler')(String(value))} />
        <BooleanField label="EV charging" value={flag('evCharging')} onChange={value => set('evCharging')(String(value))} />
        <Field label="Water sources (comma-separated)" value={form.waterSource} onChangeText={set('waterSource')} />
        <SelectChips label="Power backup" values={['none', 'partial', 'full']} selected={form.powerBackup} onChange={value => set('powerBackup')(String(value))} />
        <BooleanField label="Piped gas" value={flag('pipedGas')} onChange={value => set('pipedGas')(String(value))} />
        <Field label="Lifts" value={form.liftsCount} onChangeText={set('liftsCount')} keyboardType="numeric" />
      </Panel>
      <Panel>
        {sale ? <>
          <Field label="Sale price (₹)" value={form.price} onChangeText={set('price')} keyboardType="numeric" />
          <BooleanField label="Price negotiable" value={flag('priceNegotiable')} onChange={value => set('priceNegotiable')(String(value))} />
          <SelectChips label="Ownership" values={['freehold', 'leasehold', 'cooperative_society', 'power_of_attorney']} selected={form.ownershipType} onChange={value => set('ownershipType')(String(value))} />
          <Field label="Khata type" value={form.khataType} onChangeText={set('khataType')} />
          <Field label="Bank approvals (comma-separated)" value={form.bankApprovals} onChangeText={set('bankApprovals')} />
        </> : <>
          <Field label="Monthly rent (₹)" value={form.monthlyRent} onChangeText={set('monthlyRent')} keyboardType="numeric" />
          <Field label="Security deposit (₹)" value={form.securityDeposit} onChangeText={set('securityDeposit')} keyboardType="numeric" />
          <Field label="Monthly maintenance (₹)" value={form.maintenance} onChangeText={set('maintenance')} keyboardType="numeric" />
          <SelectChips label="Preferred tenants" values={['any', 'family', 'bachelors', 'company_lease']} selected={form.preferredTenants} onChange={value => set('preferredTenants')(String(value))} />
          <BooleanField label="Pet friendly" value={flag('petFriendly')} onChange={value => set('petFriendly')(String(value))} />
          <BooleanField label="Vegetarian only" value={flag('vegOnly')} onChange={value => set('vegOnly')(String(value))} />
          <Field label="Lock-in period (months)" value={form.lockInPeriodMonths} onChangeText={set('lockInPeriodMonths')} keyboardType="numeric" />
          <Field label="Notice period (months)" value={form.noticePeriodMonths} onChangeText={set('noticePeriodMonths')} keyboardType="numeric" />
        </>}
        <Field label="Floor plan URL (optional)" value={form.floorPlanUrl} onChangeText={set('floorPlanUrl')} />
        <Field label="Video tour URL (optional)" value={form.videoTourUrl} onChangeText={set('videoTourUrl')} />
      </Panel>
      <PrimaryButton title="Save changes" onPress={() => void save()} loading={busy} />
      <MediaManager resourceType="property" resourceId={String(id)} />
    </> : null}
  </VerticalFrame>;
}
