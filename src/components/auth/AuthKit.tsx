import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TextInput } from '../AppText';

// The look of the login screen as small reusable parts, so every sign-in step (mobile number, code, details, verify phone)
// shares one design: soft page, white rounded inputs, deep-green buttons, the Kraftnex logo on top.

const logo = require('../../../assets/kraftnex-logo-transparent.png');
const LOGO_ASPECT = 1600 / 519;
const LOGO_WIDTH = 170;

export const authColors = {
  page: '#fbf9ff', green: '#06291f', ink: '#002a20', label: '#071f1a', body: '#34485d', muted: '#5a6872',
  placeholder: '#718096', error: '#b42318', line: '#ece8f5',
} as const;

/** Page frame: back arrow and title bar, logo, big heading, subtitle, then the step's content. */
export function AuthShell({ title, subtitle, headerTitle, onBack, children }: { title: string; subtitle?: string; headerTitle?: string; onBack?: () => void; children: ReactNode }) {
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} style={s.back} onPress={onBack}>{onBack ? <Text style={s.backArrow}>‹</Text> : null}</Pressable>
        <Text style={s.headerTitle}>{headerTitle ?? 'Kraftnex Partner'}</Text>
        <View style={s.back} />
      </View>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <Image source={logo} resizeMode="contain" accessibilityLabel="Kraftnex — Where People & Spaces Connect" style={s.logo} />
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </SafeAreaView>;
}

type InputProps = ComponentProps<typeof TextInput>;

/** Label, white rounded input with an optional fixed prefix (like +91), and an inline error. */
export function AuthField({ label, prefix, error, helper, ...input }: { label: string; prefix?: string; error?: string; helper?: string } & InputProps) {
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <View style={[s.inputBox, !!error && s.inputBoxError]}>
      {prefix ? <><Text style={s.prefix}>{prefix}</Text><View style={s.prefixRule} /></> : null}
      <TextInput style={s.input} placeholderTextColor={authColors.placeholder} accessibilityLabel={label} {...input} />
    </View>
    {error ? <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text> : helper ? <Text style={s.helper}>{helper}</Text> : null}
  </View>;
}

/** Solid green (main action), outlined (alternative), or a plain text link. */
export function AuthButton({ title, onPress, loading, disabled, variant = 'solid' }: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'solid' | 'outline' | 'link' }) {
  const off = !!loading || !!disabled;
  if (variant === 'link') return <Pressable accessibilityRole="button" onPress={onPress} disabled={off} style={[s.linkButton, off && s.dim]}><Text style={s.linkText}>{title}</Text></Pressable>;
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={off} style={[s.button, variant === 'outline' && s.buttonOutline, off && s.dim]}>
    {loading ? <ActivityIndicator color={variant === 'outline' ? authColors.green : '#fff'} /> : <Text style={[s.buttonText, variant === 'outline' && s.buttonTextOutline]}>{title}</Text>}
  </Pressable>;
}

/** Same checkbox as the login screen's "Remember me", with room for a sentence. */
export function AuthCheckbox({ checked, onToggle, error, children }: { checked: boolean; onToggle: () => void; error?: boolean; children: ReactNode }) {
  return <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={s.checkRow}>
    <View style={[s.checkbox, checked && s.checkboxOn, error && s.checkboxError]}>{checked ? <Text style={s.checkmark}>✓</Text> : null}</View>
    <Text style={s.checkText}>{children}</Text>
  </Pressable>;
}

/** A calm message box for states like "this step timed out". */
export function AuthNotice({ title, message }: { title: string; message: string }) {
  return <View style={s.notice}><Text style={s.noticeTitle}>{title}</Text><Text style={s.noticeText}>{message}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#ebe9f0' : authColors.page },
  screen: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: authColors.page },
  flex: { flex: 1 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f1eef5' },
  back: { width: 42, height: 42, justifyContent: 'center' }, backArrow: { color: '#17212b', fontSize: 34, lineHeight: 38 },
  headerTitle: { color: '#353b3a', fontSize: 14, fontWeight: '500' },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  logo: { alignSelf: 'center', width: LOGO_WIDTH, height: LOGO_WIDTH / LOGO_ASPECT, marginTop: 22, marginBottom: 20 },
  title: { fontSize: 28, lineHeight: 35, letterSpacing: -0.6, color: authColors.ink, fontWeight: '500', marginBottom: 2 },
  subtitle: { color: authColors.body, fontSize: 14, lineHeight: 21, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: authColors.label, fontWeight: '500' },
  inputBox: { height: 51, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, marginTop: 7, borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#4b3a63', shadowOpacity: 0.055, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  inputBoxError: { borderColor: authColors.error },
  prefix: { color: '#17212b', fontSize: 14, fontWeight: '600' }, prefixRule: { width: 1, height: 22, backgroundColor: authColors.line, marginHorizontal: 12 },
  input: { flex: 1, color: '#17212b', fontSize: 14, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineWidth: 0, outlineColor: 'transparent' } : null) },
  error: { color: authColors.error, fontSize: 12, marginTop: 6 }, helper: { color: authColors.muted, fontSize: 12, marginTop: 6 },
  button: { height: 54, borderRadius: 12, backgroundColor: authColors.green, alignItems: 'center', justifyContent: 'center', marginTop: 6, shadowColor: '#001b14', shadowOpacity: 0.17, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  buttonOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: authColors.green, shadowOpacity: 0, elevation: 0 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, buttonTextOutline: { color: authColors.green },
  linkButton: { alignItems: 'center', paddingVertical: 14 }, linkText: { color: authColors.ink, fontSize: 13, fontWeight: '700' },
  dim: { opacity: 0.62 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  checkbox: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: '#73817b', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: authColors.green, borderColor: authColors.green }, checkboxError: { borderColor: authColors.error },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 }, checkText: { flex: 1, color: '#465261', fontSize: 12.5, lineHeight: 18 },
  notice: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, gap: 4, borderWidth: 1, borderColor: authColors.line },
  noticeTitle: { color: authColors.ink, fontSize: 14, fontWeight: '700' }, noticeText: { color: authColors.body, fontSize: 13, lineHeight: 19 },
});
