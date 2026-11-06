import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { partnerApi, PartnerApiError } from '../../lib/partnerApi';
import {
  AVAILABLE_CITIES,
  BUDGET_OPTIONS,
  establishedYears,
  EXPERTISE_OPTIONS,
  INDUSTRY_OPTIONS,
  MAX_SPECIALIZATIONS,
  OnboardingData,
  OPERATION_TYPES,
  PROPERTY_OPTIONS,
  ROLES,
  SERVICE_OPTIONS,
  SIZE_OPTIONS,
  SPECIALIZATION_OPTIONS,
  TAXONOMY_GROUPS,
  TIER_OPTIONS,
  toggleItem,
  WORK_MODELS,
} from '../../lib/professionalOnboarding';
import { c, Card, Chip, ChoiceCard, ErrorText, Field, Grid2, KaiCard, Mark, OptionTile, Pill, Question, Row, SectionLabel } from './onboardingUi';

export interface StageProps {
  data: OnboardingData;
  update: (fields: Partial<OnboardingData>) => void;
  // Stages that upload files tell the wizard so Continue waits for the upload to finish.
  onUploading?: (busy: boolean) => void;
}

const partnerSite = process.env.EXPO_PUBLIC_PARTNER_SITE_URL?.trim().replace(/\/+$/, '');

