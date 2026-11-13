import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { StyleSheet } from 'react-native';
import { DataRow, Field, PageHeading, Panel, PrimaryButton, SelectChips, StatePanel, VerticalFrame, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { PartnerApiError } from '../../lib/partnerApi';
import { realtorApi } from '../../lib/partnerVerticalApi';

const TABS = [{ key: 'dashboard', label: 'Overview', icon: '⌂' }, { key: 'properties', label: 'Properties', icon: '▦' }, { key: 'projects', label: 'Projects', icon: '⌂' }, { key: 'leads', label: 'Leads', icon: '♧' }, { key: 'more', label: 'More', icon: '•••' }];
const SPECIALIZATIONS = ['new_projects', 'resale', 'rental', 'plots', 'commercial', 'luxury', 'affordable_housing', 'land'];
type RecordData = Record<string, unknown>;
function nestedRealtor(data: RecordData): RecordData {
  return data.realtor && typeof data.realtor === 'object' ? data.realtor as RecordData : data;
}

export default function RealtorOnboardingScreen() {
  const [profile, setProfile] = useState<RecordData | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ companyName: '', companyDescription: '', website: '', establishedYear: '', officeAddress: '', specializations: [] as string[], reraNumber: '', reraState: '', pan: '', gstin: '', governmentIdType: '', governmentIdNumber: '', governmentIdUrl: '', ownershipProofType: '', ownershipProofUrl: '', reraCertUrl: '', businessProofUrl: '', serviceCities: '', serviceLocalities: '' });
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const accountType = String(profile?.accountType || 'individual_owner');
  const business = accountType === 'builder' || accountType === 'developer';
  const isOwner = accountType === 'individual_owner';
  const sequence = isOwner ? ['profile', 'credentials', 'ready'] : ['profile', 'credentials', 'areas', 'ready'];

  const load = useCallback(async () => {
    try {
      const response = await realtorApi.profile();
      const current = nestedRealtor(response);
      setProfile(current);
      setForm(old => ({ ...old,
        companyName: String(current.companyName || ''), companyDescription: String(current.companyDescription || current.profileDescription || ''), website: String(current.website || ''), establishedYear: current.establishedYear ? String(current.establishedYear) : '', officeAddress: String(current.officeAddress || ''),
        specializations: Array.isArray(current.specializations) ? current.specializations.map(String) : [], reraNumber: String(current.reraNumber || ''), reraState: String(current.reraState || ''), pan: String(current.pan || ''),
        governmentIdType: String((current.documents as Record<string, unknown> | undefined)?.governmentIdType || ''), governmentIdNumber: String((current.documents as Record<string, unknown> | undefined)?.governmentIdNumber || ''), governmentIdUrl: String((current.documents as Record<string, unknown> | undefined)?.governmentIdUrl || ''), ownershipProofType: String((current.documents as Record<string, unknown> | undefined)?.ownershipProofType || ''), ownershipProofUrl: String((current.documents as Record<string, unknown> | undefined)?.ownershipProofUrl || ''), reraCertUrl: String((current.documents as Record<string, unknown> | undefined)?.reraCertUrl || ''), businessProofUrl: String((current.documents as Record<string, unknown> | undefined)?.businessProofUrl || ''),
        serviceCities: Array.isArray(current.serviceCities) ? current.serviceCities.join(', ') : Array.isArray(current.operatingCities) ? current.operatingCities.join(', ') : '', serviceLocalities: Array.isArray(current.serviceLocalities) ? current.serviceLocalities.join(', ') : '',
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load realtor profile.');
    } finally { setLoading(false); }
  }, []);

  // Load the saved onboarding state from the backend on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function saveStep() {
    if (!profile) return;
    setBusy(true); setError('');
    try {
      const current = sequence[step];
      if (current === 'profile') {
        await realtorApi.saveProfile({ companyName: form.companyName, companyDescription: form.companyDescription, website: form.website, establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined, officeAddress: form.officeAddress, specializations: form.specializations });
      } else if (current === 'credentials') {
        if (business && form.gstin.trim()) await realtorApi.verifyGst(form.gstin.trim());
        await realtorApi.saveCredentials({ reraNumber: form.reraNumber, reraState: form.reraState, pan: form.pan, documents: { governmentIdType: form.governmentIdType, governmentIdNumber: form.governmentIdNumber, governmentIdUrl: form.governmentIdUrl, ownershipProofType: form.ownershipProofType, ownershipProofUrl: form.ownershipProofUrl, reraCertUrl: form.reraCertUrl, businessProofUrl: form.businessProofUrl } });
      } else if (current === 'areas') {
        const serviceCities = form.serviceCities.split(',').map(value => value.trim()).filter(Boolean);
        const serviceLocalities = form.serviceLocalities.split(',').map(value => value.trim()).filter(Boolean);
        if (!serviceCities.length) throw new Error('Add at least one city where you work.');
        await realtorApi.saveServiceArea({ serviceCities, serviceLocalities });
      } else {
        const response = await realtorApi.submitOnboarding();
        const submitted = nestedRealtor(response);
        setProfile(submitted);
        setStep(sequence.length - 1);
        return;
      }
      await load();
      setStep(index => Math.min(index + 1, sequence.length - 1));
    } catch (cause) {
      setError(cause instanceof PartnerApiError ? cause.message : cause instanceof Error ? cause.message : 'Could not save this onboarding step.');
    } finally { setBusy(false); }
  }

  async function pickCredential(field: 'governmentIdUrl' | 'ownershipProofUrl' | 'reraCertUrl' | 'businessProofUrl') {
    if (!profile?._id) { setError('The realtor profile must be created before uploading documents.'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError('Photo library permission is required to attach a document scan.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
    if (result.canceled) return;
    const asset = result.assets[0]; setBusy(true); setError('');
    try {
      const response = await realtorApi.uploadMedia({ uri: asset.uri, name: asset.fileName || `${field}.jpg`, mimeType: asset.mimeType || 'image/jpeg' }, { resourceType: 'realtor', resourceId: String(profile._id), type: 'document' });
      const media = response.media && typeof response.media === 'object' ? response.media as Record<string, any> : response;
      const variants = media.variants && typeof media.variants === 'object' ? media.variants as Record<string, string> : {};
      setForm(previous => ({ ...previous, [field]: String(variants.medium || variants.original || media.url || '') }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload the document scan.'); }
    finally { setBusy(false); }
  }

  const current = sequence[Math.min(step, sequence.length - 1)];
  const submitted = profile?.onboardingStatus === 'submitted' || profile?.isOnboarded === true;

  return <VerticalFrame title="Kraftnex Realty" subtitle={String(profile?.companyName || profile?.fullName || 'REAL ESTATE PARTNER')} tabs={TABS} activeTab="more" onTab={key => key === 'dashboard' && router.push('/realtor/dashboard')} onBack={() => router.back()}>
    {loading ? <StatePanel title="Loading your profile" message="Connecting to your realtor account…" /> : null}
    {!loading && error && !profile ? <StatePanel title="Realtor account required" message={error} retry={() => router.replace('/realtor/register')} /> : null}
    {!loading && profile ? <>
      <PageHeading eyebrow={submitted ? 'APPLICATION STATUS' : `STEP ${step + 1} OF ${sequence.length}`} title={submitted ? 'Submitted · under review' : current === 'profile' ? (business ? 'Company profile' : isOwner ? 'Owner profile' : 'Agent profile') : current === 'credentials' ? (isOwner ? 'Identity & ownership proof' : business ? 'Developer credentials' : 'RERA credentials') : current === 'areas' ? (business ? 'Operating areas' : 'Service area') : 'Ready to submit'} subtitle={submitted ? 'Your documents are with the Kraftnex verification team.' : 'Complete each section to submit your profile for review.'} />
      {error ? <StatePanel title="Couldn’t save this step" message={error} /> : null}
      {submitted ? <>
        <Panel tint><Text style={s.approvalTitle}>Account pending verification</Text><Text style={s.copy}>Kraftnex will review your identity and credentials. Your workspace will show the current approval status here.</Text><DataRow title="Verification status" detail={String(profile.approvalStatus || profile.onboardingStatus || 'submitted')} status={String(profile.approvalStatus || 'pending')} /></Panel>
        <PrimaryButton title="Open realtor dashboard" onPress={() => router.replace('/realtor/dashboard')} />
      </> : null}
      {!submitted && current === 'profile' ? <Panel>
        {business ? <>
          <Field label="Company name" value={form.companyName} onChangeText={set('companyName')} />
          <Field label="Year established" value={form.establishedYear} onChangeText={set('establishedYear')} keyboardType="numeric" />
          <Field label="Office address" value={form.officeAddress} onChangeText={set('officeAddress')} multiline />
        </> : isOwner ? <Field label="Current residential address (optional)" value={form.officeAddress} onChangeText={set('officeAddress')} multiline /> : <>
          <Field label="Agency / company" value={form.companyName} onChangeText={set('companyName')} />
          <Field label="Years of experience" value={form.establishedYear} onChangeText={set('establishedYear')} keyboardType="numeric" />
          <Field label="Office address" value={form.officeAddress} onChangeText={set('officeAddress')} multiline />
        </>}
        <Field label="Profile description" value={form.companyDescription} onChangeText={set('companyDescription')} multiline />
        <Field label="Website (optional)" value={form.website} onChangeText={set('website')} />
        <SelectChips label="Specializations" values={SPECIALIZATIONS} selected={form.specializations} multi onChange={value => setForm(current => ({ ...current, specializations: Array.isArray(value) ? value : [value] }))} />
      </Panel> : null}
      {!submitted && current === 'credentials' ? <Panel>
        {!isOwner ? <><Field label="RERA registration number" value={form.reraNumber} onChangeText={set('reraNumber')} /><Field label="RERA state" value={form.reraState} onChangeText={set('reraState')} /><Field label="RERA certificate URL" value={form.reraCertUrl} onChangeText={set('reraCertUrl')} /></> : null}
        <Field label="PAN" value={form.pan} onChangeText={set('pan')} />
        {business ? <><Field label="GSTIN" value={form.gstin} onChangeText={set('gstin')} helper="GSTIN is verified through Kraftnex before submission." /><Field label="Business proof URL" value={form.businessProofUrl} onChangeText={set('businessProofUrl')} /></> : null}
        <Field label="Government ID type" value={form.governmentIdType} onChangeText={set('governmentIdType')} />
        <Field label="Government ID number" value={form.governmentIdNumber} onChangeText={set('governmentIdNumber')} />
        <Field label="Government ID document URL" value={form.governmentIdUrl} onChangeText={set('governmentIdUrl')} />
        <PrimaryButton title="Choose government ID scan" onPress={() => void pickCredential('governmentIdUrl')} loading={busy} />
        {isOwner ? <><Field label="Ownership proof type" value={form.ownershipProofType} onChangeText={set('ownershipProofType')} placeholder="Sale deed, allotment letter, tax receipt" /><Field label="Ownership proof URL" value={form.ownershipProofUrl} onChangeText={set('ownershipProofUrl')} /><PrimaryButton title="Choose ownership proof scan" onPress={() => void pickCredential('ownershipProofUrl')} loading={busy} /></> : null}
        {!isOwner ? <PrimaryButton title="Choose RERA certificate scan" onPress={() => void pickCredential('reraCertUrl')} loading={busy} /> : null}
        {business ? <PrimaryButton title="Choose business proof scan" onPress={() => void pickCredential('businessProofUrl')} loading={busy} /> : null}
      </Panel> : null}
      {!submitted && current === 'areas' ? <Panel>
        <Field label="Cities served" value={form.serviceCities} onChangeText={set('serviceCities')} placeholder="Comma-separated city names" helper="At least one city is required." />
        <Field label="Localities served" value={form.serviceLocalities} onChangeText={set('serviceLocalities')} placeholder="Comma-separated localities" />
      </Panel> : null}
      {!submitted && current === 'ready' ? <Panel tint>
        <Text style={s.approvalTitle}>Review your information</Text>
        <DataRow title="Seller role" detail={accountType.replaceAll('_', ' ')} />
        <DataRow title="Profile" detail={String(profile.companyName || profile.fullName || '')} />
        <DataRow title="Credentials" detail={form.reraNumber || form.pan || 'Documents attached'} />
        {!isOwner ? <DataRow title="Service areas" detail={form.serviceCities || 'No cities selected'} /> : null}
        {business && !((profile.gstDetails as Record<string, unknown> | undefined)?.isVerified) ? <Text style={s.gstNotice}>Verify your GSTIN before submitting a builder or developer profile.</Text> : null}
      </Panel> : null}
      {!submitted ? <PrimaryButton title={current === 'ready' ? 'Submit for review' : 'Save and continue'} onPress={() => void saveStep()} loading={busy} disabled={current === 'ready' && business && !((profile.gstDetails as Record<string, unknown> | undefined)?.isVerified)} /> : null}
      {!submitted && step > 0 ? <PrimaryButton title="Previous step" onPress={() => setStep(index => Math.max(0, index - 1))} /> : null}
      {!submitted ? <Text style={s.stepFoot}>{step + 1} / {sequence.length} · Progress is saved to your realtor profile.</Text> : null}
    </> : null}
  </VerticalFrame>;
}

const s = StyleSheet.create({ approvalTitle: { color: palette.green, fontSize: 17, fontWeight: '800' }, copy: { color: palette.body, fontSize: 12, lineHeight: 18 }, gstNotice: { color: '#865c12', fontSize: 12, lineHeight: 18 }, stepFoot: { color: palette.muted, fontSize: 11, textAlign: 'center', paddingVertical: 4 } });
