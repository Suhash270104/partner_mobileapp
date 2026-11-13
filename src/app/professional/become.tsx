import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '../../components/Icon';
import { partnerApi, PartnerApiError } from '../../lib/partnerApi';
import { phoneError, sanitizePhoneInput } from '../../lib/authValidation';
import { c, ErrorText, Field } from '../../components/professional/onboardingUi';

// "Add a studio workspace" for a signed-in Kraftnex account that has none yet: the same single call
// the website's /become-professional page makes (POST /identity/become-professional, type designer).
export default function BecomeProfessionalScreen() {
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [locality, setLocality] = useState('');
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!accepted) { setError('Please accept the partner terms to continue.'); return; }
    if (!companyName.trim() || !city.trim()) { setError('Studio name and city are required.'); return; }
    if (phone.trim()) {
      const problem = phoneError(phone);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    setError('');
    try {
      await partnerApi.becomeProfessional({
        type: 'designer',
        companyName: companyName.trim(),
        city: city.trim(),
        locality: locality.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      await partnerApi.recordPartnerLegalConsent('workspace_designer').catch(() => {});
      // Refresh the session so the new studio role is picked up everywhere, then open the studio.
      await partnerApi.session().catch(() => {});
      router.replace('/professional/dashboard' as never);
    } catch (e) {
      setError(e instanceof PartnerApiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevronLeft" size={22} color={c.green} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>SAME ACCOUNT, SAME LOGIN</Text>
          <Text style={s.title}>Add a studio workspace</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.copy}>List your design studio and receive client leads using the account you already have. You can finish your full profile and portfolio from the studio dashboard.</Text>
          <View style={s.card}>
            <Field label="STUDIO NAME *" value={companyName} onChangeText={setCompanyName} placeholder="e.g. Studio Aarav" />
            <Field label="CITY *" value={city} onChangeText={setCity} placeholder="e.g. Hyderabad" />
            <Field label="LOCALITY" value={locality} onChangeText={setLocality} placeholder="Optional" />
            <Field label="MOBILE NUMBER" value={phone} onChangeText={value => setPhone(sanitizePhoneInput(value))} keyboardType="phone-pad" maxLength={10} placeholder="Optional if your account already has one" />
            <Pressable style={s.terms} onPress={() => setAccepted(value => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
              <View style={[s.box, accepted && s.boxOn]}>{accepted && <Icon name="check" size={13} color="#fff" strokeWidth={3.2} />}</View>
              <Text style={s.termsText}>I agree to the Kraftnex partner terms and privacy policy.</Text>
            </Pressable>
            {!!error && <ErrorText>{error}</ErrorText>}
            <Pressable style={[s.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={() => void submit()}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Create studio workspace</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: c.line },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', color: c.muted, letterSpacing: 0.7 },
  title: { fontSize: 20, fontWeight: '800', color: c.ink },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  copy: { color: c.body, fontSize: 13.5, lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#c3d3cc', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: c.green, borderColor: c.green },
  termsText: { flex: 1, color: c.body, fontSize: 12.5, lineHeight: 18 },
  cta: { height: 50, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