// ---------------------------------------------------------------- Stage 1
export function Stage1({ data, update }: StageProps) {
  const [gstInput, setGstInput] = useState(data.gstDetails?.gstin || '');
  const [verifying, setVerifying] = useState(false);
  const [gstError, setGstError] = useState('');
  const [yearsOpen, setYearsOpen] = useState(false);
  const [linkError, setLinkError] = useState('');

  const isRegistered = data.workModel === 'registered';
  const gstVerified = Boolean(data.gstDetails?.isVerified);

  const kai = data.businessName && data.role
    ? `Awesome! Welcome ${data.businessName}. As a ${data.role}, I'll tailor high-matching projects directly to your business profile.`
    : data.role
      ? `Got it, you operate as a ${data.role}! Next, tell me your studio or business name.`
      : data.workModel
        ? `Great choice! Operating as ${data.workModel === 'self' ? 'an Individual Professional' : data.workModel === 'registered' ? 'a Registered Company' : 'a Growing Team'} builds great credibility.`
        : "Hi! I'm KAI, your AI onboarding assistant. Let's begin with some basic details about how you work.";

  async function verifyGst() {
    const clean = gstInput.trim().toUpperCase();
    if (clean.length !== 15) {
      setGstError('Please enter a valid 15-character GSTIN (e.g. 27AAAAA0000A1Z5).');
      return;
    }
    setVerifying(true);
    setGstError('');
    try {
      const result = await partnerApi.verifyProfessionalGst(clean);
      if (result.success && result.data) {
        const gst = result.data;
        const updates: Partial<OnboardingData> = { gstDetails: gst };
        if (!data.businessName) updates.businessName = gst.tradeName || gst.legalName || '';
        if (!data.operationType && gst.constitution) {
          const constitution = gst.constitution.toLowerCase();
          if (constitution.includes('private limited')) updates.operationType = 'Private Limited';
          else if (constitution.includes('llp') || constitution.includes('limited liability')) updates.operationType = 'LLP';
          else if (constitution.includes('partnership')) updates.operationType = 'Partnership';
          else if (constitution.includes('proprietorship') || constitution.includes('individual')) updates.operationType = 'Individual';
        }
        update(updates);
      } else {
        setGstError(result.message || 'GST verification failed.');
      }
    } catch (error) {
      setGstError(error instanceof PartnerApiError ? error.message : 'Could not verify GSTIN. Please check the number and try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function openLink(path: string) {
    if (!partnerSite) {
      setLinkError('Set EXPO_PUBLIC_PARTNER_SITE_URL to open the Partner Terms and Privacy Policy.');
      return;
    }
    setLinkError('');
    try {
      await Linking.openURL(`${partnerSite}${path}`);
    } catch {
      setLinkError('Could not open the link.');
    }
  }

  return (
    <View>
      <KaiCard message={kai} sub="Select your role and operating structure so KAI can score and match your profile accurately." />

      <Question note="Choose the option that best describes you">How do you work professionally?</Question>
      {WORK_MODELS.map(model => (
        <ChoiceCard
          key={model.id}
          selected={data.workModel === model.id}
          onPress={() => update({ workModel: model.id })}
          title={model.title}
          subtitle={model.subtitle}
          body={model.desc}
          glyph={model.glyph}
        >
          <View style={s.bullets}>
            {model.bullets.map(bullet => <Text key={bullet} style={s.bullet}>✓  {bullet}</Text>)}
            <Text style={s.badgeText}>{model.badge}</Text>
          </View>
        </ChoiceCard>
      ))}

      <Question index="1.">What best describes you?</Question>
      <Grid2>{ROLES.map(role => <OptionTile key={role} label={role} multi={false} selected={data.role === role} onPress={() => update({ role })} />)}</Grid2>

      <Question index="2.">How do you operate?</Question>
      <Row>{OPERATION_TYPES.map(type => <Chip key={type} label={type} selected={data.operationType === type} onPress={() => update({ operationType: type })} />)}</Row>

      {isRegistered && (
        <Card tinted={gstVerified} style={{ marginTop: 22, ...(gstVerified ? null : { backgroundColor: c.amberSoft, borderColor: '#efd9a3' }) }}>
          <View style={s.gstHead}>
            <Text style={s.gstTitle}>Business GSTIN Verification <Text style={{ color: c.red }}>*</Text></Text>
            {gstVerified && <Pill label="Active & Verified" />}
          </View>
          <Text style={s.gstCopy}>Mandatory for registered companies. Validates active status and auto-fills official company registration details.</Text>
          <Field
            value={gstInput}
            maxLength={15}
            editable={!verifying && !gstVerified}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="27AAAAA0000A1Z5"
            onChangeText={text => { setGstInput(text.toUpperCase().replace(/[^0-9A-Z]/g, '')); setGstError(''); }}
          />
          {gstVerified ? (
            <Pressable style={s.ghost} onPress={() => { update({ gstDetails: undefined }); setGstInput(''); }}><Text style={s.ghostText}>Change GSTIN</Text></Pressable>
          ) : (
            <Pressable style={[s.verify, (verifying || gstInput.trim().length !== 15) && { opacity: 0.5 }]} disabled={verifying || gstInput.trim().length !== 15} onPress={() => void verifyGst()}>
              {verifying ? <ActivityIndicator color="#fff" /> : <Text style={s.verifyText}>Verify GST</Text>}
            </Pressable>
          )}
          {gstVerified && data.gstDetails && (
            <View style={s.gstResult}>
              <Text style={s.gstName}>{data.gstDetails.legalName || data.gstDetails.tradeName}</Text>
              {!!data.gstDetails.tradeName && data.gstDetails.tradeName !== data.gstDetails.legalName && <Text style={s.gstMeta}>Trade Name: {data.gstDetails.tradeName}</Text>}
              <Text style={s.gstMeta}>{data.gstDetails.constitution || 'Registered Company'}</Text>
              <Text style={s.gstMeta}>State: {data.gstDetails.state || 'N/A'}   PAN: {data.gstDetails.pan || 'N/A'}   Status: {data.gstDetails.gstStatus || 'Active'}</Text>
            </View>
          )}
          {!!gstError && <ErrorText>{gstError}</ErrorText>}
          {!gstVerified && <Text style={s.gstWarn}>Registered businesses must verify an active GSTIN before continuing to Step 2.</Text>}
        </Card>
      )}

      <Question index="3.">What is your business name?</Question>
      <Field
        value={data.businessName}
        onChangeText={businessName => update({ businessName })}
        placeholder="Enter your business or studio name"
        note={gstVerified ? 'Auto-filled from GST' : undefined}
      />

      <Question index="4.">When was your business established?</Question>
      <Pressable style={s.yearBox} onPress={() => setYearsOpen(open => !open)}>
        <Text style={[s.yearText, !data.establishedYear && { color: '#98a59f' }]}>{data.establishedYear || 'Select year'}</Text>
        <Text style={s.yearCaret}>{yearsOpen ? '▲' : '▼'}</Text>
      </Pressable>
      {yearsOpen && (
        <ScrollView style={s.yearList} nestedScrollEnabled>
          {establishedYears().map(year => (
            <Pressable key={year} style={[s.yearItem, data.establishedYear === year && { backgroundColor: c.greenSoft }]} onPress={() => { update({ establishedYear: year }); setYearsOpen(false); }}>
              <Text style={[s.yearItemText, data.establishedYear === year && { color: c.green, fontWeight: '800' }]}>{year}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Question index="5." note="Select all that apply">Which cities do you currently serve?</Question>
      <Row>{AVAILABLE_CITIES.map(city => <Chip key={city} label={city} selected={data.cities.includes(city)} onPress={() => update({ cities: toggleItem(data.cities, city) })} />)}</Row>

      <Pressable style={s.consent} onPress={() => update({ acceptedPartnerTerms: !data.acceptedPartnerTerms })} accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(data.acceptedPartnerTerms) }}>
        <Mark selected={Boolean(data.acceptedPartnerTerms)} square />
        <Text style={s.consentText}>
          I agree to the <Text style={s.link} onPress={() => void openLink('/terms/')}>Partner Terms of Service</Text> and{' '}
          <Text style={s.link} onPress={() => void openLink('/privacy/')}>Partner Privacy Policy</Text>, and consent to KraftNex processing my personal data, including verification and payout details, as described in them. I also agree to receive one-time codes and account and service updates from KraftNex on WhatsApp, SMS and email, and can opt out at any time by replying STOP or using the unsubscribe link.
        </Text>
      </Pressable>
      {!!linkError && <ErrorText>{linkError}</ErrorText>}
      <Text style={s.safe}>🔒  Your information is safe with us. We never share your data without your permission.</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Stage 2
export function Stage2({ data, update }: StageProps) {
  const expertise = data.primaryExpertise.join(', ');
  const industries = data.industries.join(', ');
  const kai = expertise && industries
    ? `Specializing in ${expertise} across ${industries}! KAI is building your high-intent lead matching algorithms.`
    : expertise
      ? `Great! Focusing on ${expertise}. Which industries and property types do you specialize in?`
      : "Great! Now let's dive deeper into your Business DNA. Tell me about the projects you enjoy the most.";
  return (
    <View>
      <KaiCard message={kai} sub="Select your expertise & property types to help KAI match high-converting projects." />
      <Question index="1." note="Select all that apply">What are your primary areas of expertise?</Question>
      <Grid2>{EXPERTISE_OPTIONS.map(item => <OptionTile key={item} label={item} selected={data.primaryExpertise.includes(item)} onPress={() => update({ primaryExpertise: toggleItem(data.primaryExpertise, item) })} />)}</Grid2>
      <Question index="2." note="Select all that apply">Which industries do you work in?</Question>
      <Grid2>{INDUSTRY_OPTIONS.map(item => <OptionTile key={item} label={item} selected={data.industries.includes(item)} onPress={() => update({ industries: toggleItem(data.industries, item) })} />)}</Grid2>
      <Question index="3." note="Select all that apply">What types of properties do you work on most often?</Question>
      <Grid2>{PROPERTY_OPTIONS.map(item => <OptionTile key={item} label={item} selected={data.propertyTypes.includes(item)} onPress={() => update({ propertyTypes: toggleItem(data.propertyTypes, item) })} />)}</Grid2>
    </View>
  );
}

// ---------------------------------------------------------------- Stage 3
export function Stage3({ data, update }: StageProps) {
  const services = data.services.join(', ');
  const budgets = data.budgetRanges.join(', ');
  const kai = services && budgets
    ? `Targeting ${budgets} budgets for ${services}! KAI will prioritize high-value clients in this tier.`
    : services
      ? `Offering ${services}! Now choose your typical budget ranges and project sizes.`
      : "Great! Let's get specific about your services, specializations, and budget ranges.";

  function toggleSpecialization(value: string) {
    if (!data.specializations.includes(value) && data.specializations.length >= MAX_SPECIALIZATIONS) return;
    update({ specializations: toggleItem(data.specializations, value) });
  }

  return (
    <View>
      <KaiCard message={kai} sub="Defining budget ranges & specializations unlocks higher accuracy in your AI Professional Score." />

      <Question note="Select all that apply — this drives your project matches">Which project types do you serve?</Question>
      {TAXONOMY_GROUPS.map(group => (
        <View key={group.label}>
          <SectionLabel>{group.label.toUpperCase()}</SectionLabel>
          <Grid2>{group.entries.map(entry => <OptionTile key={entry.id} label={entry.name} selected={(data.subtypes || []).includes(entry.id)} onPress={() => update({ subtypes: toggleItem(data.subtypes, entry.id) })} />)}</Grid2>
        </View>
      ))}

      <Question index="1." note="Select all that apply">What services do you offer?</Question>
      <Grid2>{SERVICE_OPTIONS.map(item => <OptionTile key={item} label={item} selected={data.services.includes(item)} onPress={() => update({ services: toggleItem(data.services, item) })} />)}</Grid2>

      <Question index="2." note={`Select up to ${MAX_SPECIALIZATIONS}`}>What is your primary expertise / specialization?</Question>
      <Grid2>{SPECIALIZATION_OPTIONS.map(item => <OptionTile key={item} label={item} selected={data.specializations.includes(item)} onPress={() => toggleSpecialization(item)} />)}</Grid2>

      <Question index="3." note="Select all that apply">What is your typical project budget range?</Question>
      <Grid2>{BUDGET_OPTIONS.map(item => <OptionTile key={item} label={item} selected={data.budgetRanges.includes(item)} onPress={() => update({ budgetRanges: toggleItem(data.budgetRanges, item) })} />)}</Grid2>

      <Question index="4." note="Required — select one">Which studio tier best fits your work?</Question>
      {TIER_OPTIONS.map(tier => (
        <ChoiceCard key={tier.id} selected={data.tier === tier.id} onPress={() => update({ tier: tier.id })} title={tier.label} body={tier.desc} />
      ))}

      <Question index="5." note="Select one">What is your typical project size?</Question>
      {SIZE_OPTIONS.map(size => (
        <ChoiceCard key={size.id} selected={data.projectSize === size.id} onPress={() => update({ projectSize: size.id })} title={size.label} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bullets: { marginTop: 10, gap: 5 },
  bullet: { color: c.body, fontSize: 12.5, fontWeight: '600' },
  badgeText: { color: c.greenText, fontSize: 11.5, fontWeight: '700', marginTop: 6, lineHeight: 16 },
  gstHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gstTitle: { flex: 1, color: c.ink, fontSize: 15, fontWeight: '800' },
  gstCopy: { color: c.body, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 },
  verify: { height: 48, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  verifyText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ghost: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: c.ink, fontSize: 13, fontWeight: '700' },
  gstResult: { marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#cfe5d9', gap: 3 },
  gstName: { color: c.ink, fontSize: 14, fontWeight: '800' },
  gstMeta: { color: c.body, fontSize: 12 },
  gstWarn: { color: c.amber, fontSize: 12, fontWeight: '600', marginTop: 10 },
  yearBox: { minHeight: 50, borderRadius: 13, borderWidth: 1.5, borderColor: c.line, backgroundColor: '#fff', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearText: { color: c.ink, fontSize: 15 },
  yearCaret: { color: c.muted, fontSize: 11 },
  yearList: { maxHeight: 220, marginTop: 6, borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: '#fff' },
  yearItem: { paddingVertical: 12, paddingHorizontal: 14 },
  yearItemText: { color: c.ink, fontSize: 14 },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 24, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 14 },
  consentText: { flex: 1, color: c.body, fontSize: 12, lineHeight: 18 },
  link: { color: c.green, fontWeight: '800', textDecorationLine: 'underline' },
  safe: { color: c.muted, fontSize: 11.5, marginTop: 14, lineHeight: 16 },
});
