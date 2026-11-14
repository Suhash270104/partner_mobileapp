import { useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, ScrollViewInstance, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { AlertBanner, ProgressBar } from './RealtorUi';
import { PillButton, SelectField, toOptions } from './RealtorControls';
import { ChipGroup, FormField, SectionLabel, StepTabs, ToggleRow } from './RealtorForm';
import { MediaManager } from './RealtorShared';
import { Data, MAX_PHOTOS, minPhotosFor } from './realtorFormat';
import { PartnerApiError } from '../../lib/partnerApi';
import { realtorApi } from '../../lib/partnerVerticalApi';

// One 5-step form for posting AND editing a property. Field names, enums and rules follow the hand-off doc (section 6 and 11).
const PROPERTY_TYPES = ['apartment', 'villa', 'independent_house', 'plot', 'farmhouse', 'commercial', 'office', 'shop', 'warehouse', 'land', 'pg', 'other'];
const FACING = ['north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west'];
const EXTRA_ROOMS = ['pooja', 'study', 'servant', 'store', 'utility'];
const COMMERCIAL_SUBTYPES = ['office_space', 'retail_shop', 'showroom', 'warehouse', 'coworking', 'commercial_building', 'other'];
const APPLIANCES = ['modularKitchen', 'chimney', 'sofa', 'diningTable', 'tv', 'refrigerator', 'washingMachine', 'microwave', 'waterPurifier', 'curtains', 'exhaustFans'];
const APPLIANCE_LABELS: Record<string, string> = { modularKitchen: 'Modular kitchen', chimney: 'Chimney', sofa: 'Sofa', diningTable: 'Dining table', tv: 'TV', refrigerator: 'Refrigerator', washingMachine: 'Washing machine', microwave: 'Microwave', waterPurifier: 'Water purifier', curtains: 'Curtains', exhaustFans: 'Exhaust fans' };
const WATER = ['municipal', 'borewell', 'tanker'];
const POWER = ['none', 'partial', 'full', 'inverter'];
const OVERLOOKING = ['park', 'pool', 'main_road', 'clubhouse'];
const OWNERSHIP = ['freehold', 'leasehold', 'cooperative_society', 'power_of_attorney'];
const KHATA = ['a_khata', 'b_khata', 'e_khata', 'gram_panchayat', 'na'];
const KHATA_LABELS: Record<string, string> = { a_khata: 'A Khata', b_khata: 'B Khata', e_khata: 'E Khata', gram_panchayat: 'Gram Panchayat', na: 'Not applicable' };
const BANKS = ['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'LIC Housing'];
const TENANTS = ['any', 'family', 'bachelors', 'company_lease'];
const AGE = ['new_construction', 'less_than_1_year', '1_to_3_years', '3_to_5_years', '5_to_10_years', '10_plus_years'];
const AGE_LABELS: Record<string, string> = { new_construction: 'New construction', less_than_1_year: 'Less than 1 year', '1_to_3_years': '1 to 3 years', '3_to_5_years': '3 to 5 years', '5_to_10_years': '5 to 10 years', '10_plus_years': '10+ years' };
const NEARBY = ['metro', 'school', 'hospital', 'it_hub', 'shopping', 'bus', 'railway', 'airport', 'highway', 'landmark'];
const STEPS = ['Basic & Location', 'Rooms & Layout', 'Furnishing & Utilities', 'Pricing & Terms', 'Landmarks & Photos'];

type Nearby = { name: string; category: string; distance: string; travelTime: string };
type F = Record<string, any>;
type Photo = { uri: string; name: string; mimeType: string };

const family = (type: string) => ['plot', 'land'].includes(type) ? 'plot' : ['commercial', 'office', 'shop', 'warehouse'].includes(type) ? 'commercial' : 'residential';
const str = (value: unknown) => value == null ? '' : String(value);
const num = (value: unknown) => { const text = str(value).trim(); const n = Number(text); return text && Number.isFinite(n) ? n : undefined; };
const arr = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

export const emptyForm = (): F => ({
  propertyType: 'apartment', listingPurpose: 'sale', transactionType: 'resale', title: '', societyName: '', city: '', locality: '', subLocality: '', pincode: '', addressLine: '', lat: '', lng: '',
  bhk: '', bedrooms: '', bathrooms: '', balconies: '', facing: '', additionalRooms: [], carpetArea: '', builtUpArea: '', superBuiltUpArea: '', floorNumber: '', totalFloors: '', plotArea: '', plotDimensions: '', roadWidth: '', commercialSubtype: '',
  furnishing: 'unfurnished', appliances: [], wardrobesCount: '', acCount: '', bedCount: '', geyserCount: '', fansCount: '', coveredCars: '', openCars: '', twoWheeler: false, evCharging: false,
  waterSource: [], powerBackup: '', pipedGas: false, liftsCount: '', overlooking: [], isCornerPlot: false, gatedSecurity: false,
  price: '', ownershipType: '', khataType: '', priceNegotiable: false, bankApprovals: [], monthlyRent: '', securityDeposit: '', maintenance: '', preferredTenants: '', petFriendly: false, vegOnly: false, lockInPeriodMonths: '', noticePeriodMonths: '',
  propertyAge: '', possessionStatus: 'ready_to_move', availableFrom: '', nearby: [] as Nearby[], videoTourUrl: '', floorPlanUrl: '', description: '',
});

export function formFromProperty(p: Data): F {
  const loc: Data = p.location || {}, fd: Data = p.furnishingDetails || {}, pk: Data = p.parking || {}, ut: Data = p.utilities || {}, sale: Data = p.saleTerms || {}, rent: Data = p.rentalTerms || {};
  const coords: unknown[] = Array.isArray(loc.geo?.coordinates) ? loc.geo.coordinates : [];
  return {
    ...emptyForm(),
    propertyType: str(p.propertyType) || 'apartment', listingPurpose: p.listingPurpose === 'rent' ? 'rent' : 'sale', transactionType: str(p.transactionType) || 'resale', title: str(p.title), societyName: str(p.societyName),
    city: str(loc.city), locality: str(loc.locality), subLocality: str(loc.subLocality), pincode: str(loc.pincode), addressLine: str(loc.addressLine), lng: coords.length === 2 ? str(coords[0]) : '', lat: coords.length === 2 ? str(coords[1]) : '',
    bhk: str(p.bhk), bedrooms: str(p.bedrooms), bathrooms: str(p.bathrooms), balconies: str(p.balconies), facing: str(p.facing), additionalRooms: arr(p.additionalRooms),
    carpetArea: str(p.carpetArea), builtUpArea: str(p.builtUpArea), superBuiltUpArea: str(p.superBuiltUpArea), floorNumber: str(p.floorNumber), totalFloors: str(p.totalFloors),
    plotArea: str(p.plotArea), plotDimensions: str(p.plotDimensions), roadWidth: str(p.roadWidth), commercialSubtype: str(p.commercialSubtype),
    furnishing: str(p.furnishing) || 'unfurnished', appliances: APPLIANCES.filter(key => fd[key] === true), wardrobesCount: str(fd.wardrobesCount || ''), acCount: str(fd.acCount || ''), bedCount: str(fd.bedCount || ''), geyserCount: str(fd.geyserCount || ''), fansCount: str(fd.fansCount || ''),
    coveredCars: str(pk.coveredCars || ''), openCars: str(pk.openCars || ''), twoWheeler: pk.twoWheeler === true, evCharging: pk.evCharging === true,
    waterSource: arr(ut.waterSource), powerBackup: str(ut.powerBackup), pipedGas: ut.pipedGas === true, liftsCount: str(ut.liftsCount || ''), overlooking: arr(p.overlooking), isCornerPlot: p.isCornerPlot === true, gatedSecurity: p.gatedSecurity === true,
    price: str(p.price), ownershipType: str(sale.ownershipType), khataType: str(sale.khataType), priceNegotiable: sale.priceNegotiable === true, bankApprovals: arr(sale.bankApprovals),
    monthlyRent: str(p.monthlyRent), securityDeposit: str(p.securityDeposit), maintenance: str(p.maintenance), preferredTenants: str(rent.preferredTenants), petFriendly: rent.petFriendly === true, vegOnly: rent.vegOnly === true,
    lockInPeriodMonths: str(rent.lockInPeriodMonths), noticePeriodMonths: str(rent.noticePeriodMonths),
    propertyAge: str(p.propertyAge), possessionStatus: str(p.possessionStatus) || 'ready_to_move', availableFrom: str(p.availableFrom).slice(0, 10),
    nearby: Array.isArray(p.nearbyPlaces) ? p.nearbyPlaces.map((n: Data) => ({ name: str(n.name), category: str(n.category) || 'landmark', distance: str(n.distance), travelTime: str(n.travelTime) })) : [],
    videoTourUrl: str(p.videoTourUrl), floorPlanUrl: str(p.floorPlanUrl), description: str(p.description),
  };
}

function buildPayload(f: F, existing?: Data): Data {
  const fam = family(f.propertyType), sale = f.listingPurpose === 'sale';
  const lat = num(f.lat), lng = num(f.lng);
  const payload: Data = {
    propertyType: f.propertyType, listingPurpose: f.listingPurpose, transactionType: f.transactionType, title: f.title.trim(), societyName: f.societyName.trim() || undefined, description: f.description.trim() || undefined,
    location: { ...(existing?.location || {}), city: f.city.trim(), locality: f.locality.trim(), subLocality: f.subLocality.trim() || undefined, pincode: f.pincode.trim() || undefined, addressLine: f.addressLine.trim() || undefined,
      ...(lat != null && lng != null ? { geo: { type: 'Point', coordinates: [lng, lat] } } : {}) },
    propertyAge: f.propertyAge || undefined, possessionStatus: f.possessionStatus || undefined, availableFrom: f.availableFrom ? new Date(`${f.availableFrom}T00:00:00`).toISOString() : undefined,
    videoTourUrl: f.videoTourUrl.trim() || undefined, floorPlanUrl: f.floorPlanUrl.trim() || undefined, facing: f.facing || undefined,
    utilities: { waterSource: f.waterSource, powerBackup: f.powerBackup || undefined, pipedGas: f.pipedGas, liftsCount: num(f.liftsCount) },
    overlooking: f.overlooking, gatedSecurity: f.gatedSecurity,
    nearbyPlaces: (f.nearby as Nearby[]).filter(n => n.name.trim()).map(n => ({ name: n.name.trim(), category: n.category || 'landmark', distance: num(n.distance), distanceUnit: 'km', travelTime: n.travelTime.trim() || undefined })),
  };
  const put = (key: string, value: unknown) => { if (value !== undefined) payload[key] = value; };
  if (fam === 'residential') {
    for (const key of ['bhk', 'bedrooms', 'bathrooms', 'balconies', 'carpetArea', 'builtUpArea', 'superBuiltUpArea', 'floorNumber', 'totalFloors']) put(key, num(f[key]));
    payload.additionalRooms = f.additionalRooms;
  } else if (fam === 'plot') {
    put('plotArea', num(f.plotArea)); put('plotDimensions', f.plotDimensions.trim() || undefined); put('roadWidth', num(f.roadWidth)); payload.isCornerPlot = f.isCornerPlot;
  } else {
    put('commercialSubtype', f.commercialSubtype || undefined);
    for (const key of ['builtUpArea', 'carpetArea', 'floorNumber', 'totalFloors']) put(key, num(f[key]));
  }
  if (fam !== 'plot') {
    payload.furnishing = f.furnishing;
    if (f.furnishing !== 'unfurnished') {
      const details: Data = {};
      for (const key of APPLIANCES) details[key] = (f.appliances as string[]).includes(key);
      for (const key of ['wardrobesCount', 'acCount', 'bedCount', 'geyserCount', 'fansCount']) details[key] = num(f[key]) ?? 0;
      payload.furnishingDetails = details;
    }
    payload.parking = { coveredCars: num(f.coveredCars) ?? 0, openCars: num(f.openCars) ?? 0, twoWheeler: f.twoWheeler, evCharging: f.evCharging };
  }
  if (sale) {
    payload.price = num(f.price);
    payload.saleTerms = { ownershipType: f.ownershipType || undefined, khataType: f.khataType || undefined, priceNegotiable: f.priceNegotiable, bankApprovals: f.bankApprovals };
  } else {
    payload.monthlyRent = num(f.monthlyRent); put('securityDeposit', num(f.securityDeposit)); put('maintenance', num(f.maintenance));
    payload.rentalTerms = { preferredTenants: f.preferredTenants || undefined, petFriendly: f.petFriendly, vegOnly: f.vegOnly, lockInPeriodMonths: num(f.lockInPeriodMonths), noticePeriodMonths: num(f.noticePeriodMonths) };
  }
  return payload;
}

export function PropertyWizard({ mode, propertyId, initial, onNeedCredits }: { mode: 'create' | 'edit'; propertyId?: string; initial?: Data; onNeedCredits?: () => void }) {
  const [form, setForm] = useState<F>(() => initial ? formFromProperty(initial) : emptyForm());
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(mode === 'edit' ? 4 : 0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState('');
  const dirty = useRef(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const fam = family(form.propertyType);
  const sale = form.listingPurpose === 'sale';
  const minPhotos = minPhotosFor(form.propertyType);
  const set = (key: string) => (value: any) => { dirty.current = true; setSaved(false); setForm(current => ({ ...current, [key]: value })); };
  const hasPin = num(form.lat) != null && num(form.lng) != null;

  function validate(index: number): string {
    if (index === 0) {
      if (form.title.trim().length < 4) return 'Enter a listing title of at least 4 characters.';
      if (form.title.trim().length > 200) return 'The listing title can be at most 200 characters.';
      if (!form.city.trim() || !form.locality.trim()) return 'Enter the city and locality of the property.';
      const lat = num(form.lat), lng = num(form.lng);
      if (lat == null || lng == null) return 'Set the map pin — buyers and the review team need the exact location. Use your current location, search the address, or enter the coordinates.';
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'The map pin coordinates are not valid.';
    }
    if (index === 3) {
      if (sale && !(num(form.price) && num(form.price)! > 0)) return 'Please enter a valid selling price.';
      if (!sale && !(num(form.monthlyRent) && num(form.monthlyRent)! > 0)) return 'Please enter a valid monthly rent.';
      if (form.availableFrom && !/^\d{4}-\d{2}-\d{2}$/.test(form.availableFrom)) return 'Enter the available-from date as YYYY-MM-DD.';
    }
    if (index === 4 && mode === 'create' && (photos.length < minPhotos || photos.length > MAX_PHOTOS)) return `Upload between ${minPhotos} and ${MAX_PHOTOS} photos for this property type.`;
    return '';
  }

  function go(index: number) { setError(''); setStep(index); scroller.current?.scrollTo({ y: 0, animated: false }); }
  function next() {
    const problem = validate(step);
    if (problem) { setError(problem); return; }
    setReached(current => Math.max(current, step + 1)); go(step + 1);
  }

  function close() {
    const leave = () => router.canGoBack() ? router.back() : router.replace('/realtor/dashboard?tab=properties' as never);
    if (!dirty.current) { leave(); return; }
    Alert.alert('Discard unsaved changes?', 'Your entries on this form will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: leave }]);
  }

  async function applyPin(lat: number, lng: number) {
    dirty.current = true;
    setForm(current => ({ ...current, lat: String(Number(lat.toFixed(6))), lng: String(Number(lng.toFixed(6))) }));
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (place) setForm(current => ({ ...current, city: current.city || place.city || place.subregion || '', locality: current.locality || place.district || place.subregion || '', pincode: current.pincode || place.postalCode || '' }));
    } catch { /* address look-up is optional */ }
  }
  async function locateMe() {
    setPinBusy(true); setPinMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setPinMessage('Location permission was denied. Search the address or enter the coordinates instead.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await applyPin(position.coords.latitude, position.coords.longitude);
      setPinMessage('Pin set to your current location. If you are not at the property, search its address instead.');
    } catch { setPinMessage('Could not read your location. Search the address or enter the coordinates instead.'); }
    finally { setPinBusy(false); }
  }
  async function findFromAddress() {
    const query = [form.addressLine, form.subLocality, form.locality, form.city, form.pincode].filter((part: string) => part.trim()).join(', ');
    if (!form.city.trim() || !form.locality.trim()) { setPinMessage('Enter the city and locality first.'); return; }
    setPinBusy(true); setPinMessage('');
    try {
      const [hit] = await Location.geocodeAsync(query);
      if (!hit) { setPinMessage('No match found for this address. Add more detail or enter the coordinates.'); return; }
      await applyPin(hit.latitude, hit.longitude);
      setPinMessage('Pin placed from the address. Check it in Maps to be sure.');
    } catch { setPinMessage('Address search is unavailable right now. Use your current location or enter the coordinates.'); }
    finally { setPinBusy(false); }
  }

  async function choosePhotos() {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { setError(`You can attach up to ${MAX_PHOTOS} photos.`); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.85 });
    if (result.canceled) return;
    dirty.current = true; setError('');
    setPhotos(current => [...current, ...result.assets.slice(0, room).map((asset, index) => ({ uri: asset.uri, name: asset.fileName || `property-${Date.now()}-${index}.jpg`, mimeType: asset.mimeType || 'image/jpeg' }))]);
  }

  async function submit() {
    for (let index = 0; index <= 4; index += 1) {
      const problem = validate(index);
      if (problem) { setError(problem); go(index); return; }
    }
    setBusy(true); setError(''); setProgress('');
    try {
      if (mode === 'edit' && propertyId) {
        const body = buildPayload(form, initial);
        for (const key of ['furnishingDetails', 'parking', 'utilities', 'saleTerms', 'rentalTerms']) delete (body[key] as Data | undefined)?._id;
        await realtorApi.properties('PUT', body, propertyId);
        dirty.current = false; setSaved(true); scroller.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      const created = await realtorApi.properties('POST', buildPayload(form));
      const property = (created.property && typeof created.property === 'object' ? created.property : created) as Data;
      const id = str(property._id || property.id);
      if (!id) throw new Error('The server created the property without returning its ID.');
      let failed = 0;
      for (const [index, photo] of photos.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${photos.length}…`);
        try { await realtorApi.uploadMedia({ uri: photo.uri, name: photo.name, mimeType: photo.mimeType }, { resourceType: 'property', resourceId: id, type: 'gallery', isPrimary: index === 0, sortOrder: index }); }
        catch { failed += 1; }
      }
      dirty.current = false;
      if (failed) Alert.alert('Property created', `${failed} of ${photos.length} photos could not be uploaded. Add them from Edit before submitting for review.`);
      router.replace('/realtor/dashboard?tab=properties' as never);
    } catch (cause) {
      if (cause instanceof PartnerApiError && (cause.status === 402 || cause.code === 'LISTING_QUOTA_EXCEEDED')) { setError("You're out of listing credits. Buy a pack to post this property — nothing was created."); onNeedCredits?.(); }
      else if (cause instanceof PartnerApiError && cause.code === 'LOCATION_PIN_REQUIRED') { setError(cause.message); go(0); }
      else setError(cause instanceof Error ? cause.message : 'Could not save this property.');
    } finally { setBusy(false); setProgress(''); }
  }

  const updateNearby = (index: number, patch: Partial<Nearby>) => set('nearby')((form.nearby as Nearby[]).map((row, i) => i === index ? { ...row, ...patch } : row));
  const typeOptions = useMemo(() => toOptions(PROPERTY_TYPES), []);
  const num2 = (key: string, label: string, props: Record<string, any> = {}) => <FormField label={label} value={form[key]} onChangeText={set(key)} keyboardType="numeric" {...props} />;

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.header}>
      <Text style={s.headerTitle}>{mode === 'edit' ? 'Edit Property Details' : 'Post New Property'}</Text>
      <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close"><Icon name="x" size={26} color="#4d5f57" /></Pressable>
    </View>
    <View style={s.tabsPad}><StepTabs steps={STEPS} current={step} reached={reached} onSelect={go} /></View>
    <ScrollView ref={scroller} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
      {saved ? <AlertBanner tone="green" icon="check" title="Property changes saved" message="If this property has a live listing, buyers now see the updated details." /> : null}
      {error ? <AlertBanner tone="red" icon="shield" title="Please check this step" message={error} /> : null}

      {step === 0 ? <>
        <SelectField label="Property Type" required value={form.propertyType} options={typeOptions} onChange={set('propertyType')} />
        <SelectField label="Listing Purpose" required value={form.listingPurpose} options={[{ value: 'sale', label: 'For Sale (Resale / Direct)' }, { value: 'rent', label: 'For Rent / Lease' }]} onChange={set('listingPurpose')} />
        <SelectField label="Transaction Type" required value={form.transactionType} options={[{ value: 'resale', label: 'Resale' }, { value: 'new_booking', label: 'New Booking / Direct' }]} onChange={set('transactionType')} />
        <FormField label="Listing Title" required value={form.title} onChangeText={set('title')} placeholder="e.g. Luxurious 3 BHK East-Facing Apartment" maxLength={200} />
        <FormField label="Society / Building Name (Recommended)" value={form.societyName} onChangeText={set('societyName')} placeholder="e.g. My Home Bhooja, Prestige Falcon City" maxLength={200} />
        <SectionLabel icon="mapPin" title="Locality & Address" />
        <FormField label="City" required value={form.city} onChangeText={set('city')} placeholder="e.g. Hyderabad" />
        <FormField label="Locality / Area" required value={form.locality} onChangeText={set('locality')} placeholder="e.g. Gachibowli, Hitec City, Madhapur" />
        <FormField label="Sub-locality / Landmark / Street" value={form.subLocality} onChangeText={set('subLocality')} placeholder="e.g. Near Financial District, Lane 4" />
        <FormField label="Pincode" value={form.pincode} onChangeText={set('pincode')} keyboardType="numeric" maxLength={6} placeholder="e.g. 500032" />
        <FormField label="Address Line" value={form.addressLine} onChangeText={set('addressLine')} placeholder="House / plot number, street" />
        <SectionLabel icon="navigation" title="Map pin" />
        <View style={[s.pin, hasPin && s.pinOn]}>
          <View style={s.pinTop}><Icon name={hasPin ? 'check' : 'mapPin'} size={20} color={hasPin ? palette.greenText : palette.amber} /><Text style={s.pinText}>{hasPin ? `Pin set · ${form.lat}, ${form.lng}` : 'Pin not set yet — required to submit for review'}</Text></View>
          <View style={s.pinBtns}>
            <PillButton title="Use my location" icon="navigation" variant="soft" compact grow onPress={() => void locateMe()} loading={pinBusy} />
            <PillButton title="Find from address" icon="search" variant="soft" compact grow onPress={() => void findFromAddress()} loading={pinBusy} />
          </View>
          {pinMessage ? <Text style={s.pinMsg}>{pinMessage}</Text> : null}
          <View style={s.pinBtns}>
            <View style={{ flex: 1 }}><FormField label="Latitude" value={form.lat} onChangeText={set('lat')} keyboardType="decimal-pad" placeholder="17.4239" /></View>
            <View style={{ flex: 1 }}><FormField label="Longitude" value={form.lng} onChangeText={set('lng')} keyboardType="decimal-pad" placeholder="78.3489" /></View>
          </View>
          {hasPin ? <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${form.lat},${form.lng}`)}><Text style={s.link}>Check this pin in Google Maps</Text></Pressable> : null}
        </View>
      </> : null}

      {step === 1 ? <>
        {fam === 'residential' ? <>
          <ChipGroup label="BHK" options={['1', '2', '3', '4', '5'].map(v => ({ value: v, label: `${v} BHK` }))} value={form.bhk} onChange={(v: string) => { set('bhk')(v); if (v && !form.bedrooms) set('bedrooms')(v); }} />
          <View style={s.two}><View style={s.flex}>{num2('bedrooms', 'Bedrooms')}</View><View style={s.flex}>{num2('bathrooms', 'Bathrooms')}</View></View>
          <View style={s.two}><View style={s.flex}>{num2('balconies', 'Balconies')}</View><View style={s.flex}>{num2('floorNumber', 'Floor no.', { helper: '0 = Ground' })}</View></View>
          {num2('totalFloors', 'Total floors')}
          <ChipGroup label="Facing" options={toOptions(FACING)} value={form.facing} onChange={set('facing')} />
          <ChipGroup label="Additional rooms" multi options={toOptions(EXTRA_ROOMS)} value={form.additionalRooms} onChange={set('additionalRooms')} />
          {num2('carpetArea', 'Carpet area (sq ft)', { keyboardType: 'decimal-pad' })}
          {num2('builtUpArea', 'Built-up area (sq ft)', { keyboardType: 'decimal-pad' })}
          {num2('superBuiltUpArea', 'Super built-up area (sq ft)', { keyboardType: 'decimal-pad' })}
        </> : null}
        {fam === 'plot' ? <>
          {num2('plotArea', 'Plot area (sq ft)', { keyboardType: 'decimal-pad' })}
          <FormField label="Plot dimensions" value={form.plotDimensions} onChangeText={set('plotDimensions')} placeholder="e.g. 30 x 40" />
          {num2('roadWidth', 'Road width (ft)', { keyboardType: 'decimal-pad' })}
          <ChipGroup label="Facing" options={toOptions(FACING)} value={form.facing} onChange={set('facing')} />
        </> : null}
        {fam === 'commercial' ? <>
          <SelectField label="Commercial type" value={form.commercialSubtype} options={toOptions(COMMERCIAL_SUBTYPES)} onChange={set('commercialSubtype')} placeholder="Select type" />
          {num2('builtUpArea', 'Built-up area (sq ft)', { keyboardType: 'decimal-pad' })}
          {num2('carpetArea', 'Carpet area (sq ft)', { keyboardType: 'decimal-pad' })}
          <View style={s.two}><View style={s.flex}>{num2('floorNumber', 'Floor no.', { helper: '0 = Ground' })}</View><View style={s.flex}>{num2('totalFloors', 'Total floors')}</View></View>
          <ChipGroup label="Facing" options={toOptions(FACING)} value={form.facing} onChange={set('facing')} />
        </> : null}
      </> : null}

      {step === 2 ? <>
        {fam !== 'plot' ? <>
          <ChipGroup label="Furnishing" required options={[{ value: 'unfurnished', label: 'Unfurnished' }, { value: 'semi_furnished', label: 'Semi-Furnished' }, { value: 'fully_furnished', label: 'Fully Furnished' }]} value={form.furnishing} onChange={set('furnishing')} />
          {form.furnishing !== 'unfurnished' ? <>
            <ChipGroup label="What is included" multi options={APPLIANCES.map(key => ({ value: key, label: APPLIANCE_LABELS[key] }))} value={form.appliances} onChange={set('appliances')} />
            <View style={s.two}><View style={s.flex}>{num2('wardrobesCount', 'Wardrobes')}</View><View style={s.flex}>{num2('acCount', 'ACs')}</View></View>
            <View style={s.two}><View style={s.flex}>{num2('bedCount', 'Beds')}</View><View style={s.flex}>{num2('geyserCount', 'Geysers')}</View></View>
            {num2('fansCount', 'Fans')}
          </> : null}
          <SectionLabel icon="layers" title="Parking" />
          <View style={s.two}><View style={s.flex}>{num2('coveredCars', 'Covered cars')}</View><View style={s.flex}>{num2('openCars', 'Open cars')}</View></View>
          <ToggleRow label="Two-wheeler parking" value={form.twoWheeler} onChange={set('twoWheeler')} />
          <ToggleRow label="EV charging" value={form.evCharging} onChange={set('evCharging')} />
        </> : null}
        <SectionLabel icon="zap" title="Utilities" />
        <ChipGroup label="Water source" multi options={toOptions(WATER)} value={form.waterSource} onChange={set('waterSource')} />
        <ChipGroup label="Power backup" options={toOptions(POWER)} value={form.powerBackup} onChange={set('powerBackup')} />
        <ToggleRow label="Piped gas" value={form.pipedGas} onChange={set('pipedGas')} />
        {fam !== 'plot' ? num2('liftsCount', 'Lifts') : null}
        <ChipGroup label="Overlooking" multi options={toOptions(OVERLOOKING)} value={form.overlooking} onChange={set('overlooking')} />
        {fam === 'plot' ? <ToggleRow label="Corner plot" value={form.isCornerPlot} onChange={set('isCornerPlot')} /> : null}
        <ToggleRow label="Gated security" value={form.gatedSecurity} onChange={set('gatedSecurity')} />
      </> : null}

      {step === 3 ? <>
        {sale ? <>
          <FormField label="Total selling price (₹)" required value={form.price} onChangeText={set('price')} keyboardType="numeric" prefix="₹" placeholder="14500000" />
          <SelectField label="Ownership / title type" value={form.ownershipType} options={toOptions(OWNERSHIP)} onChange={set('ownershipType')} placeholder="Select" />
          <SelectField label="Khata type" value={form.khataType} options={toOptions(KHATA, KHATA_LABELS)} onChange={set('khataType')} placeholder="Select" />
          <ToggleRow label="Price negotiable" value={form.priceNegotiable} onChange={set('priceNegotiable')} />
          <ChipGroup label="Bank approvals" multi options={BANKS.map(b => ({ value: b, label: b }))} value={form.bankApprovals} onChange={set('bankApprovals')} />
        </> : <>
          <FormField label="Monthly rent (₹)" required value={form.monthlyRent} onChangeText={set('monthlyRent')} keyboardType="numeric" prefix="₹" />
          <FormField label="Security deposit (₹)" value={form.securityDeposit} onChangeText={set('securityDeposit')} keyboardType="numeric" prefix="₹" />
          <FormField label="Maintenance (₹ / month)" value={form.maintenance} onChangeText={set('maintenance')} keyboardType="numeric" prefix="₹" />
          <ChipGroup label="Preferred tenants" options={toOptions(TENANTS)} value={form.preferredTenants} onChange={set('preferredTenants')} />
          <ToggleRow label="Pet friendly" value={form.petFriendly} onChange={set('petFriendly')} />
          <ToggleRow label="Vegetarian only" value={form.vegOnly} onChange={set('vegOnly')} />
          <View style={s.two}><View style={s.flex}>{num2('lockInPeriodMonths', 'Lock-in (months)')}</View><View style={s.flex}>{num2('noticePeriodMonths', 'Notice (months)')}</View></View>
        </>}
        <SelectField label="Age of property" value={form.propertyAge} options={toOptions(AGE, AGE_LABELS)} onChange={set('propertyAge')} placeholder="Select" />
        <ChipGroup label="Possession status" options={[{ value: 'ready_to_move', label: 'Ready to move' }, { value: 'under_construction', label: 'Under construction' }]} value={form.possessionStatus} onChange={set('possessionStatus')} required />
        <FormField label="Available from" value={form.availableFrom} onChangeText={set('availableFrom')} placeholder="YYYY-MM-DD" keyboardType="numeric" />
      </> : null}

      {step === 4 ? <>
        <SectionLabel icon="mapPin" title="Nearby places" />
        {(form.nearby as Nearby[]).map((row, index) => <View key={index} style={s.nearby}>
          <View style={s.nearbyHead}><Text style={s.nearbyTitle}>Landmark {index + 1}</Text><Pressable onPress={() => set('nearby')((form.nearby as Nearby[]).filter((_, i) => i !== index))} hitSlop={8}><Icon name="trash" size={18} color="#c0605a" /></Pressable></View>
          <FormField label="Name" value={row.name} onChangeText={v => updateNearby(index, { name: v })} placeholder="e.g. Gachibowli Metro" />
          <SelectField label="Category" value={row.category} options={toOptions(NEARBY)} onChange={v => updateNearby(index, { category: v })} />
          <View style={s.two}><View style={s.flex}><FormField label="Distance (km)" value={row.distance} onChangeText={v => updateNearby(index, { distance: v })} keyboardType="decimal-pad" /></View><View style={s.flex}><FormField label="Travel time" value={row.travelTime} onChangeText={v => updateNearby(index, { travelTime: v })} placeholder="5 min" /></View></View>
        </View>)}
        <View style={{ alignSelf: 'flex-start' }}><PillButton title="Add Landmark" icon="plus" variant="soft" compact onPress={() => set('nearby')([...(form.nearby as Nearby[]), { name: '', category: 'metro', distance: '', travelTime: '' }])} /></View>
        <FormField label="Video tour URL" value={form.videoTourUrl} onChangeText={set('videoTourUrl')} keyboardType="url" placeholder="https://…" />
        <FormField label="Floor plan link" value={form.floorPlanUrl} onChangeText={set('floorPlanUrl')} keyboardType="url" placeholder="https://…" />
        <FormField label="Description" value={form.description} onChangeText={set('description')} multiline maxLength={5000} placeholder="Tell buyers what makes this property special" helper={`${form.description.length} / 5000`} />
        {mode === 'create' ? <>
          <SectionLabel icon="image" title="Photos" />
          <Text style={[s.count, photos.length >= minPhotos && photos.length <= MAX_PHOTOS && { color: palette.greenText }]}>{photos.length} photo{photos.length === 1 ? '' : 's'} (min {minPhotos}, max {MAX_PHOTOS})</Text>
          <ProgressBar value={Math.min(100, (photos.length / minPhotos) * 100)} />
          <View style={s.grid}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={s.thumb}>
            <Image source={{ uri: photo.uri }} style={s.thumbImg} />
            {index === 0 ? <View style={s.cover}><Text style={s.coverText}>Cover</Text></View> : null}
            <Pressable style={s.remove} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))} hitSlop={6}><Icon name="x" size={14} color="#fff" /></Pressable>
          </View>)}</View>
          <PillButton title={photos.length ? 'Add more photos' : 'Add photos'} icon="image" variant="soft" onPress={() => void choosePhotos()} />
        </> : initial ? <MediaManager resourceType="property" resourceId={String(propertyId)} /> : null}
      </> : null}
    </ScrollView>
    <View style={s.bar}>
      {progress ? <Text style={s.progress}>{progress}</Text> : null}
      <View style={s.barRow}>
        {step > 0 ? <PillButton title="Back" variant="ghost" onPress={() => go(step - 1)} disabled={busy} grow /> : null}
        {step < 4 ? <PillButton title="Continue" icon="arrowRight" onPress={next} grow /> : <PillButton title={mode === 'edit' ? 'Save Changes' : 'Create Property'} icon={mode === 'edit' ? 'check' : 'send'} onPress={() => void submit()} loading={busy} grow />}
      </View>
      {step === 4 && mode === 'edit' ? null : step < 4 && mode === 'edit' ? <Pressable onPress={() => void submit()} disabled={busy}><Text style={s.saveNow}>Save changes now</Text></Pressable> : null}
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line },
  headerTitle: { color: palette.ink, fontSize: 21, fontWeight: '800' }, tabsPad: { paddingHorizontal: 16 }, body: { padding: 18, gap: 14, paddingBottom: 30 }, flex: { flex: 1 }, two: { flexDirection: 'row', gap: 10 },
  pin: { borderWidth: 1.5, borderColor: '#f1dfb0', backgroundColor: '#fff9ec', borderRadius: 22, padding: 14, gap: 12 }, pinOn: { borderColor: '#bfe0cf', backgroundColor: '#f1faf5' },
  pinTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, pinText: { flex: 1, color: palette.ink, fontSize: 14, fontWeight: '700' }, pinBtns: { flexDirection: 'row', gap: 10 }, pinMsg: { color: palette.body, fontSize: 13, lineHeight: 19 }, link: { color: palette.greenText, fontSize: 13, fontWeight: '800' },
  nearby: { borderWidth: 1, borderColor: palette.line, borderRadius: 20, padding: 14, gap: 10, backgroundColor: '#fafcfb' }, nearbyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, nearbyTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  count: { color: palette.amber, fontSize: 14, fontWeight: '800' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, thumb: { width: '31%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: palette.greenSoft }, thumbImg: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(16,35,28,0.75)', alignItems: 'center', justifyContent: 'center' }, cover: { position: 'absolute', left: 5, bottom: 5, backgroundColor: palette.green, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }, coverText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bar: { padding: 14, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line, backgroundColor: '#fff' }, barRow: { flexDirection: 'row', gap: 10 }, progress: { color: palette.greenText, fontSize: 13, fontWeight: '800', textAlign: 'center' }, saveNow: { color: palette.greenText, fontSize: 14, fontWeight: '800', textAlign: 'center', paddingVertical: 4 },
});
