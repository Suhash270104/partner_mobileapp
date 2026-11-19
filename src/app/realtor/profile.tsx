import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '../../components/AppText';
import { Icon } from '../../components/Icon';
import { c, ErrorText, Field } from '../../components/professional/onboardingUi';
import { partnerApi, PartnerApiError } from '../../lib/partnerApi';

// Edit profile for a realtor. The form is built from the server's own field list (GET /partner/profile/schema), so
// labels, limits and which fields may be edited always match the backend. It saves through PATCH /partner/profile only:
// no onboarding submit, so an approved or verified account is never sent back to review by editing basics.
type FieldDef = { key: string; label: string; group: string; type: string; access: 'edit' | 'verify' | 'view'; help?: string; rules?: { maxLength?: number }; options?: { values?: string[] }; labels?: Record<string, string>; verify?: { note?: string } };
type Group = { id: string; label: string; description?: string };
type Schema = { title?: string; groups: Group[]; fields: FieldDef[] };
type Values = Record<string, unknown>;
type ProfileResponse = { values?: Values; etag?: string };

const asList = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const asText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

export default function RealtorEditProfileScreen() {
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadError, setLoadError] = useState('');
  const [schema, setSchema] = useState<Schema | null>(null);
  const [saved, setSaved] = useState<Values>({});
  const [draft, setDraft] = useState<Values>({});
  const [etag, setEtag] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading'); setLoadError('');
    try {
      const [schemaResponse, profile] = await Promise.all([
        partnerApi.call<{ schema?: Schema }>('/partner/profile/schema?role=realtor'),
        partnerApi.call<ProfileResponse>('/partner/profile?role=realtor'),
      ]);
      if (!schemaResponse.schema) throw new Error('The profile form could not be loaded.');
      setSchema(schemaResponse.schema); setSaved(profile.values ?? {}); setDraft(profile.values ?? {}); setEtag(profile.etag);
      setPhase('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your profile.');
      setPhase('error');
    }
  }, []);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const editable = useMemo(() => (schema?.fields ?? []).filter(field => field.access === 'edit' && field.type !== 'photo'), [schema]);
  const changes = useMemo(() => {
    const result: Values = {};
    for (const field of editable) if (JSON.stringify(draft[field.key] ?? null) !== JSON.stringify(saved[field.key] ?? null)) result[field.key] = draft[field.key];
    return result;
  }, [draft, saved, editable]);
  const dirty = Object.keys(changes).length > 0;
  const set = (key: string, value: unknown) => { setMessage(''); setErrors(previous => ({ ...previous, [key]: '' })); setDraft(previous => ({ ...previous, [key]: value })); };

  async function save() {
    setBusy(true); setMessage(''); setErrors({});
    try {
      const result = await partnerApi.call<ProfileResponse & { message?: string }>('/partner/profile', 'PATCH', { role: 'realtor', changes, etag });
      setSaved(result.values ?? draft); setDraft(result.values ?? draft); setEtag(result.etag);
      setMessage(result.message || 'Profile updated.');
    } catch (error) {
      if (error instanceof PartnerApiError && error.data && typeof error.data === 'object' && 'errors' in error.data) {
        const raw = (error.data as { errors?: Record<string, unknown> }).errors ?? {};
        setErrors(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value)])));
      }
      setMessage(error instanceof PartnerApiError && error.code === 'PROFILE_CONFLICT' ? 'Your profile changed on another device. Reload to see the latest values.' : error instanceof Error ? error.message : 'Could not save your changes.');
    } finally { setBusy(false); }
  }

  function renderField(field: FieldDef) {
    const value = draft[field.key];
    const error = errors[field.key];
    if (field.type === 'toggle') {
      return <View key={field.key} style={s.toggleRow}><Text style={s.toggleLabel}>{field.label}</Text><Switch value={Boolean(value)} onValueChange={next => set(field.key, next)} trackColor={{ true: c.green }} /></View>;
    }
    if (field.type === 'select' || field.type === 'multiselect') {
      const multi = field.type === 'multiselect';
      const picked = multi ? asList(value) : [asText(value)];
      return <View key={field.key} style={s.block}>
        <Text style={s.label}>{field.label}</Text>
        <View style={s.chips}>{(field.options?.values ?? []).map(option => {
          const on = picked.includes(option);
          return <Pressable key={option} style={[s.chip, on && s.chipOn]} onPress={() => set(field.key, multi ? (on ? picked.filter(item => item !== option) : [...picked, option]) : option)} accessibilityRole="button" accessibilityState={{ selected: on }}><Text style={[s.chipText, on && s.chipTextOn]}>{field.labels?.[option] ?? option}</Text></Pressable>;
        })}</View>
        {!!field.help && <Text style={s.note}>{field.help}</Text>}
        {!!error && <ErrorText>{error}</ErrorText>}
      </View>;
    }
    const list = field.type === 'tags' || field.type === 'cities';
    return <View key={field.key}>
      <Field label={field.label} value={list ? asList(value).join(', ') : asText(value)}
        onChangeText={text => set(field.key, list ? text.split(',').map(item => item.trim()).filter(Boolean) : field.type === 'number' ? (text.trim() === '' ? null : Number(text.replace(/[^\d]/g, ''))) : text)}
        multiline={field.type === 'textarea'} keyboardType={field.type === 'number' ? 'numeric' : field.type === 'url' ? 'url' : 'default'} autoCapitalize={field.type === 'url' ? 'none' : 'sentences'}
        maxLength={field.rules?.maxLength} note={list ? 'Separate with commas.' : field.help} />
      {!!error && <ErrorText>{error}</ErrorText>}
    </View>;
  }

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/realtor/dashboard' as never));

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.header}>
      <Pressable onPress={leave} hitSlop={10} style={s.back} accessibilityRole="button" accessibilityLabel="Back"><Icon name="chevronLeft" size={22} color={c.green} /></Pressable>
      <Text style={s.title}>Edit profile</Text>
    </View>
    {phase === 'loading' ? <View style={s.center}><ActivityIndicator color={c.green} size="large" /></View> : null}
    {phase === 'error' ? <View style={s.center}><Text style={s.errorTitle}>Couldn&apos;t load your profile</Text><Text style={s.copy}>{loadError}</Text><Pressable style={s.cta} onPress={() => void load()}><Text style={s.ctaText}>Try again</Text></Pressable></View> : null}
    {phase === 'ready' && schema ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {schema.groups.map(group => {
          const fields = schema.fields.filter(field => field.group === group.id && field.type !== 'photo');
          if (!fields.length) return null;
          return <View key={group.id} style={s.card}>
            <Text style={s.group}>{group.label}</Text>
            {!!group.description && <Text style={s.note}>{group.description}</Text>}
            {fields.map(field => field.access === 'edit' ? renderField(field) : (
              <View key={field.key} style={s.block}>
                <Text style={s.label}>{field.label}</Text>
                <Text style={s.readOnly}>{field.access === 'verify' && field.verify?.note ? field.verify.note : asText(Array.isArray(saved[field.key]) ? asList(saved[field.key]).join(', ') : saved[field.key]) || '—'}</Text>
                {field.access === 'verify' && saved[field.key] !== undefined && !!asText(saved[field.key]) && <Text style={s.note}>Current: {asText(saved[field.key])}. Changes are reviewed by KraftNex.</Text>}
              </View>
            ))}
          </View>;
        })}
        {!!message && <Text style={errorsShown(errors) ? s.bad : s.good}>{message}</Text>}
        <Pressable style={[s.cta, (!dirty || busy) && { opacity: 0.5 }]} disabled={!dirty || busy} onPress={() => void save()} accessibilityRole="button">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Save changes</Text>}
        </Pressable>
        <Text style={s.note}>RERA, PAN, GST and verification documents are checked by KraftNex and can&apos;t be changed here. Saving this form does not affect your approval status.</Text>
      </ScrollView>
    </KeyboardAvoidingView> : null}
  </SafeAreaView>;
}

const errorsShown = (errors: Record<string, string>) => Object.values(errors).some(Boolean);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: c.line },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: c.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorTitle: { color: c.ink, fontSize: 17, fontWeight: '800' },
  copy: { color: c.body, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 },
  group: { color: c.ink, fontSize: 16.5, fontWeight: '800' },
  block: { gap: 6, marginTop: 4 },
  label: { color: c.body, fontSize: 13, fontWeight: '700' },
  note: { color: c.muted, fontSize: 12.5, lineHeight: 18 },
  readOnly: { color: c.ink, fontSize: 14.5, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.body, fontSize: 13.5, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  toggleLabel: { color: c.ink, fontSize: 14.5, fontWeight: '700', flex: 1 },
  cta: { minHeight: 50, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  good: { color: c.greenText, fontSize: 14, fontWeight: '700' },
  bad: { color: c.red, fontSize: 14, fontWeight: '700' },
});
