import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { BooleanField, Field, PageHeading, Panel, PrimaryButton, SelectChips, StatePanel, VerticalFrame, palette } from '../../../components/vertical/VerticalUi';
import { Text } from '../../../components/AppText';
import { realtorApi } from '../../../lib/partnerVerticalApi';
import { PartnerApiError } from '../../../lib/partnerApi';

const TABS = [{ key: 'overview', label: 'Overview', icon: '⌂' }, { key: 'properties', label: 'Properties', icon: '▦' }, { key: 'listings', label: 'Listings', icon: '▤' }, { key: 'leads', label: 'Leads', icon: '♧' }, { key: 'more', label: 'Realty', icon: '•••' }];
const PROPERTY_TYPES = ['apartment', 'villa', 'independent_house', 'plot', 'farmhouse', 'commercial', 'office', 'shop', 'warehouse', 'land', 'pg', 'other'];
const FACING = ['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west'];
const STEPS = ['Basic & location', 'Rooms & layout', 'Furnishing & utilities', 'Pricing & terms', 'Landmarks & photos'];
type PickedAsset = { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null };
type PropertyForm = Record<string, string>;
const initial: PropertyForm = {
  propertyType: 'apartment', listingPurpose: 'sale', transactionType: 'resale', title: '', description: '', societyName: '', city: '', locality: '', subLocality: '', pincode: '', addressLine: '',
  bhk: '', bedrooms: '', bathrooms: '', balconies: '', superBuiltUpArea: '', builtUpArea: '', carpetArea: '', plotArea: '', floorNumber: '', totalFloors: '', facing: 'north', furnishing: 'unfurnished',
  additionalRooms: '', overlooking: '', isCornerPlot: 'false', gatedSecurity: 'false', wardrobesCount: '', acCount: '', bedCount: '', geyserCount: '', modularKitchen: 'false', tv: 'false', refrigerator: 'false', washingMachine: 'false', sofa: 'false', diningTable: 'false', microwave: 'false', chimney: 'false', waterPurifier: 'false', curtains: 'false', fansCount: '', exhaustFans: 'false', coveredCars: '', openCars: '', twoWheeler: 'false', evCharging: 'false', waterSource: '', powerBackup: 'none', pipedGas: 'false', liftsCount: '',
  price: '', monthlyRent: '', securityDeposit: '', maintenance: '', propertyAge: '', possessionStatus: 'expected', preferredTenants: 'any', petFriendly: 'false', vegOnly: 'false', lockInPeriodMonths: '', noticePeriodMonths: '', priceNegotiable: 'false', ownershipType: 'freehold', khataType: '', bankApprovals: '', nearbyName: '', nearbyCategory: '', nearbyDistance: '', floorPlanUrl: '', videoTourUrl: '',
};

const asNumber = (value: string) => value.trim() ? Number(value) : undefined;
function extractId(response: Record<string, unknown>) {
  const property = response.property && typeof response.property === 'object' ? response.property as Record<string, unknown> : response;
  return String(property._id || property.id || '');
}

