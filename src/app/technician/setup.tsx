import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Circle, Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerBrand } from '../../components/PartnerBrand';
import { partnerApi, PartnerApiError, TechnicianProfileRecord, TechnicianServiceCategory } from '../../lib/partnerApi';
import { getEquipmentForCategories } from '../../lib/technicianEquipment';
import { getPartnerExpoPushToken, showPartnerNotification } from '../../lib/partnerNotifications';

type Tier = 'KN_CERTIFIED' | 'INDEPENDENT';
type Place = { title: string; subtitle: string; lat: number; lng: number; city: string };
type ProofItem = { data?: string; url?: string; label?: string };
type AddressProofType = 'UTILITY_BILL' | 'BANK_PASSBOOK' | 'RENT_AGREEMENT' | 'VOTER_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'RATION_CARD' | 'AADHAAR' | 'OTHER';
const addressProofTypes: { value: AddressProofType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook / Statement' },
  { value: 'RENT_AGREEMENT', label: 'Rent Agreement' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'RATION_CARD', label: 'Ration Card' },
  { value: 'OTHER', label: 'Other Government Document' },
];
const radiusOptions = [5, 10, 15, 20];

function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}

export default function TechnicianSetupScreen() {
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState<Tier | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [categories, setCategories] = useState<TechnicianServiceCategory[]>([]);
  const [servicesBusy, setServicesBusy] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [experience, setExperience] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', password: '' });
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [experienceLevel, setExperienceLevel] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [equipmentChecklist, setEquipmentChecklist] = useState<string[]>([]);
  const [expertiseNotes, setExpertiseNotes] = useState<Record<string, string>>({});
  const [expertiseProofs, setExpertiseProofs] = useState<Record<string, ProofItem[]>>({});
  const [expertiseStatuses, setExpertiseStatuses] = useState<Record<string, string>>({});
  const [bank, setBank] = useState({ accountNumber: '', accountNumberConfirm: '', ifscCode: '', upiId: '' });
  const [addressProofType, setAddressProofType] = useState<AddressProofType | null>(null);
  const [addressProofNumber, setAddressProofNumber] = useState('');
  const [addressProofFile, setAddressProofFile] = useState<{ data: string; name: string } | null>(null);
  const [skillCertificateFile, setSkillCertificateFile] = useState<{ data: string; name: string } | null>(null);
  const [legalDeclarations, setLegalDeclarations] = useState([false, false, false]);
  const [savedTechnician, setSavedTechnician] = useState<TechnicianProfileRecord | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedCategories = useMemo(() => categories.filter(category => category.sections.some(section => section.items.some(item => selected.has(item._id)))), [categories, selected]);
  const availableEquipment = useMemo(() => getEquipmentForCategories(selectedCategories.map(category => category.key)), [selectedCategories]);
  const requiredEquipment = useMemo(() => availableEquipment.filter(item => item.required), [availableEquipment]);
  const equipmentReadyCount = useMemo(() => equipmentChecklist.filter(id => requiredEquipment.some(item => item.id === id)).length, [equipmentChecklist, requiredEquipment]);

  useEffect(() => {
    let active = true;
    partnerApi.technicianServiceCatalog().then(result => {
      if (active) setCategories(result.categories);
    }).catch(error => {
      if (active) setServicesError(error instanceof Error ? error.message : 'Could not load the service catalog.');
    }).finally(() => { if (active) setServicesBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    partnerApi.technicianProfile().then(({ technician }) => {
      if (!active) return;
      setSavedTechnician(technician);
      setSubmitted(true);
      setTier(technician.type);
      setPhone(technician.phone || '');
      setProfile(current => ({ ...current, name: technician.name || '', email: technician.email || '' }));
      const serviceIds = technician.servicesOffered.map(item => typeof item === 'string' ? item : item._id);
      setSelected(new Set(serviceIds));
      const years = Object.fromEntries(technician.categoryExpertise.map(item => [item.categoryKey, String(item.experienceYears ?? '')]));
      setExperience(years);
      setExperienceLevel(String(technician.experienceYears ?? ''));
      setEquipmentChecklist(technician.equipmentChecklist || []);
      setExpertiseNotes(Object.fromEntries(technician.categoryExpertise.map(item => [item.categoryKey, item.note || ''])));
      setExpertiseProofs(Object.fromEntries(technician.categoryExpertise.map(item => [item.categoryKey, (item.proofs || []).map(proof => ({ url: proof.url, label: proof.label }))])));
      setExpertiseStatuses(Object.fromEntries(technician.categoryExpertise.map(item => [item.categoryKey, item.status || ''])));
      setBank({ accountNumber: technician.bankDetails?.accountNumber || '', accountNumberConfirm: technician.bankDetails?.accountNumber || '', ifscCode: technician.bankDetails?.ifscCode || '', upiId: technician.bankDetails?.upiId || '' });
      const proof = technician.documents?.addressProof;
      if (proof?.type && addressProofTypes.some(item => item.value === proof.type)) setAddressProofType(proof.type as AddressProofType);
      setAddressProofNumber(proof?.documentNumber || '');
      if (proof?.documentUrl) setAddressProofFile({ data: proof.documentUrl, name: 'Address proof uploaded' });
      if (technician.documents?.skillCertificationUrl) setSkillCertificateFile({ data: technician.documents.skillCertificationUrl, name: 'Certificate uploaded' });
      if (technician.coordinates?.lat != null && technician.coordinates.lng != null) {
        setPlace({ title: technician.baseAddress?.split(',')[0] || technician.city, subtitle: technician.baseAddress || technician.city, lat: technician.coordinates.lat, lng: technician.coordinates.lng, city: technician.city });
      }
      setRadiusKm(technician.serviceRadiusKm || 10);
      if (proof?.documentUrl) setStep(11);
      else if (technician.bankDetails?.accountNumber || technician.bankDetails?.ifscCode) setStep(10);
      else if ((technician.equipmentChecklist || []).length) setStep(8);
      else setStep(7);
    }).catch(error => {
      if (!active) return;
      const status = error instanceof PartnerApiError ? error.status : 0;
      if (status !== 401 && status !== 403 && status !== 404) setError(error instanceof Error ? error.message : 'Could not restore your technician setup.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await partnerApi.forwardGeocode(normalized);
        if (!active) return;
        const reverse = await partnerApi.reverseGeocode(result.lat, result.lng);
        const address = result.formattedAddress || reverse.address?.formattedAddress;
        if (!address) throw new Error('The location service did not resolve an address.');
        setPlaces([{ title: address.split(',')[0], subtitle: address, lat: result.lat, lng: result.lng, city: reverse.address?.city || '' }]);
      } catch (error) { if (active) { setPlaces([]); setError(error instanceof Error ? error.message : 'Location search is unavailable.'); } }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  async function selectCoordinates(lat: number, lng: number, accuracyM: number | null = null) {
    setPlace({ title: 'Resolving address…', subtitle: '', lat, lng, city: '' });
    setPlaces([]);
    try {
      const result = await partnerApi.reverseGeocode(lat, lng);
      const address = result.address;
      if (!address) throw new Error('No address was returned for this location.');
      const label = address.formattedAddress || [address.locality, address.city].filter(Boolean).join(', ');
      if (!label) throw new Error('Could not resolve this location to an address.');
      setPlace({ title: label.split(',')[0], subtitle: label, lat, lng, city: address.city || '' });
      setError('');
      if (accuracyM && accuracyM > 200) setNotice(`Location accuracy is about ${accuracyM} m. Move the map pin to your exact starting area.`);
      else setNotice('');
    } catch (error) {
      setPlace(null);
      setError(error instanceof Error ? error.message : 'Could not resolve this location.');
    }
  }

  async function handleUseMyLocation() {
    setBusy(true); setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission is off. Search for an area instead.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await selectCoordinates(current.coords.latitude, current.coords.longitude, current.coords.accuracy ? Math.round(current.coords.accuracy) : null);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not get your location.'); }
    finally { setBusy(false); }
  }

  async function sendOtp() {
    setBusy(true); setError('');
    try {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (cleanPhone.replace(/\D/g, '').length < 10) throw new Error('Enter a valid mobile number.');
      await partnerApi.sendTechnicianOtp(cleanPhone);
      void showPartnerNotification('Verification code sent', 'Check your SMS or WhatsApp for the code to continue setting up your account.');
      setPhone(cleanPhone); setStep(3);
    } catch (error) { setError(error instanceof PartnerApiError && error.status === 409 ? 'A technician account already exists for this mobile number.' : error instanceof Error ? error.message : 'Could not send the verification code.'); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setBusy(true); setError('');
    try {
      const pushToken = await getPartnerExpoPushToken();
      if (pushToken) setExpoPushToken(pushToken);
      const result = await partnerApi.verifyTechnicianOtp(phone, otp.trim(), pushToken);
      if (result.exists) throw new Error('A technician profile already uses this number. Sign in to continue.');
      if (!result.phoneVerificationToken) throw new Error('The server did not return phone verification. Please try again.');
      setOtpToken(result.phoneVerificationToken); setStep(4);
    } catch (error) { setError(error instanceof Error ? error.message : 'The verification code was not accepted.'); }
    finally { setBusy(false); }
  }

  function continueFromTier() {
    if (!tier) { setError('Choose a partner tier to continue.'); return; }
    setError(''); setStep(2);
  }

  async function saveEquipmentAndContinue() {
    if (!equipmentChecklist.length) { setError('Confirm the tools you currently have.'); return; }
    if (tier === 'KN_CERTIFIED') {
      const missing = requiredEquipment.filter(item => !equipmentChecklist.includes(item.id));
      if (missing.length) { setError(`Confirm all required tools to continue. ${missing.length} required ${missing.length === 1 ? 'item is' : 'items are'} still unchecked.`); return; }
    }
    setBusy(true); setError('');
    try {
      const result = await partnerApi.updateTechnicianProfile({ equipmentChecklist });
      setSavedTechnician(result.technician); setStep(8);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your equipment checklist.'); }
    finally { setBusy(false); }
  }

  async function saveExpertiseAndContinue() {
    setBusy(true); setError('');
    try {
      const categoryExpertise = selectedCategories.map(category => ({
        categoryKey: category.key,
        experienceYears: Number(experience[category.key] || experienceLevel || 0),
        note: expertiseNotes[category.key] || '',
        proofs: (expertiseProofs[category.key] || []).map(proof => proof.data ? { data: proof.data, label: proof.label } : { url: proof.url }),
      }));
      const result = await partnerApi.saveTechnicianExpertise({ servicesOffered: [...selected], categoryExpertise });
      setExpertiseStatuses(Object.fromEntries(result.categoryExpertise.map(item => [item.categoryKey, item.status || 'PENDING'])));
      setExpertiseProofs(Object.fromEntries(result.categoryExpertise.map(item => [item.categoryKey, (item.proofs || []).map(proof => ({ url: proof.url, label: proof.label }))])));
      setSavedTechnician(current => current ? { ...current, categoryExpertise: result.categoryExpertise, servicesOffered: result.servicesOffered } : current);
      setStep(9);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your experience and certificate details.'); }
    finally { setBusy(false); }
  }

  async function saveBankAndContinue() {
    const accountNumber = bank.accountNumber.replace(/\s/g, '');
    const ifscCode = bank.ifscCode.trim().toUpperCase();
    if (!/^\d{9,18}$/.test(accountNumber)) { setError('Enter a valid bank account number.'); return; }
    if (accountNumber !== bank.accountNumberConfirm.replace(/\s/g, '')) { setError('The account numbers do not match.'); return; }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) { setError('Enter a valid IFSC code.'); return; }
    setBusy(true); setError('');
    try {
      const result = await partnerApi.updateTechnicianProfile({ bankDetails: { accountNumber, ifscCode, upiId: bank.upiId.trim() } });
      setSavedTechnician(result.technician); setBank(current => ({ ...current, accountNumber, accountNumberConfirm: accountNumber, ifscCode })); setStep(10);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your payout details.'); }
    finally { setBusy(false); }
  }

  async function chooseDocument(kind: 'address' | 'certificate') {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size != null && file.size > 10 * 1024 * 1024) throw new Error('Choose a document smaller than 10 MB.');
      const contents = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const extension = file.name.toLowerCase().split('.').pop();
      const mimeType = file.mimeType || (extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension || '') ? 'image/jpeg' : '');
      if (!mimeType || (!mimeType.startsWith('image/') && mimeType !== 'application/pdf')) throw new Error('Choose a JPG, PNG, or PDF document.');
      const picked = { data: `data:${mimeType};base64,${contents}`, name: file.name };
      if (kind === 'address') setAddressProofFile(picked);
      else setSkillCertificateFile(picked);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read this document.'); }
  }

  async function addExpertisePhoto(categoryKey: string) {
    const existing = expertiseProofs[categoryKey] || [];
    if (existing.length >= 3) { setError('You can add up to 3 photos for each trade category.'); return; }
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.72, base64: true });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image.base64) throw new Error('The selected photo could not be prepared. Please choose another.');
      if (image.fileSize != null && image.fileSize > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
      setExpertiseProofs(current => ({ ...current, [categoryKey]: [...(current[categoryKey] || []), { data: `data:image/jpeg;base64,${image.base64}`, label: image.fileName || 'Trade evidence' }] }));
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not open your photos.'); }
  }

  async function saveDocumentsAndContinue() {
    if (tier === 'KN_CERTIFIED' && (!addressProofType || !addressProofFile)) {
      setError('Choose an address-proof document type and upload its file.'); return;
    }
    if (addressProofFile && !addressProofType) { setError('Choose the type of your address-proof document.'); return; }
    setBusy(true); setError('');
    try {
      const payload: Record<string, unknown> = {};
      if (addressProofFile && addressProofType) payload.addressProof = { type: addressProofType, documentNumber: addressProofNumber.trim(), documentUrl: addressProofFile.data };
      if (skillCertificateFile) payload.skillCertificationUrl = skillCertificateFile.data;
      if (!Object.keys(payload).length) {
        if (tier === 'KN_CERTIFIED') throw new Error('Add the required address proof before continuing.');
        setStep(11);
      } else {
        const result = await partnerApi.updateTechnicianProfile(payload);
        setSavedTechnician(result.technician); setStep(11);
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your documents.'); }
    finally { setBusy(false); }
  }

  async function submitFinalApplication() {
    if (!legalDeclarations.every(Boolean)) { setError('Confirm all partner declarations before submitting.'); return; }
    setBusy(true); setError('');
    try {
      await Promise.all(['technician_signup', 'technician_background_check', 'technician_qualification_declaration'].map(context => partnerApi.recordPartnerLegalConsent(context)));
      const pushToken = expoPushToken || await getPartnerExpoPushToken();
      let remotePushRegistered = false;
      if (pushToken) {
        try {
          const registration = await partnerApi.registerPushToken(pushToken, Platform.OS === 'ios' ? 'ios' : 'android');
          remotePushRegistered = registration.success;
          setExpoPushToken(pushToken);
        } catch {
          remotePushRegistered = false;
        }
      }
      await partnerApi.submitTechnicianOnboarding();
      const { technician } = await partnerApi.technicianProfile();
      setSavedTechnician(technician);
      setSubmitted(true);
      setSetupComplete(true);
      if (!remotePushRegistered) {
        void showPartnerNotification(
          'Welcome to Kraftnex Partner',
          `Your onboarding details were submitted. Identity verification: ${technician.kycStatus || 'pending'}.`,
        );
      }
      Alert.alert('Details submitted', technician.kycStatus === 'APPROVED'
        ? 'Your technician setup details are saved.'
        : 'Your setup details are saved. Identity verification is still pending before you can receive work.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not submit your technician setup.'); }
    finally { setBusy(false); }
  }

  async function submitTechnicianProfile() {
    if (submitted) { setStep(7); return; }
    if (!otpToken) { setError('Verify your mobile number before continuing.'); return; }
    if (!tier) { setError('Choose a partner tier before continuing.'); return; }
    if (!selected.size) { setError('Select at least one trade service.'); return; }
    if (!experienceLevel) { setError('Choose your years of trade experience.'); return; }
    if (!profile.name.trim() || !profile.email.trim() || profile.password.length < 8) { setError('Complete your name, work email, and password before continuing.'); return; }
    if (!place?.city) { setError('Choose a service location with a resolved city.'); return; }
    setBusy(true); setError('');
    try {
      await partnerApi.registerTechnician({
        name: profile.name.trim(),
        email: profile.email.trim(),
        password: profile.password,
        phone,
        phoneVerificationToken: otpToken,
        city: place.city,
        categories: selectedCategories.map(category => category.key),
        servicesOffered: [...selected],
        categoryExpertise: selectedCategories.map(category => ({ categoryKey: category.key, experienceYears: Number(experienceLevel) })),
        experienceYears: Number(experienceLevel),
        type: tier,
        coordinates: { lat: place.lat, lng: place.lng },
        baseAddress: place.subtitle,
        serviceRadiusKm: radiusKm,
      });
      setSubmitted(true);
      setStep(7);
      if (expoPushToken) {
        void partnerApi.registerPushToken(expoPushToken, Platform.OS === 'ios' ? 'ios' : 'android').catch(() => {});
      }
      const response = await partnerApi.technicianProfile();
      setSavedTechnician(response.technician);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not submit your technician profile.');
    } finally { setBusy(false); }
  }

  function continueFromTrades() {
    if (!tier) { setError('Choose a partner tier to continue.'); return; }
    if (!selected.size) { setError('Select at least one service you can provide.'); return; }
    if (!experienceLevel) { setError('Choose your years of trade experience.'); return; }
    setExperience(Object.fromEntries(selectedCategories.map(category => [category.key, experienceLevel])));
    setError(''); setStep(5);
  }

  const progress = Math.round((step / 11) * 100);
  const region: Region | undefined = place ? { latitude: place.lat, longitude: place.lng, latitudeDelta: 0.07, longitudeDelta: 0.07 } : undefined;
  const stepTitles: Record<number, string> = { 1: 'Basic Information', 2: 'Basic Information', 3: 'Basic Information', 4: 'Trade & Services', 5: 'Profile Details', 6: 'Service Area & Radius', 7: 'Equipment Checklist', 8: 'Expertise & Certificates', 9: 'Bank & Payout Details', 10: 'Address Proof', 11: 'Review & Submit' };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => step === 1 ? router.back() : setStep(step - 1)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.brand}><PartnerBrand compact /><Text style={styles.headerTitle}>{stepTitles[step]}</Text></View>
        <View style={styles.headerActions}><Text style={styles.help}>◉</Text><View style={styles.account}><Text style={styles.accountText}>{profile.name ? profile.name[0].toUpperCase() : '•'}</Text></View></View>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.progressRow}><Text style={styles.progressLabel}>STEP {step} OF 11 • {step >= 9 ? 'FINANCIAL & IDENTITY ACCREDITATION' : 'PARTNER ACCREDITATION'}</Text><Text style={styles.progressPercent}>{progress}% Complete</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>

          {step === 1 && <>
            <View style={styles.eyebrow}><Text style={styles.eyebrowText}>♧  ACCREDITATION PROTOCOL</Text></View>
            <Text style={styles.heading}>Choose Your Partner Tier</Text>
            <Text style={styles.subheading}>Select how you want to partner with KraftNex to deliver architectural & precision services.</Text>
            <ImageBackground source={require('../../../assets/technician-partner-promo.jpg')} imageStyle={styles.promoImage} style={styles.promo}><View style={styles.promoShade}><Text style={styles.promoTag}>KRAFTNEX STANDARDS</Text><Text style={styles.promoTitle}>Elevating Trade Careers to Fine Architecture</Text></View></ImageBackground>
            <TierCard selected={tier === 'KN_CERTIFIED'} title="KN-Certified Partner" badge="GOLD SEAL" subtitle="Exclusive platform-partner positioning & elite branding." benefits={['KraftNex precision toolkit, calibrated diagnostic gear & official uniform kit', 'Priority dispatch opportunities for high-tier commercial/residential clients', 'Direct corporate warranty allocations & a dedicated partner concierge lead', 'Requires trade credential check, on-site skill assessment & KraftNex standards certification', 'Priority dispatch opportunities based on client priority, schedule & performance ratings']} onPress={() => { setTier('KN_CERTIFIED'); setError(''); }} />
            <TierCard selected={tier === 'INDEPENDENT'} title="Independent Specialist" badge="FLEXIBLE" subtitle="Self-managed scheduling using your personal equipment." benefits={['Work under your own independent trade identity with verified badge', 'Standard marketplace job board access & instant on-demand toggling', 'Direct client coordination & full flexibility on project scope', 'Requires valid state trade license, background clearance & proof of basic liability insurance', 'Standard marketplace dispatch availability upon regional customer request']} onPress={() => { setTier('INDEPENDENT'); setError(''); }} />
            <View style={styles.matrix}><Text style={styles.matrixTitle}>♧  Tier Comparison Matrix</Text>{[['Equipment', 'KN Branded Gear', 'Your Own Tools'], ['Dispatch Speed', 'Priority Window', 'Standard Feed'], ['Escrow Safety', 'Protected', 'Protected']].map(row => <View style={styles.matrixRow} key={row[0]}>{row.map((cell, index) => <Text key={`${row[0]}-${cell}-${index}`} style={[styles.matrixCell, index === 0 && styles.matrixLabel]}>{cell}</Text>)}</View>)}</View>
            <Text style={styles.note}>ⓘ  Transparency Notice: KraftNex connects accredited trade specialists with customer demand. Work frequency and payout opportunities depend on regional request density in your area. Client satisfaction scores, response speed, timings and dispatch volumes are not guaranteed.</Text>
            <Button label={`Continue as ${tier === 'KN_CERTIFIED' ? 'KN-Certified Partner' : tier === 'INDEPENDENT' ? 'Independent Specialist' : 'Partner'}  →`} onPress={continueFromTier} />
          </>}

          {step === 2 && <>
            <View style={styles.eyebrow}><Text style={styles.eyebrowText}>♧  VERIFY YOUR PHONE</Text></View>
            <Text style={styles.heading}>Verify Your Mobile Number</Text>
            <Text style={styles.subheading}>We’ll send an official 6-digit passcode via SMS and encrypted WhatsApp to authenticate your technician credential and bind your partner account.</Text>
            <Text style={styles.inputLabel}>MOBILE PHONE NUMBER</Text>
            <View style={styles.phoneInput}><Text style={styles.countryCode}>IN  +91</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98450 12345" placeholderTextColor="#86948e" style={styles.phoneField} /></View>
            <Text style={styles.hint}>Standard Indian cellular network (+91)  ·  OTP to this device</Text>
            <InfoCard title="Dual-Channel Authenticity" rows={['High-Priority SMS  •  Official encrypted SMS', 'WhatsApp Pro  •  Official business line']} />
            <InfoCard title="Bank-Grade Privacy & Escrow Protection" rows={['Your number is solely utilized for active job dispatch notices, verified customer telephony, and RBI-mandated escrow release.']} />
            <View style={styles.spacer} />
            <Button label="Send Verification Code  →" onPress={() => void sendOtp()} busy={busy} />
            <Text style={styles.support}>Need assistance? Partner Hotline: 1800-419-KRAFT</Text>
          </>}

          {step === 3 && <>
            <View style={styles.eyebrow}><Text style={styles.eyebrowText}>♧  TWO-FACTOR AUTHENTICATION</Text></View>
            <Text style={styles.heading}>Verify Your Contact Number</Text>
            <Text style={styles.subheading}>We’ve dispatched a 6-digit cryptographic security code to your registered mobile device for institutional verification.</Text>
            <InfoCard title="Target Mobile Line" rows={[`+91 ${phone.replace(/\d(?=\d{4})/g, '•')}  •  Encrypted Session`]} />
            <Text style={styles.inputLabel}>ENTER 6-DIGIT PASSCODE</Text>
            <TextInput value={otp} onChangeText={value => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="5   8   2   9   4   1" placeholderTextColor="#9aa5aa" style={styles.otpField} />
            <Text style={styles.hint}>Numeric keypad optimized   ·   Clear inputs</Text>
            <InfoCard title="Didn’t receive SMS?" rows={['Check your encrypted delivery channel or request another code.']} />
            <InfoCard title="ALTERNATIVE DELIVERY" rows={['WhatsApp  •  Official business badge', 'Automated Call  •  Spoken 6-digit key', 'Dispatch via URL-approved telecom gateway']} />
            <View style={styles.spacer} />
            <Button label="Verify & Continue  →" onPress={() => void verifyOtp()} busy={busy} />
            <Pressable onPress={() => setStep(2)}><Text style={styles.centerLink}>Change phone number</Text></Pressable>
          </>}

          {step === 4 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  TRADE ACCREDITATION</Text><Text style={styles.statusLine}>Select Your Trades & Experience</Text><Text style={styles.small}>KraftNex dispatches calls matching strictly declared skill competencies. Select all procedures you are equipped to perform autonomously.</Text></View>
            <ImageBackground source={require('../../../assets/technician-partner-promo.jpg')} imageStyle={styles.promoImage} style={styles.promo}><View style={styles.promoShade}><Text style={styles.promoTag}>KRAFTNEX PRECISION GUILD</Text><Text style={styles.promoTitle}>Equipped for High-Value Residences</Text><Text style={styles.promoFoot}>Average single ticket allocation: ₹240 — ₹980</Text></View></ImageBackground>
            <Text style={styles.sectionHeading}>Years of Trade Experience</Text><Text style={styles.small}>Calibrates your initial diagnostic underwriting and guaranteed reserve limit.</Text>
            <View style={styles.experienceGrid}>{[['1–2 Years', 'Junior Specialist', '1.0× Base Tier', '2'], ['3–5 Years', 'Journeyman Expert', '1.4× Escrow Limit', '5'], ['6–9 Years', 'Senior Craftsman', '1.8× Escrow Limit', '9'], ['10+ Years', 'Master Specialist', '2.5× Senior Priority', '10']].map(item => <Pressable key={item[0]} onPress={() => { setExperienceLevel(item[3]); setError(''); }} style={[styles.experienceCard, experienceLevel === item[3] && styles.experienceSelected]}><Text style={styles.cardTitle}>{item[0]}</Text><Text style={styles.small}>{item[1]}</Text><Text style={styles.experienceFoot}>{item[2]}</Text></Pressable>)}</View>
            {!servicesBusy && !servicesError && <TextInput value={serviceQuery} onChangeText={setServiceQuery} placeholder="⌕  Search services, e.g. geyser, fan, sofa" placeholderTextColor="#8d9a95" style={styles.searchInput} />}
            {servicesBusy ? <ActivityIndicator color="#07523e" style={styles.loader} /> : servicesError ? <View style={styles.errorBox}><Text style={styles.errorText}>{servicesError}</Text><Pressable onPress={() => { setServicesBusy(true); setServicesError(''); void partnerApi.technicianServiceCatalog().then(result => setCategories(result.categories)).catch(err => setServicesError(err.message)).finally(() => setServicesBusy(false)); }}><Text style={styles.retry}>Try again</Text></Pressable></View> : categories.map(category => {
              const query = serviceQuery.trim().toLowerCase();
              const sections = category.sections.map(section => ({ ...section, items: section.items.filter(item => `${category.name} ${section.name} ${item.title}`.toLowerCase().includes(query)) })).filter(section => section.items.length > 0);
              if (!sections.length) return null;
              const count = category.sections.reduce((sum, section) => sum + section.items.filter(item => selected.has(item._id)).length, 0);
              return <View key={category.key} style={[styles.categoryCard, count > 0 && styles.categorySelected]}><Pressable style={styles.categoryHeader} onPress={() => setExpanded(expanded === category.key ? null : category.key)}><View style={styles.categoryIcon}><Text>⚒</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{category.name}</Text><Text style={styles.small}>{count} of {category.sections.reduce((sum, section) => sum + section.items.length, 0)} services active</Text></View><Text style={styles.chevron}>{expanded === category.key ? '⌃' : '⌄'}</Text></Pressable>{expanded === category.key && sections.map(section => <View key={section._id || section.name}><View style={styles.sectionRow}><Text style={styles.sectionLabel}>{section.name}</Text><Pressable onPress={() => { const next = new Set(selected); const allSelected = section.items.every(item => next.has(item._id)); section.items.forEach(item => allSelected ? next.delete(item._id) : next.add(item._id)); setSelected(next); }}><Text style={styles.selectAll}>{section.items.every(item => selected.has(item._id)) ? 'Clear section' : 'Select all'}</Text></Pressable></View>{section.items.map(item => <Pressable key={item._id} style={styles.serviceRow} onPress={() => { const next = new Set(selected); if (next.has(item._id)) next.delete(item._id); else next.add(item._id); setSelected(next); setError(''); }}><View style={[styles.checkbox, selected.has(item._id) && styles.checked]}><Text style={styles.checkmark}>{selected.has(item._id) ? '✓' : ''}</Text></View><Text style={styles.serviceName}>{item.title}</Text></Pressable>)}</View>)}</View>;
            })}
            {selectedCategories.length > 0 && <InfoCard title={`${selectedCategories.length} service categories selected`} rows={selectedCategories.map(category => `${category.name}: ${experience[category.key] || experienceLevel || 'Add experience'}`)} />}
            <Button label={`Continue to Professional Profile (Step 5)  →`} onPress={continueFromTrades} />
          </>}

          {step === 5 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  PERSONAL & CREDENTIAL ACCREDITATION</Text><Text style={styles.heading}>Your Professional Profile</Text><Text style={styles.small}>Establish your verified technician identity, official correspondence channel, emergency contacts, and primary dispatch base.</Text></View>
            <FormCard label="Full Legal Name" badge="Government ID match"><TextInput value={profile.name} onChangeText={value => setProfile({ ...profile, name: value })} placeholder="Full legal name" style={styles.formInput} /></FormCard>
            <FormCard label="Work Email Address" badge="Work Orders & GST Invoices"><TextInput value={profile.email} onChangeText={value => setProfile({ ...profile, email: value })} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" style={styles.formInput} /></FormCard>
            <FormCard label="Create Portal Password" badge="AES-256 Vault"><TextInput value={profile.password} onChangeText={value => setProfile({ ...profile, password: value })} placeholder="Create a secure password" secureTextEntry style={styles.formInput} /></FormCard>
            <InfoCard title="256-Bit Cryptographic Data Protection" rows={['Your personal profile, phone records, and emergency contacts are encrypted in transit.']} />
            <Button label="Continue to Service Area (Step 6)  →" onPress={() => { if (!profile.name.trim()) { setError('Your name is required.'); return; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) { setError('Enter a valid work email address.'); return; } const passwordError = passwordProblem(profile.password); if (passwordError) { setError(passwordError); return; } setError(''); setStep(6); }} />
          </>}

          {step === 6 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  SERVICE AREA & RADIUS</Text><Text style={styles.heading}>Set Your Dispatch Area</Text><Text style={styles.small}>Set a precise base location. Only dispatch jobs within your selected radius.</Text></View>
            <TextInput value={query} onChangeText={value => { setQuery(value); if (value.trim().length < 2) setPlaces([]); }} placeholder="⌕  Search your area or landmark" placeholderTextColor="#8d9a95" style={styles.searchInput} />
            {places.map(result => <Pressable key={`${result.lat}-${result.lng}`} onPress={() => { setQuery(result.subtitle); setPlaces([]); void selectCoordinates(result.lat, result.lng); }} style={styles.suggestion}><Text style={styles.cardTitle}>{result.title}</Text><Text style={styles.small}>{result.subtitle}</Text></Pressable>)}
            {place && region ? <View style={styles.mapWrap}><MapView style={styles.map} region={region} onPress={event => void selectCoordinates(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}><Marker coordinate={{ latitude: place.lat, longitude: place.lng }} draggable onDragEnd={event => void selectCoordinates(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)} /><Circle center={{ latitude: place.lat, longitude: place.lng }} radius={radiusKm * 1000} fillColor="rgba(16,185,129,0.14)" strokeColor="#0f382c" /></MapView></View> : <View style={styles.mapPlaceholder}><Text style={styles.mapPlaceholderTitle}>Choose a real location</Text><Text style={styles.small}>Search for an area or use your device location to show the map and service radius.</Text></View>}
            <Pressable style={styles.locationButton} disabled={busy} onPress={() => void handleUseMyLocation()}>{busy ? <ActivityIndicator color="#07523e" /> : <Text style={styles.locationButtonText}>◎  Use my current location</Text>}</Pressable>
            {!!place && <View style={styles.locationCard}><Text style={styles.stepKicker}>⌖  SELECTED BASE</Text><Text style={styles.cardTitle}>{place.title}</Text><Text style={styles.small}>{place.subtitle}</Text><Text style={styles.hint}>Coordinates: {place.lat.toFixed(5)}, {place.lng.toFixed(5)}</Text></View>}
            <Text style={styles.sectionHeading}>Service Radius  ·  {radiusKm} km</Text><Text style={styles.small}>Choose how far you can travel from your base.</Text>
            <View style={styles.radiusRow}>{radiusOptions.map(option => <Pressable key={option} style={[styles.radiusOption, radiusKm === option && styles.radiusSelected]} onPress={() => setRadiusKm(option)}><Text style={[styles.radiusText, radiusKm === option && styles.radiusTextSelected]}>{option} km</Text></Pressable>)}</View>
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            <View style={styles.spacer} />
            <Text style={styles.note}>Dispatch area is based on the location and radius you choose. You can update it later from your technician profile.</Text>
            <Button label="Continue to Equipment & Tools (Step 7)  →" onPress={() => void submitTechnicianProfile()} busy={busy} disabled={!place} />
          </>}

          {step === 7 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  STEP 7 OF 11  •  PARTNER ACCREDITATION</Text><Text style={styles.heading}>Equipment Checklist</Text><Text style={styles.small}>Select the tools and diagnostics currently in your vehicle toolkit. Required items are specific to your confirmed trade categories.</Text></View>
            <View style={styles.trackCard}><Text style={styles.stepKicker}>{tier === 'KN_CERTIFIED' ? 'KN-CERTIFIED PARTNER TRACK' : 'INDEPENDENT SPECIALIST TRACK'}</Text><Text style={styles.small}>{selectedCategories.map(category => category.name).join(' · ')}</Text></View>
            {Object.entries(availableEquipment.reduce<Record<string, typeof availableEquipment>>((groups, item) => { const key = item.category || 'GENERAL'; (groups[key] ||= []).push(item); return groups; }, {})).map(([categoryKey, items]) => <View key={categoryKey} style={styles.equipmentGroup}>
              <View style={styles.equipmentHeader}><View style={styles.categoryIcon}><Text>⚒</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{categoryKey === 'GENERAL' ? 'General Safety Gear' : categories.find(category => category.key === categoryKey)?.name || categoryKey.replace(/_/g, ' ')}</Text><Text style={styles.small}>{items.filter(item => equipmentChecklist.includes(item.id)).length} of {items.length} ready</Text></View><Text style={styles.requiredCount}>{items.filter(item => item.required).length} required</Text></View>
              {items.map(item => {
                const checked = equipmentChecklist.includes(item.id);
                return <Pressable key={item.id} style={styles.equipmentItem} onPress={() => setEquipmentChecklist(current => checked ? current.filter(id => id !== item.id) : [...current, item.id])}>
                  <View style={[styles.checkbox, checked && styles.checked]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View><View style={styles.flex}><Text style={styles.serviceName}>{item.label}</Text>{item.required && <Text style={styles.requiredText}>REQUIRED FOR THIS TRADE</Text>}</View>
                </Pressable>;
              })}
            </View>)}
            <View style={styles.readinessCard}><View style={styles.readinessTop}><View style={styles.flex}><Text style={styles.stepKicker}>OVERALL TOOLKIT READINESS</Text><Text style={styles.sectionHeading}>{equipmentReadyCount} of {requiredEquipment.length} Required Tools</Text></View><View style={styles.readinessBadge}><Text style={styles.readinessPercent}>{requiredEquipment.length ? Math.round(equipmentReadyCount / requiredEquipment.length * 100) : 0}%</Text></View></View><Text style={styles.small}>{tier === 'KN_CERTIFIED' ? 'Confirm each required tool before continuing.' : 'Your checklist will be attached to your technician profile.'}</Text></View>
            <Button label="Continue to Expertise & Certificates (Step 8)  →" onPress={() => void saveEquipmentAndContinue()} busy={busy} />
            <Pressable onPress={() => setStep(6)}><Text style={styles.centerLink}>‹  Back to Service Area & Radius (Step 6)</Text></Pressable>
          </>}

          {step === 8 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  STEP 8 OF 11  •  PARTNER ACCREDITATION</Text><Text style={styles.heading}>Expertise & Certificates</Text><Text style={styles.small}>Share evidence of your technical trade competence and past work. Evidence is optional and reviewed by the technician team.</Text></View>
            <View style={styles.noticeCard}><Text style={styles.noticeTitle}>ⓘ  Evidence review</Text><Text style={styles.small}>Submitted photos are reviewed before trade categories are approved. Approval and dispatch eligibility are shown from your account status.</Text></View>
            {selectedCategories.map(category => {
              const proofs = expertiseProofs[category.key] || [];
              const status = expertiseStatuses[category.key];
              return <View key={category.key} style={styles.proofCard}>
                <View style={styles.proofHeader}><View style={styles.flex}><Text style={styles.cardTitle}>{category.name}</Text><Text style={styles.small}>{experience[category.key] || experienceLevel || 0} years of experience</Text></View><Text style={[styles.stateBadge, status === 'APPROVED' ? styles.stateApproved : styles.statePending]}>{status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Needs review' : 'Evidence optional'}</Text></View>
                <TextInput value={experience[category.key] || experienceLevel} onChangeText={value => setExperience(current => ({ ...current, [category.key]: value.replace(/\D/g, '').slice(0, 2) }))} keyboardType="number-pad" placeholder="Years of experience" placeholderTextColor="#8b9691" style={styles.formInput} />
                <TextInput value={expertiseNotes[category.key] || ''} onChangeText={value => setExpertiseNotes(current => ({ ...current, [category.key]: value.slice(0, 500) }))} placeholder="Training, brands serviced, or relevant experience" placeholderTextColor="#8b9691" multiline style={[styles.formInput, styles.multiline]} />
                <View style={styles.photoGrid}>{proofs.map((proof, index) => <View key={`${proof.url || proof.label}-${index}`} style={styles.photoTile}><Image source={{ uri: proof.data || proof.url }} style={styles.photo} /><Pressable onPress={() => setExpertiseProofs(current => ({ ...current, [category.key]: (current[category.key] || []).filter((_, proofIndex) => proofIndex !== index) }))} style={styles.removePhoto}><Text style={styles.removePhotoText}>×</Text></Pressable></View>)}{proofs.length < 3 && <Pressable style={styles.addPhoto} onPress={() => void addExpertisePhoto(category.key)}><Text style={styles.addPhotoIcon}>＋</Text><Text style={styles.addPhotoText}>Add photo</Text></Pressable>}</View>
              </View>;
            })}
            <View style={styles.privacyCard}><Text style={styles.cardTitle}>🔒  Credential privacy</Text><Text style={styles.small}>Documents and photos are sent to Kraftnex for technician credential review.</Text></View>
            <Button label="Continue to Bank & Payout Details (Step 9)  →" onPress={() => void saveExpertiseAndContinue()} busy={busy} />
            <Pressable onPress={() => setStep(7)}><Text style={styles.centerLink}>‹  Back to Equipment Checklist (Step 7)</Text></Pressable>
          </>}

          {step === 9 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  STEP 9 OF 11  •  FINANCIAL ACCREDITATION</Text><Text style={styles.heading}>Bank & Direct Payout Details</Text><Text style={styles.small}>Enter the account where your technician earnings should be paid. Your account holder name should match your legal name.</Text></View>
            <View style={styles.noticeCard}><Text style={styles.noticeTitle}>◈  Payout account</Text><Text style={styles.small}>Use an account you own. Review your account number and IFSC before saving.</Text></View>
            <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.inputLabel}>ACCOUNT HOLDER LEGAL NAME</Text><Text style={styles.formBadge}>FROM PROFILE</Text></View><View style={styles.readOnlyInput}><Text style={styles.readOnlyText}>{profile.name || savedTechnician?.name || 'Name not available'}</Text></View></View>
            <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.inputLabel}>BANK ACCOUNT NUMBER *</Text><Text style={styles.formBadge}>PRIVATE</Text></View><TextInput value={bank.accountNumber} onChangeText={value => setBank(current => ({ ...current, accountNumber: value.replace(/\D/g, '').slice(0, 18) }))} keyboardType="number-pad" secureTextEntry placeholder="Enter account number" placeholderTextColor="#8b9691" style={styles.formInput} /></View>
            <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.inputLabel}>RE-ENTER ACCOUNT NUMBER *</Text></View><TextInput value={bank.accountNumberConfirm} onChangeText={value => setBank(current => ({ ...current, accountNumberConfirm: value.replace(/\D/g, '').slice(0, 18) }))} keyboardType="number-pad" secureTextEntry placeholder="Confirm account number" placeholderTextColor="#8b9691" style={styles.formInput} /></View>
            <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.inputLabel}>IFSC CODE *</Text></View><TextInput value={bank.ifscCode} onChangeText={value => setBank(current => ({ ...current, ifscCode: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) }))} autoCapitalize="characters" autoCorrect={false} placeholder="e.g. HDFC0000123" placeholderTextColor="#8b9691" style={styles.formInput} /></View>
            <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.inputLabel}>UPI ID</Text><Text style={styles.formBadge}>OPTIONAL</Text></View><TextInput value={bank.upiId} onChangeText={value => setBank(current => ({ ...current, upiId: value.trim() }))} autoCapitalize="none" autoCorrect={false} placeholder="name@bank" placeholderTextColor="#8b9691" style={styles.formInput} /></View>
            <Button label="Continue to Address Proof (Step 10)  →" onPress={() => void saveBankAndContinue()} busy={busy} />
            <Pressable onPress={() => setStep(8)}><Text style={styles.centerLink}>‹  Back to Expertise & Certificates (Step 8)</Text></Pressable>
          </>}

          {step === 10 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  STEP 10 OF 11  •  IDENTITY & KYC</Text><Text style={styles.heading}>Residential Address Proof</Text><Text style={styles.small}>Choose an accepted document and upload a clear file to verify your residential address.</Text></View>
            <View style={styles.noticeCard}><Text style={styles.noticeTitle}>ⓘ  Address document</Text><Text style={styles.small}>Document upload is recorded as address proof. It does not replace the account’s identity verification status.</Text></View>
            <Text style={styles.inputLabel}>SELECT DOCUMENT TYPE {tier === 'KN_CERTIFIED' ? '*' : ''}</Text>
            <View style={styles.documentTypes}>{addressProofTypes.map(option => <Pressable key={option.value} style={[styles.documentType, addressProofType === option.value && styles.documentTypeSelected]} onPress={() => setAddressProofType(option.value)}><View style={styles.documentTypeIcon}><Text>▧</Text></View><Text style={styles.documentTypeLabel}>{option.label}</Text><View style={[styles.radio, addressProofType === option.value && styles.radioSelected]} /></Pressable>)}</View>
            {!!addressProofType && <View style={styles.formCard}><Text style={styles.inputLabel}>DOCUMENT NUMBER</Text><TextInput value={addressProofNumber} onChangeText={setAddressProofNumber} autoCapitalize="characters" autoCorrect={false} placeholder="Enter document number" placeholderTextColor="#8b9691" style={styles.formInput} /></View>}
            <View style={styles.uploadCard}><Text style={styles.cardTitle}>Address Proof File {tier === 'KN_CERTIFIED' ? '*' : ''}</Text><Text style={styles.small}>Select a clear image or PDF (up to 10 MB).</Text>{addressProofFile ? <View style={styles.fileSelected}><Text style={styles.fileIcon}>▤</Text><Text numberOfLines={1} style={styles.fileName}>{addressProofFile.name}</Text><Pressable onPress={() => setAddressProofFile(null)}><Text style={styles.removeFile}>Remove</Text></Pressable></View> : <Pressable style={styles.uploadButton} onPress={() => void chooseDocument('address')}><Text style={styles.uploadIcon}>↑</Text><Text style={styles.uploadText}>Choose address document</Text></Pressable>}</View>
            <View style={styles.uploadCard}><Text style={styles.cardTitle}>Trade Certificate</Text><Text style={styles.small}>Optional: ITI, apprenticeship, or another relevant trade certificate.</Text>{skillCertificateFile ? <View style={styles.fileSelected}><Text style={styles.fileIcon}>▤</Text><Text numberOfLines={1} style={styles.fileName}>{skillCertificateFile.name}</Text><Pressable onPress={() => setSkillCertificateFile(null)}><Text style={styles.removeFile}>Remove</Text></Pressable></View> : <Pressable style={styles.uploadButton} onPress={() => void chooseDocument('certificate')}><Text style={styles.uploadIcon}>↑</Text><Text style={styles.uploadText}>Choose certificate</Text></Pressable>}</View>
            <Button label="Continue to Final Review (Step 11)  →" onPress={() => void saveDocumentsAndContinue()} busy={busy} />
            <Pressable onPress={() => setStep(9)}><Text style={styles.centerLink}>‹  Back to Bank & Payout Details (Step 9)</Text></Pressable>
          </>}

          {step === 11 && <>
            <View style={styles.statusCard}><Text style={styles.stepKicker}>•  STEP 11 OF 11  •  FINAL REVIEW</Text><Text style={styles.heading}>Review & Submit</Text><Text style={styles.small}>Review the information saved to your technician profile before submitting.</Text></View>
            <View style={styles.reviewCard}>
              <ReviewRow label="Partner Tier" value={tier === 'KN_CERTIFIED' ? 'KN-Certified Partner' : 'Independent Specialist'} onPress={() => setStep(1)} />
              <ReviewRow label="Name" value={profile.name || savedTechnician?.name || '—'} onPress={() => setStep(5)} />
              <ReviewRow label="Email" value={profile.email || savedTechnician?.email || '—'} onPress={() => setStep(5)} />
              <ReviewRow label="Mobile Number" value={phone || savedTechnician?.phone || '—'} onPress={() => setStep(2)} />
              <ReviewRow label="Trades & Services" value={`${selectedCategories.map(category => category.name).join(', ')} · ${selected.size} services`} onPress={() => setStep(4)} />
              <ReviewRow label="Service Area" value={`${place?.city || savedTechnician?.city || '—'} · ${radiusKm} km`} onPress={() => setStep(6)} />
              <ReviewRow label="Equipment" value={`${equipmentChecklist.length} tools confirmed`} onPress={() => setStep(7)} />
              <ReviewRow label="Experience Evidence" value={`${Object.values(expertiseProofs).reduce((count, proofs) => count + proofs.length, 0)} photos`} onPress={() => setStep(8)} />
              <ReviewRow label="Payout Details" value={`${bank.ifscCode || 'Not set'} · account ending ${bank.accountNumber.slice(-4) || '—'}`} onPress={() => setStep(9)} />
              <ReviewRow label="Address Proof" value={addressProofType ? `${addressProofTypes.find(item => item.value === addressProofType)?.label} · ${addressProofFile?.name || 'file saved'}` : 'Not provided'} onPress={() => setStep(10)} />
              <ReviewRow label="Identity Verification" value={savedTechnician?.kycStatus || 'Pending'} />
            </View>
            {['Partner Terms & Privacy Policy', 'Background-check authorization', 'Accuracy of trade qualification details'].map((declaration, index) => <Pressable key={declaration} style={styles.declarationRow} onPress={() => setLegalDeclarations(current => current.map((value, row) => row === index ? !value : value))}><View style={[styles.checkbox, legalDeclarations[index] && styles.checked]}><Text style={styles.checkmark}>{legalDeclarations[index] ? '✓' : ''}</Text></View><Text style={styles.declarationText}>I confirm {declaration.toLowerCase()}.</Text></Pressable>)}
            {setupComplete && <View style={styles.noticeCard}><Text style={styles.noticeTitle}>Details submitted</Text><Text style={styles.small}>Identity verification status: {savedTechnician?.kycStatus || 'Pending'}. Technician work access remains subject to verification.</Text></View>}
            <Button label={setupComplete ? 'Details Submitted' : 'Submit Partner Application  →'} onPress={() => void submitFinalApplication()} busy={busy} disabled={setupComplete} />
            <Pressable onPress={() => setStep(10)}><Text style={styles.centerLink}>‹  Back to Address Proof (Step 10)</Text></Pressable>
          </>}

          {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
          <Text style={styles.footer}>♙  Encrypted Partner Profile  •  Kraftnex</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TierCard({ selected, title, badge, subtitle, benefits, onPress }: { selected: boolean; title: string; badge: string; subtitle: string; benefits: string[]; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.tierCard, selected && styles.tierCardSelected]}><View style={styles.tierHeader}><View style={styles.tierIcon}><Text style={styles.tierIconText}>{title.startsWith('KN') ? '⬟' : '▣'}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.small}>{subtitle}</Text></View><View style={[styles.radio, selected && styles.radioSelected]} /></View><Text style={styles.tierBadge}>{badge}</Text>{benefits.map(benefit => <Text key={benefit} style={styles.benefit}>✓  {benefit}</Text>)}</Pressable>;
}
function InfoCard({ title, rows }: { title: string; rows: string[] }) { return <View style={styles.infoCard}><Text style={styles.infoTitle}>{title}</Text>{rows.map(row => <Text key={row} style={styles.infoRow}>◉  {row}</Text>)}</View>; }
function FormCard({ label, badge, children }: { label: string; badge: string; children: React.ReactNode }) { return <View style={styles.formCard}><View style={styles.formHeader}><Text style={styles.inputLabel}>{label} *</Text><Text style={styles.formBadge}>{badge}</Text></View>{children}</View>; }
function Button({ label, onPress, busy = false, disabled = false }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) { return <Pressable disabled={busy || disabled} onPress={onPress} style={[styles.button, (busy || disabled) && styles.buttonDisabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}</Pressable>; }
function ReviewRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) { return <Pressable disabled={!onPress} onPress={onPress} style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text>{onPress && <Text style={styles.reviewEdit}>Edit</Text>}</Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f4fa' }, flex: { flex: 1 },
  trackCard: { backgroundColor: '#e5f4ec', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#d5eade' }, equipmentGroup: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#173d32', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, equipmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 7 }, requiredCount: { color: '#527265', fontSize: 7, fontWeight: '800' }, equipmentItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f0f2f4' }, requiredText: { color: '#55766a', fontSize: 6, fontWeight: '800', marginTop: 3, letterSpacing: 0.3 }, readinessCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginTop: 10, borderColor: '#e8ebef', borderWidth: 1, shadowColor: '#173d32', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, readinessTop: { flexDirection: 'row', alignItems: 'center' }, readinessBadge: { width: 42, height: 42, borderRadius: 22, borderWidth: 3, borderColor: '#bfe7d0', alignItems: 'center', justifyContent: 'center' }, readinessPercent: { color: '#145b43', fontSize: 10, fontWeight: '900' }, noticeCard: { backgroundColor: '#f0f2ff', borderRadius: 11, padding: 10, marginTop: 8 }, noticeTitle: { color: '#2c584a', fontSize: 9, fontWeight: '800', marginBottom: 3 }, proofCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#173d32', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, proofHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }, stateBadge: { fontSize: 6, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 }, stateApproved: { color: '#156047', backgroundColor: '#e0f4e9' }, statePending: { color: '#63766e', backgroundColor: '#eff2f1' }, multiline: { minHeight: 62, textAlignVertical: 'top', marginTop: 8, paddingTop: 8 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, photoTile: { width: 58, height: 58, borderRadius: 9, overflow: 'hidden', borderWidth: 1, borderColor: '#e3e8e5' }, photo: { width: '100%', height: '100%' }, removePhoto: { position: 'absolute', right: 3, top: 3, width: 17, height: 17, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' }, removePhotoText: { color: '#fff', fontSize: 14, lineHeight: 16 }, addPhoto: { width: 58, height: 58, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: '#b9c7c1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbfcfc' }, addPhotoIcon: { color: '#55786b', fontSize: 18 }, addPhotoText: { color: '#678078', fontSize: 7, fontWeight: '700' }, privacyCard: { backgroundColor: '#eff1ff', borderRadius: 11, padding: 10, marginTop: 8 }, readOnlyInput: { minHeight: 36, backgroundColor: '#f7f9fa', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 9 }, readOnlyText: { color: '#345249', fontSize: 10, fontWeight: '700' }, documentTypes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginTop: 6 }, documentType: { width: '48%', minHeight: 55, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e9ed', borderRadius: 10, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }, documentTypeSelected: { backgroundColor: '#eef4ff', borderColor: '#8eaa9e' }, documentTypeIcon: { width: 25, height: 25, borderRadius: 7, backgroundColor: '#e7edff', alignItems: 'center', justifyContent: 'center' }, documentTypeLabel: { color: '#435951', fontSize: 7, fontWeight: '700', flex: 1 }, uploadCard: { backgroundColor: '#fff', borderRadius: 11, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#eceef2' }, uploadButton: { minHeight: 42, marginTop: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#cbd5d0', backgroundColor: '#fafcfb', borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, uploadIcon: { color: '#376c58', fontSize: 17 }, uploadText: { color: '#476c5e', fontSize: 8, fontWeight: '800' }, fileSelected: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8, backgroundColor: '#f5f8f7', borderRadius: 8, padding: 8 }, fileIcon: { color: '#315a4b', fontSize: 14 }, fileName: { flex: 1, color: '#526a61', fontSize: 7 }, removeFile: { color: '#a04640', fontSize: 7, fontWeight: '800' }, reviewCard: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 13, marginTop: 10, borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#173d32', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, reviewRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, borderBottomWidth: 1, borderBottomColor: '#f0f2f3', paddingVertical: 7 }, reviewLabel: { color: '#718079', fontSize: 7, width: 85 }, reviewValue: { flex: 1, color: '#2e493f', fontSize: 7, fontWeight: '700', textAlign: 'right' }, reviewEdit: { color: '#3c6e5b', fontSize: 7, fontWeight: '800', marginLeft: 2 }, declarationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fff', borderRadius: 9, padding: 9, marginTop: 7, borderWidth: 1, borderColor: '#eceef2' }, declarationText: { flex: 1, color: '#5d7069', fontSize: 8, lineHeight: 12 },
  categorySelected: { borderColor: '#aacbbc', backgroundColor: '#f8fcfa' }, sectionRow: { marginTop: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionLabel: { color: '#718079', fontSize: 7, fontWeight: '800', textTransform: 'uppercase' }, selectAll: { color: '#0b6249', fontSize: 7, fontWeight: '800' },
  header: { height: 60, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomColor: '#e8e9ee', borderBottomWidth: StyleSheet.hairlineWidth }, back: { width: 32 }, backText: { fontSize: 29, color: '#173d32', lineHeight: 32 }, brand: { flex: 1 }, headerTitle: { color: '#34443e', fontSize: 10, fontWeight: '700', marginLeft: 3 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, help: { color: '#507366' }, account: { width: 27, height: 27, borderRadius: 15, backgroundColor: '#064a38', alignItems: 'center', justifyContent: 'center' }, accountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  page: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 }, progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressLabel: { color: '#55766b', fontSize: 8, fontWeight: '800', letterSpacing: 0.4 }, progressPercent: { color: '#52665f', fontSize: 8, fontWeight: '700' }, progressTrack: { height: 5, backgroundColor: '#e3e6ef', borderRadius: 4, marginTop: 7, marginBottom: 12, overflow: 'hidden' }, progressFill: { height: 4, backgroundColor: '#0e7455', borderRadius: 4 }, eyebrow: { alignSelf: 'flex-start', backgroundColor: '#e9efff', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 10, marginBottom: 8 }, eyebrowText: { color: '#526c9a', fontSize: 7, fontWeight: '800', letterSpacing: 0.3 }, heading: { color: '#102e29', fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.45 }, subheading: { color: '#71817b', fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 10 }, promo: { height: 104, justifyContent: 'flex-end', borderRadius: 16, backgroundColor: '#173d32', marginBottom: 9, overflow: 'hidden' }, promoImage: { borderRadius: 12 }, promoShade: { flex: 1, justifyContent: 'flex-end', padding: 10, backgroundColor: 'rgba(6, 30, 23, 0.48)' }, promoTag: { color: '#d1ebd9', fontSize: 7, fontWeight: '800' }, promoTitle: { color: '#fff', fontSize: 12, fontWeight: '900', marginTop: 2 }, promoFoot: { color: '#dbe9e1', fontSize: 8, marginTop: 2 }, tierCard: { backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#edf0f2', padding: 15, marginBottom: 11, shadowColor: '#173d32', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, tierCardSelected: { borderColor: '#0c5b44', borderWidth: 1.5 }, tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 }, tierIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff' }, tierIconText: { color: '#07523e', fontSize: 15 }, cardTitle: { color: '#173d32', fontSize: 12, fontWeight: '800' }, small: { color: '#71817b', fontSize: 9, lineHeight: 14, marginTop: 2 }, radio: { width: 9, height: 9, borderRadius: 6, borderWidth: 1, borderColor: '#8d9b96' }, radioSelected: { borderColor: '#0a6a4c', backgroundColor: '#0a6a4c' }, tierBadge: { alignSelf: 'flex-end', backgroundColor: '#e3f4ea', color: '#176447', fontSize: 6, fontWeight: '900', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3, marginTop: 5 }, benefit: { color: '#61766e', fontSize: 7, lineHeight: 11, marginTop: 5 }, matrix: { backgroundColor: '#f0f1ff', borderRadius: 15, padding: 12, marginTop: 4, marginBottom: 10 }, matrixTitle: { color: '#415779', fontSize: 9, fontWeight: '800', marginBottom: 4 }, matrixRow: { backgroundColor: '#fff', borderRadius: 5, flexDirection: 'row', marginTop: 3, paddingVertical: 5, paddingHorizontal: 4 }, matrixCell: { flex: 1, color: '#53645f', fontSize: 7, textAlign: 'center' }, matrixLabel: { textAlign: 'left', fontWeight: '700' }, note: { color: '#74817b', fontSize: 8, lineHeight: 12, marginVertical: 8 },
  inputLabel: { color: '#718079', fontSize: 8, fontWeight: '800', letterSpacing: 0.4, marginBottom: 5 }, phoneInput: { minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#e1e7e4', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }, countryCode: { color: '#51665f', fontSize: 11, fontWeight: '700', borderRightWidth: 1, borderRightColor: '#e2e8e5', paddingRight: 9 }, phoneField: { flex: 1, paddingHorizontal: 9, color: '#223a33', fontSize: 13 }, hint: { color: '#86918c', fontSize: 7, marginTop: 5 }, infoCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginTop: 11, borderColor: '#edf0f2', borderWidth: 1, shadowColor: '#173d32', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, infoTitle: { color: '#304a41', fontSize: 9, fontWeight: '800' }, infoRow: { color: '#71817a', fontSize: 8, lineHeight: 13, marginTop: 6 }, spacer: { height: 16 }, button: { minHeight: 48, borderRadius: 13, backgroundColor: '#074b37', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, marginTop: 9 }, buttonDisabled: { opacity: 0.6 }, buttonText: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center' }, support: { textAlign: 'center', color: '#75817c', fontSize: 7, marginTop: 8 }, otpField: { height: 50, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3e8e6', textAlign: 'center', letterSpacing: 8, color: '#173d32', fontSize: 21, fontWeight: '800', marginTop: 4 }, centerLink: { color: '#38685a', fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 9 },
  statusCard: { backgroundColor: '#fff', borderRadius: 17, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#173d32', shadowOpacity: 0.055, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, stepKicker: { color: '#477263', fontSize: 7, letterSpacing: 0.45, fontWeight: '800' }, statusLine: { color: '#18382e', fontSize: 15, fontWeight: '900', marginTop: 5 }, sectionHeading: { color: '#203a32', fontSize: 12, fontWeight: '800', marginTop: 10 }, experienceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }, experienceCard: { width: '48%', borderWidth: 1, borderColor: '#e7e9f0', backgroundColor: '#fff', borderRadius: 14, padding: 12, minHeight: 76, shadowColor: '#173d32', shadowOpacity: 0.04, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, experienceSelected: { borderColor: '#0b6249', backgroundColor: '#eff8f3' }, experienceFoot: { color: '#547668', fontSize: 7, marginTop: 5 }, categoryCard: { backgroundColor: '#fff', borderRadius: 15, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#173d32', shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 }, categoryIcon: { width: 27, height: 27, borderRadius: 8, backgroundColor: '#e2f4ea', alignItems: 'center', justifyContent: 'center' }, chevron: { color: '#56776a', fontSize: 16 }, serviceRow: { borderTopWidth: 1, borderColor: '#f0f2f5', marginTop: 6, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, checkbox: { width: 13, height: 13, borderWidth: 1, borderColor: '#a9b4af', borderRadius: 3 }, checked: { backgroundColor: '#07523e', borderColor: '#07523e' }, checkmark: { color: '#fff', fontSize: 9, fontWeight: '900', textAlign: 'center', lineHeight: 12 }, serviceName: { color: '#51655d', fontSize: 8, flex: 1 }, loader: { margin: 24 }, experienceInput: { color: '#203c34' },
  formCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, marginTop: 10, borderWidth: 1, borderColor: '#f0f1f3', shadowColor: '#173d32', shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, formHeader: { flexDirection: 'row', justifyContent: 'space-between' }, formBadge: { color: '#27654f', backgroundColor: '#dff3e8', borderRadius: 7, overflow: 'hidden', fontSize: 6, paddingHorizontal: 5, paddingVertical: 3, alignSelf: 'flex-start' }, formInput: { minHeight: 36, backgroundColor: '#f8f9fb', borderRadius: 8, paddingHorizontal: 9, color: '#2b4039', fontSize: 10 }, searchInput: { backgroundColor: '#fff', borderColor: '#e1e7e4', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 48, color: '#183b30', fontSize: 10 }, suggestion: { backgroundColor: '#fff', padding: 9, borderBottomWidth: 1, borderColor: '#edf0f0' }, mapWrap: { height: 250, borderRadius: 16, overflow: 'hidden', marginTop: 8 }, map: { flex: 1 }, mapPlaceholder: { height: 190, borderRadius: 16, backgroundColor: '#e6eaf0', alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 8 }, mapPlaceholderTitle: { color: '#28463b', fontWeight: '800', fontSize: 11 }, locationButton: { minHeight: 35, backgroundColor: '#e7f3ec', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, locationButtonText: { color: '#176048', fontSize: 9, fontWeight: '800' }, locationCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, marginTop: 10, borderWidth: 1, borderColor: '#edf0f2', shadowColor: '#173d32', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, radiusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, radiusOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e8e9' }, radiusSelected: { backgroundColor: '#0b4635', borderColor: '#0b4635' }, radiusText: { color: '#64756e', fontSize: 9, fontWeight: '700' }, radiusTextSelected: { color: '#fff' }, notice: { color: '#8d681b', backgroundColor: '#fff8e5', borderRadius: 8, padding: 8, fontSize: 8, marginTop: 8 }, errorBox: { backgroundColor: '#fff0ef', padding: 9, borderRadius: 8, marginTop: 9 }, errorText: { color: '#a54842', fontSize: 9 }, retry: { color: '#07523e', fontSize: 9, fontWeight: '800', marginTop: 5 }, footer: { color: '#82908a', fontSize: 7, marginTop: 18, textAlign: 'center' },
});
