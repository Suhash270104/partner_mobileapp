import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { PartnerApiError, partnerApi, SERVICE_SLOT_OPTIONS, TechnicianProfileRecord, WEEKDAY_LABELS } from '../../lib/partnerApi';
import { getEquipmentForCategories, getEquipmentLabel } from '../../lib/technicianEquipment';
import { isExpoGo } from '../../lib/runtime';
import { colors } from '../../components/technician/jobUi';

type MapsModule = typeof import('react-native-maps');
type Place = { title: string; subtitle: string; lat: number; lng: number; city: string; accuracyM: number | null };

const RADIUS_OPTIONS = [5, 10, 15, 20];
const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export default function TechnicianEditProfileScreen() {
  const [profile, setProfile] = useState<TechnicianProfileRecord | null>(null);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('bank');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [maps, setMaps] = useState<MapsModule | null>(null);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [areaBusy, setAreaBusy] = useState(false);
  const [areaError, setAreaError] = useState('');
  const [areaSaved, setAreaSaved] = useState(false);

  const [slotDraft, setSlotDraft] = useState<Record<number, string[]>>({});
  const [slotBusy, setSlotBusy] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [slotSaved, setSlotSaved] = useState(false);

  const checklist = useMemo(() => getEquipmentForCategories(profile?.categories || []), [profile?.categories]);

  function hydrate(technician: TechnicianProfileRecord) {
    setProfile(technician);
    setName(technician.name || '');
    setBio(technician.bio || '');
    setExperienceYears(technician.experienceYears != null ? String(technician.experienceYears) : '');
    setPayoutMethod(technician.bankDetails?.upiId ? 'upi' : 'bank');
    setUpiId(technician.bankDetails?.upiId || '');
    setAccountNumber(technician.bankDetails?.accountNumber || '');
    setIfscCode(technician.bankDetails?.ifscCode || '');
    setEquipment(technician.equipmentChecklist || []);
    setRadiusKm(technician.serviceRadiusKm || 10);
    const c = technician.coordinates;
    if (c?.lat != null && c.lng != null) {
      setPlace({ title: technician.baseAddress?.split(',')[0] || technician.city, subtitle: technician.baseAddress || technician.city, lat: c.lat, lng: c.lng, city: technician.city, accuracyM: technician.baseAccuracyM ?? null });
    }
    const draft: Record<number, string[]> = {};
    (technician.availabilitySlots || []).forEach(entry => { draft[entry.dayOfWeek] = entry.slots || []; });
    setSlotDraft(draft);
  }

  useEffect(() => {
    let active = true;
    partnerApi.technicianProfile()
      .then(({ technician }) => { if (active) hydrate(technician); })
      .catch(error => {
        if (!active) return;
        if (error instanceof PartnerApiError && error.status === 401) router.replace('/');
        else setLoadError(errorMessage(error, 'Could not load your profile.'));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isExpoGo()) return;
    let active = true;
    void import('react-native-maps').then(module => { if (active) setMaps(module); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 3) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await partnerApi.forwardGeocode(normalized);
        if (!active) return;
        await selectCoordinates(result.lat, result.lng, null, result.formattedAddress);
      } catch (error) {
        if (active) setAreaError(errorMessage(error, 'Location search is unavailable.'));
      }
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  async function selectCoordinates(lat: number, lng: number, accuracyM: number | null = null, knownAddress?: string) {
    setAreaError('');
    setAreaSaved(false);
    try {
      const result = await partnerApi.reverseGeocode(lat, lng);
      const label = knownAddress || result.address?.formattedAddress || [result.address?.locality, result.address?.city].filter(Boolean).join(', ');
      if (!label) throw new Error('Could not resolve this location to an address.');
      setPlace({ title: label.split(',')[0], subtitle: label, lat, lng, city: result.address?.city || '', accuracyM });
    } catch (error) {
      setAreaError(errorMessage(error, 'Could not resolve this location.'));
    }
  }

  async function locateMe() {
    setAreaBusy(true);
    setAreaError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission is off. Search for an area instead.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await selectCoordinates(current.coords.latitude, current.coords.longitude, current.coords.accuracy ? Math.round(current.coords.accuracy) : null);
    } catch (error) {
      setAreaError(errorMessage(error, 'Could not get your location.'));
    } finally {
      setAreaBusy(false);
    }
  }

  async function saveArea() {
    if (!place) { setAreaError('Drop your pin first: search your area, tap the map, or use your location.'); return; }
    setAreaBusy(true);
    setAreaError('');
    try {
      const { technician } = await partnerApi.updateTechnicianProfile({
        coordinates: { lat: place.lat, lng: place.lng },
        baseAddress: place.subtitle,
        baseAccuracyM: place.accuracyM,
        city: place.city,
        serviceRadiusKm: radiusKm,
      });
      setProfile(technician);
      setAreaSaved(true);
    } catch (error) {
      setAreaError(errorMessage(error, 'Could not save your service area'));
    } finally {
      setAreaBusy(false);
    }
  }

  async function saveSlots() {
    setSlotBusy(true);
    setSlotError('');
    setSlotSaved(false);
    try {
      const availabilitySlots = Object.entries(slotDraft)
        .map(([day, slots]) => ({ dayOfWeek: Number(day), slots }))
        .filter(entry => entry.slots.length > 0);
      const { technician } = await partnerApi.updateTechnicianProfile({ availabilitySlots });
      setProfile(technician);
      setSlotSaved(true);
    } catch (error) {
      setSlotError(errorMessage(error, 'Could not save your availability'));
    } finally {
      setSlotBusy(false);
    }
  }

  function toggleSlot(day: number, slot: string) {
    setSlotSaved(false);
    setSlotDraft(current => {
      const existing = current[day] || [];
      return { ...current, [day]: existing.includes(slot) ? existing.filter(s => s !== slot) : [...existing, slot] };
    });
  }

  async function saveProfile() {
    setSaveError('');
    setSaved(false);
    if (!name.trim()) { setSaveError('Please provide your name'); return; }
    if (payoutMethod === 'upi' && upiId.trim() && !/^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/.test(upiId.trim())) { setSaveError('Enter a valid UPI ID, for example name@bank.'); return; }
    if (payoutMethod === 'bank' && accountNumber.trim() && !/^\d{9,18}$/.test(accountNumber.replace(/\s/g, ''))) { setSaveError('Enter an account number containing 9 to 18 digits.'); return; }
    if (payoutMethod === 'bank' && (accountNumber.trim() || ifscCode.trim()) && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) { setSaveError('Enter a valid 11-character IFSC, for example HDFC0000123.'); return; }
    // KN Certified partners must keep every required tool they have already confirmed.
    const droppedRequired = profile?.type === 'KN_CERTIFIED'
      ? checklist.filter(item => item.required && (profile.equipmentChecklist || []).includes(item.id) && !equipment.includes(item.id))
      : [];
    if (droppedRequired.length) { setSaveError(`KN Certified partners must keep all required tools. Re-confirm: ${droppedRequired.map(item => item.label).join('; ')}`); return; }
    setSaving(true);
    try {
      const { technician } = await partnerApi.updateTechnicianProfile({
        name: name.trim(),
        bio: bio.trim(),
        experienceYears: Number(experienceYears) || 0,
        equipmentChecklist: equipment,
        bankDetails: {
          upiId: payoutMethod === 'upi' ? upiId.trim() : (profile?.bankDetails?.upiId || ''),
          accountNumber: payoutMethod === 'bank' ? accountNumber.replace(/\s/g, '') : (profile?.bankDetails?.accountNumber || ''),
          ifscCode: payoutMethod === 'bank' ? ifscCode.trim().toUpperCase() : (profile?.bankDetails?.ifscCode || ''),
        },
      });
      hydrate(technician);
      setSaved(true);
    } catch (error) {
      setSaveError(errorMessage(error, 'Failed to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  const knownIds = useMemo(() => new Set(checklist.map(item => item.id)), [checklist]);
  const extraTools = equipment.filter(item => !knownIds.has(item));
  const toggleTool = (id: string) => { setSaved(false); setEquipment(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); };

  const region: Region | undefined = place ? { latitude: place.lat, longitude: place.lng, latitudeDelta: 0.07, longitudeDelta: 0.07 } : undefined;
  const MapView = maps?.default;
  const MapMarker = maps?.Marker;
  const MapCircle = maps?.Circle;
  const isCertified = profile?.type === 'KN_CERTIFIED';

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back"><Text style={styles.back}>←</Text></Pressable>
      <View style={styles.flex}>
        <Text style={styles.brand}>KRAFTNEX PRO</Text>
        <Text style={styles.title}>Edit Profile</Text>
      </View>
    </View>

    {!profile && !loadError && <View style={styles.center}><ActivityIndicator color={colors.forest} /></View>}
    {!!loadError && <View style={styles.center}><Text style={styles.errorBox}>{loadError}</Text></View>}

    {profile && <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal & field profile</Text>
          <Text style={styles.label}>Full name / display name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={100} placeholder="Your full name" placeholderTextColor="#9aa8a2" />
          <View style={styles.readonly}><Text style={styles.readonlyLabel}>Primary phone</Text><Text style={styles.readonlyValue}>{profile.phone || '—'}</Text></View>
          <View style={styles.readonly}><Text style={styles.readonlyLabel}>Email</Text><Text style={styles.readonlyValue}>{profile.email || '—'}</Text></View>
          <Text style={styles.label}>Trade experience (years)</Text>
          <TextInput style={styles.input} value={experienceYears} onChangeText={text => setExperienceYears(text.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
          <Text style={styles.label}>Bio / about your work</Text>
          <TextInput style={[styles.input, styles.textArea]} value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="Describe your specialization, brands you service, and customer commitments…" placeholderTextColor="#9aa8a2" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Operational geo-settings</Text>
          <Text style={styles.muted}>Your base location and how far you will travel. Dispatch only matches you to customers inside this radius.</Text>
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search your base area" placeholderTextColor="#9aa8a2" />
          <Pressable disabled={areaBusy} style={styles.secondary} onPress={() => void locateMe()}><Text style={styles.secondaryText}>◎  Use my current location</Text></Pressable>
          {place && <View style={styles.placeBox}><Text style={styles.placeTitle}>{place.title}</Text><Text style={styles.muted}>{place.subtitle}</Text></View>}
          {MapView && MapMarker && MapCircle && place && region
            ? <View style={styles.mapWrap}>
              <MapView style={styles.map} region={region} onPress={event => void selectCoordinates(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}>
                <MapMarker coordinate={{ latitude: place.lat, longitude: place.lng }} draggable onDragEnd={event => void selectCoordinates(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)} />
                <MapCircle center={{ latitude: place.lat, longitude: place.lng }} radius={radiusKm * 1000} fillColor="rgba(16,185,129,0.14)" strokeColor="#0f382c" />
              </MapView>
            </View>
            : <View style={styles.mapPlaceholder}><Text style={styles.muted}>{place ? 'Map preview unavailable in this build.' : 'Search or use your location to drop your pin.'}</Text></View>}
          <Text style={styles.label}>Coverage radius</Text>
          <View style={styles.radiusRow}>{RADIUS_OPTIONS.map(option => <Pressable key={option} onPress={() => { setRadiusKm(option); setAreaSaved(false); }} style={[styles.radius, radiusKm === option && styles.radiusActive]}>
            <Text style={[styles.radiusText, radiusKm === option && styles.radiusTextActive]}>{option} km</Text>
          </Pressable>)}</View>
          {!!areaError && <Text style={styles.errorBox}>{areaError}</Text>}
          {areaSaved && <Text style={styles.success}>Service area saved.</Text>}
          <Pressable disabled={areaBusy} style={[styles.primary, areaBusy && styles.disabled]} onPress={() => void saveArea()}>
            {areaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save service area</Text>}
          </Pressable>
        </View>

        {isCertified && <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage my weekly slots</Text>
          <Text style={styles.muted}>Customers can only book you in the windows you mark open here.</Text>
          {WEEKDAY_LABELS.map((day, dayIndex) => <View key={day} style={styles.slotDay}>
            <Text style={styles.slotDayLabel}>{day}</Text>
            <View style={styles.slotWrap}>{SERVICE_SLOT_OPTIONS.map(slot => {
              const on = (slotDraft[dayIndex] || []).includes(slot);
              return <Pressable key={slot} onPress={() => toggleSlot(dayIndex, slot)} style={[styles.slot, on && styles.slotOn]} accessibilityState={{ selected: on }}>
                <Text style={[styles.slotText, on && styles.slotTextOn]}>{slot}</Text>
              </Pressable>;
            })}</View>
          </View>)}
          {!!slotError && <Text style={styles.errorBox}>{slotError}</Text>}
          {slotSaved && <Text style={styles.success}>Availability saved.</Text>}
          <Pressable disabled={slotBusy} style={[styles.primary, slotBusy && styles.disabled]} onPress={() => void saveSlots()}>
            {slotBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save availability</Text>}
          </Pressable>
        </View>}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Equipment & tooling audit</Text>
            <Text style={styles.count}>{equipment.length} confirmed</Text>
          </View>
          <Text style={styles.muted}>Confirm the tools and diagnostic equipment you carry on the field.</Text>
          {checklist.map(item => {
            const on = equipment.includes(item.id);
            return <Pressable key={item.id} onPress={() => toggleTool(item.id)} style={[styles.tool, on && styles.toolOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <View style={[styles.check, on && styles.checkOn]}>{on && <Text style={styles.checkMark}>✓</Text>}</View>
              <Text style={styles.toolText}>{item.label}</Text>
            </Pressable>;
          })}
          {extraTools.map(tool => <Pressable key={tool} onPress={() => toggleTool(tool)} style={[styles.tool, styles.toolOn]} accessibilityRole="checkbox" accessibilityState={{ checked: true }}>
            <View style={[styles.check, styles.checkOn]}><Text style={styles.checkMark}>✓</Text></View>
            <Text style={styles.toolText}>{getEquipmentLabel(tool)}</Text>
          </Pressable>)}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bank payout settings</Text>
          <Text style={styles.muted}>Completed-job payouts are sent to the destination you choose here.</Text>
          <View style={styles.radiusRow}>
            <Pressable onPress={() => setPayoutMethod('upi')} style={[styles.radius, payoutMethod === 'upi' && styles.radiusActive]}><Text style={[styles.radiusText, payoutMethod === 'upi' && styles.radiusTextActive]}>UPI ID</Text></Pressable>
            <Pressable onPress={() => setPayoutMethod('bank')} style={[styles.radius, payoutMethod === 'bank' && styles.radiusActive]}><Text style={[styles.radiusText, payoutMethod === 'bank' && styles.radiusTextActive]}>Bank account</Text></Pressable>
          </View>
          {payoutMethod === 'upi'
            ? <>
              <Text style={styles.label}>Virtual payment address (UPI ID)</Text>
              <TextInput style={styles.input} value={upiId} onChangeText={setUpiId} autoCapitalize="none" placeholder="e.g. mobile@upi or yourname@oksbi" placeholderTextColor="#9aa8a2" />
            </>
            : <>
              <Text style={styles.label}>Bank account number</Text>
              <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" placeholder="Account number" placeholderTextColor="#9aa8a2" />
              <Text style={styles.label}>Bank IFSC code</Text>
              <TextInput style={styles.input} value={ifscCode} onChangeText={text => setIfscCode(text.toUpperCase())} autoCapitalize="characters" maxLength={11} placeholder="e.g. HDFC0001234" placeholderTextColor="#9aa8a2" />
            </>}
        </View>

        {!!saveError && <Text style={styles.errorBox}>{saveError}</Text>}
        {saved && <Text style={styles.success}>Profile saved.</Text>}
        <View style={styles.footerRow}>
          <Pressable disabled={saving} style={[styles.cancel, styles.flex]} onPress={() => router.back()}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
          <Pressable disabled={saving} style={[styles.primary, styles.flex2, saving && styles.disabled]} onPress={() => void saveProfile()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save changes</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f3fc' },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { minHeight: 58, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8ecea', flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { color: colors.forest, fontSize: 24, fontWeight: '700' },
  brand: { color: '#e08a1e', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  content: { padding: 12, paddingBottom: 30, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { color: '#126744', backgroundColor: colors.soft, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '800' },
  label: { color: '#33463f', fontSize: 11, fontWeight: '800', marginTop: 4 },
  input: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: '#dfe6e2', backgroundColor: '#f8faf9', paddingHorizontal: 12, color: colors.ink, fontSize: 13, fontWeight: '600' },
  textArea: { minHeight: 84, paddingTop: 11, textAlignVertical: 'top' },
  readonly: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f3f6f4', borderRadius: 11, padding: 12 },
  readonlyLabel: { color: colors.muted, fontSize: 12 },
  readonlyValue: { color: '#33463f', fontSize: 12, fontWeight: '800' },
  secondary: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#cfe0d8', backgroundColor: '#f1f8f4', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  placeBox: { backgroundColor: '#f1f8f4', borderRadius: 11, padding: 11, gap: 2 },
  placeTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  mapWrap: { height: 190, borderRadius: 14, overflow: 'hidden' },
  map: { flex: 1 },
  mapPlaceholder: { minHeight: 90, borderRadius: 14, backgroundColor: '#f3f6f4', alignItems: 'center', justifyContent: 'center', padding: 14 },
  radiusRow: { flexDirection: 'row', gap: 8 },
  radius: { flex: 1, height: 42, borderRadius: 11, borderWidth: 1, borderColor: '#dfe6e2', alignItems: 'center', justifyContent: 'center' },
  radiusActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  radiusText: { color: '#3f5a50', fontSize: 12, fontWeight: '800' },
  radiusTextActive: { color: '#fff' },
  slotDay: { gap: 6, marginTop: 4 },
  slotDayLabel: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: '#dfe6e2', backgroundColor: '#f8faf9' },
  slotOn: { backgroundColor: '#12a878', borderColor: '#12a878' },
  slotText: { color: '#6b7c75', fontSize: 10, fontWeight: '800' },
  slotTextOn: { color: '#fff' },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, borderWidth: 1, borderColor: '#e2e9e5', padding: 11 },
  toolOn: { borderColor: '#bfe0cf', backgroundColor: '#f1f8f4' },
  toolText: { flex: 1, color: '#33463f', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#b7c9c1', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  primary: { height: 50, borderRadius: 13, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  cancel: { height: 50, borderRadius: 13, borderWidth: 1, borderColor: '#d9e3de', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  footerRow: { flexDirection: 'row', gap: 10 },
  disabled: { opacity: 0.5 },
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 11, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  success: { color: '#126744', fontSize: 12, fontWeight: '800' },
});