export default function NewRealtorPropertyScreen() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [photos, setPhotos] = useState<PickedAsset[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [createdId, setCreatedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: string) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  async function choosePhotos() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 15, quality: 0.9 });
    if (!result.canceled) setPhotos(current => [...current, ...result.assets.map(asset => ({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, fileSize: asset.fileSize })).filter(asset => !current.some(old => old.uri === asset.uri))].slice(0, 15));
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {
      propertyType: form.propertyType, listingPurpose: form.listingPurpose, transactionType: form.transactionType,
      title: form.title.trim(), description: form.description.trim(), societyName: form.societyName.trim(),
      location: { city: form.city.trim(), locality: form.locality.trim(), subLocality: form.subLocality.trim() || undefined, pincode: form.pincode.trim() || undefined, addressLine: form.addressLine.trim() || undefined },
      furnishing: form.furnishing, propertyAge: form.propertyAge || undefined, possessionStatus: form.possessionStatus,
      facing: form.facing || undefined, floorPlanUrl: form.floorPlanUrl.trim() || undefined, videoTourUrl: form.videoTourUrl.trim() || undefined,
      additionalRooms: form.additionalRooms.split(',').map(value => value.trim()).filter(Boolean), overlooking: form.overlooking.split(',').map(value => value.trim()).filter(Boolean),
      isCornerPlot: form.isCornerPlot === 'true', gatedSecurity: form.gatedSecurity === 'true',
      furnishingDetails: { modularKitchen: form.modularKitchen === 'true', wardrobesCount: asNumber(form.wardrobesCount) || 0, acCount: asNumber(form.acCount) || 0, bedCount: asNumber(form.bedCount) || 0, geyserCount: asNumber(form.geyserCount) || 0, tv: form.tv === 'true', refrigerator: form.refrigerator === 'true', washingMachine: form.washingMachine === 'true', sofa: form.sofa === 'true', diningTable: form.diningTable === 'true', microwave: form.microwave === 'true', chimney: form.chimney === 'true', waterPurifier: form.waterPurifier === 'true', curtains: form.curtains === 'true', fansCount: asNumber(form.fansCount) || 0, exhaustFans: form.exhaustFans === 'true' },
      parking: { coveredCars: asNumber(form.coveredCars) || 0, openCars: asNumber(form.openCars) || 0, twoWheeler: form.twoWheeler === 'true', evCharging: form.evCharging === 'true' },
      utilities: { waterSource: form.waterSource.split(',').map(value => value.trim()).filter(Boolean), powerBackup: form.powerBackup, pipedGas: form.pipedGas === 'true', liftsCount: asNumber(form.liftsCount) || 0 },
    };
    for (const key of ['bhk', 'bedrooms', 'bathrooms', 'balconies', 'superBuiltUpArea', 'builtUpArea', 'carpetArea', 'plotArea', 'floorNumber', 'totalFloors']) {
      const value = asNumber(form[key]); if (value !== undefined) payload[key] = value;
    }
    if (form.listingPurpose === 'sale') {
      payload.price = asNumber(form.price);
      payload.saleTerms = { priceNegotiable: form.priceNegotiable === 'true', ownershipType: form.ownershipType, khataType: form.khataType || undefined, bankApprovals: form.bankApprovals.split(',').map(value => value.trim()).filter(Boolean) };
    } else {
      payload.monthlyRent = asNumber(form.monthlyRent);
      payload.securityDeposit = asNumber(form.securityDeposit);
      payload.maintenance = asNumber(form.maintenance);
      payload.rentalTerms = { preferredTenants: form.preferredTenants, petFriendly: form.petFriendly === 'true', vegOnly: form.vegOnly === 'true', lockInPeriodMonths: asNumber(form.lockInPeriodMonths), noticePeriodMonths: asNumber(form.noticePeriodMonths) };
    }
    if (form.nearbyName.trim()) payload.nearbyPlaces = [{ name: form.nearbyName.trim(), category: form.nearbyCategory || 'landmark', distance: asNumber(form.nearbyDistance), distanceUnit: 'km' }];
    return payload;
  }

  async function submit() {
    setBusy(true); setError('');
    try {
      let propertyId = createdId;
      if (!propertyId) {
        if (form.title.trim().length < 4) throw new Error('Enter a property title with at least 4 characters.');
        if (!form.city.trim() || !form.locality.trim()) throw new Error('Enter the property city and locality.');
        if (photos.length < 5) throw new Error('Add at least 5 photos before creating a property.');
        if (form.listingPurpose === 'sale' && !form.price.trim()) throw new Error('Enter the sale price.');
        if (form.listingPurpose === 'rent' && !form.monthlyRent.trim()) throw new Error('Enter the monthly rent.');
        propertyId = extractId(await realtorApi.properties('POST', buildPayload()));
        if (!propertyId) throw new Error('The server created the property without returning its ID.');
        setCreatedId(propertyId);
      }
      const pending = photos.filter(photo => !uploaded.includes(photo.uri));
      for (const [index, photo] of pending.entries()) {
        await realtorApi.uploadMedia({ uri: photo.uri, name: photo.fileName || `property-${index + 1}.jpg`, mimeType: photo.mimeType || 'image/jpeg' }, { resourceType: 'property', resourceId: propertyId, type: 'gallery' });
        setUploaded(current => [...current, photo.uri]);
      }
      router.replace('/realtor/dashboard?tab=properties' as never);
    } catch (cause) { setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not create property.'); }
    finally { setBusy(false); }
  }

  return <VerticalFrame title="New property" subtitle="REALTY LISTING" tabs={TABS} activeTab="properties" onTab={key => key === 'properties' ? router.replace('/realtor/dashboard') : router.push('/realtor/dashboard')} onBack={() => router.back()}>
    <PageHeading eyebrow={`STEP ${step + 1} OF 5`} title={STEPS[step]} subtitle="Your property details are saved to the Kraftnex marketplace." />
    {error ? <StatePanel title={createdId ? 'Property draft saved; photo upload incomplete' : 'Check your property details'} message={error} /> : null}
    {step === 0 ? <Panel>
      <SelectChips label="Property type" values={PROPERTY_TYPES} selected={form.propertyType} onChange={value => set('propertyType')(String(value))} />
      <SelectChips label="Listing purpose" values={['sale', 'rent']} selected={form.listingPurpose} onChange={value => setForm(current => ({ ...current, listingPurpose: String(value), transactionType: String(value) === 'sale' ? 'resale' : 'resale' }))} />
      {form.listingPurpose === 'sale' ? <SelectChips label="Transaction type" values={['new_booking', 'resale']} selected={form.transactionType} onChange={value => set('transactionType')(String(value))} /> : null}
      <Field label="Property title" value={form.title} onChangeText={set('title')} />
      <Field label="Description" value={form.description} onChangeText={set('description')} multiline />
      <Field label="Society / building name" value={form.societyName} onChangeText={set('societyName')} />
      <Field label="City" value={form.city} onChangeText={set('city')} />
      <Field label="Locality" value={form.locality} onChangeText={set('locality')} />
      <Field label="Sub-locality" value={form.subLocality} onChangeText={set('subLocality')} />
      <Field label="PIN code" value={form.pincode} onChangeText={set('pincode')} keyboardType="numeric" />
      <Field label="Address" value={form.addressLine} onChangeText={set('addressLine')} />
    </Panel> : null}
    {step === 1 ? <Panel>
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
    </Panel> : null}
    {step === 2 ? <Panel>
      <SelectChips label="Furnishing" values={['unfurnished', 'semi_furnished', 'fully_furnished']} selected={form.furnishing} onChange={value => set('furnishing')(String(value))} />
      <Field label="Property age" value={form.propertyAge} onChangeText={set('propertyAge')} placeholder="e.g. 1 to 3 years" />
      <SelectChips label="Possession" values={['announced', 'expected', 'actual']} selected={form.possessionStatus} onChange={value => set('possessionStatus')(String(value))} />
      <BooleanField label="Gated security" value={form.gatedSecurity === 'true'} onChange={value => set('gatedSecurity')(String(value))} />
      <BooleanField label="Corner plot" value={form.isCornerPlot === 'true'} onChange={value => set('isCornerPlot')(String(value))} />
      <Field label="Additional rooms (comma-separated)" value={form.additionalRooms} onChangeText={set('additionalRooms')} />
      <Field label="Overlooking (comma-separated)" value={form.overlooking} onChangeText={set('overlooking')} />
      <Section label="Furnishing details" />
      <Field label="Wardrobes" value={form.wardrobesCount} onChangeText={set('wardrobesCount')} keyboardType="numeric" />
      <Field label="Air conditioners" value={form.acCount} onChangeText={set('acCount')} keyboardType="numeric" />
      <Field label="Beds" value={form.bedCount} onChangeText={set('bedCount')} keyboardType="numeric" />
      <Field label="Geysers" value={form.geyserCount} onChangeText={set('geyserCount')} keyboardType="numeric" />
      <BooleanField label="Modular kitchen" value={form.modularKitchen === 'true'} onChange={value => set('modularKitchen')(String(value))} />
      <Section label="Parking & utilities" />
      <Field label="Covered car parking spaces" value={form.coveredCars} onChangeText={set('coveredCars')} keyboardType="numeric" />
      <Field label="Open car parking spaces" value={form.openCars} onChangeText={set('openCars')} keyboardType="numeric" />
      <BooleanField label="Two-wheeler parking" value={form.twoWheeler === 'true'} onChange={value => set('twoWheeler')(String(value))} />
      <BooleanField label="EV charging" value={form.evCharging === 'true'} onChange={value => set('evCharging')(String(value))} />
      <Field label="Water sources (comma-separated)" value={form.waterSource} onChangeText={set('waterSource')} />
      <SelectChips label="Power backup" values={['none', 'partial', 'full']} selected={form.powerBackup} onChange={value => set('powerBackup')(String(value))} />
      <BooleanField label="Piped gas" value={form.pipedGas === 'true'} onChange={value => set('pipedGas')(String(value))} />
      <Field label="Lifts" value={form.liftsCount} onChangeText={set('liftsCount')} keyboardType="numeric" />
    </Panel> : null}
    {step === 3 ? <Panel>
      {form.listingPurpose === 'sale' ? <>
        <Field label="Sale price (₹)" value={form.price} onChangeText={set('price')} keyboardType="numeric" />
        <BooleanField label="Price negotiable" value={form.priceNegotiable === 'true'} onChange={value => set('priceNegotiable')(String(value))} />
        <SelectChips label="Ownership" values={['freehold', 'leasehold', 'cooperative_society', 'power_of_attorney']} selected={form.ownershipType} onChange={value => set('ownershipType')(String(value))} />
        <Field label="Khata type" value={form.khataType} onChangeText={set('khataType')} />
        <Field label="Bank approvals (comma-separated)" value={form.bankApprovals} onChangeText={set('bankApprovals')} />
      </> : <>
        <Field label="Monthly rent (₹)" value={form.monthlyRent} onChangeText={set('monthlyRent')} keyboardType="numeric" />
        <Field label="Security deposit (₹)" value={form.securityDeposit} onChangeText={set('securityDeposit')} keyboardType="numeric" />
        <Field label="Monthly maintenance (₹)" value={form.maintenance} onChangeText={set('maintenance')} keyboardType="numeric" />
        <SelectChips label="Preferred tenants" values={['any', 'family', 'bachelors', 'company_lease']} selected={form.preferredTenants} onChange={value => set('preferredTenants')(String(value))} />
        <BooleanField label="Pet friendly" value={form.petFriendly === 'true'} onChange={value => set('petFriendly')(String(value))} />
        <BooleanField label="Vegetarian only" value={form.vegOnly === 'true'} onChange={value => set('vegOnly')(String(value))} />
        <Field label="Lock-in period (months)" value={form.lockInPeriodMonths} onChangeText={set('lockInPeriodMonths')} keyboardType="numeric" />
        <Field label="Notice period (months)" value={form.noticePeriodMonths} onChangeText={set('noticePeriodMonths')} keyboardType="numeric" />
      </>}
      <Field label="Floor plan URL (optional)" value={form.floorPlanUrl} onChangeText={set('floorPlanUrl')} />
      <Field label="Video tour URL (optional)" value={form.videoTourUrl} onChangeText={set('videoTourUrl')} />
    </Panel> : null}
    {step === 4 ? <Panel>
      <Field label="Nearby landmark" value={form.nearbyName} onChangeText={set('nearbyName')} />
      <SelectChips label="Landmark type" values={['metro', 'school', 'hospital', 'it_hub', 'shopping', 'bus', 'railway', 'airport', 'highway', 'landmark']} selected={form.nearbyCategory || 'landmark'} onChange={value => set('nearbyCategory')(String(value))} />
      <Field label="Distance (km)" value={form.nearbyDistance} onChangeText={set('nearbyDistance')} keyboardType="decimal-pad" />
      <Pressable onPress={() => void choosePhotos()} style={s.pick}><Text style={s.pickTitle}>＋  Add property photos</Text><Text style={s.pickCopy}>Choose 5–15 photos from your device. Photos upload to the realtor media service after the property draft is created.</Text></Pressable>
      <Text style={s.photoCount}>{photos.length} photos selected · {uploaded.length} uploaded</Text>
      <View style={s.photoGrid}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={s.photo}><Image source={{ uri: photo.uri }} style={s.image} /><Pressable style={s.removePhoto} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))}><Text style={{ color: '#fff', fontWeight: '900' }}>×</Text></Pressable></View>)}</View>
    </Panel> : null}
    <View style={s.actions}>
      {step > 0 ? <View style={{ flex: 1 }}><PrimaryButton title="Back" onPress={() => setStep(index => Math.max(0, index - 1))} /></View> : null}
      <View style={{ flex: 1 }}>{step < 4 ? <PrimaryButton title="Continue" onPress={() => setStep(index => Math.min(4, index + 1))} /> : <PrimaryButton title={createdId ? 'Retry photo upload' : 'Create property'} onPress={() => void submit()} loading={busy} disabled={photos.length < 5} />}</View>
    </View>
  </VerticalFrame>;
}

function Section({ label }: { label: string }) { return <Text style={{ color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 12 }}>{label}</Text>; }

const s = StyleSheet.create({ note: { color: palette.body, fontSize: 12, lineHeight: 18, marginTop: 6 }, pick: { backgroundColor: palette.greenSoft, borderColor: '#bfe0cf', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, gap: 5, marginTop: 10 }, pickTitle: { color: palette.green, fontSize: 13, fontWeight: '800' }, pickCopy: { color: palette.body, fontSize: 11, lineHeight: 16 }, photoCount: { color: palette.muted, fontSize: 11, marginTop: 8 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, photo: { width: '30%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', position: 'relative' }, image: { width: '100%', height: '100%' }, removePhoto: { position: 'absolute', right: 3, top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(16,35,28,0.7)', alignItems: 'center', justifyContent: 'center' }, actions: { flexDirection: 'row', gap: 9 } });
