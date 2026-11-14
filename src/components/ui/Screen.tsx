import { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { PillButton } from '../realtor/RealtorControls';

export interface ScreenProps {
  title?: string; subtitle?: string; onBack?: () => void; action?: ReactNode;
  loading?: boolean; error?: string; onRetry?: () => void;
  refreshing?: boolean; onRefresh?: () => void;
  footer?: ReactNode; standalone?: boolean; children?: ReactNode;
}

/**
 * Standard page: optional title row with back button and action, pull-to-refresh, keyboard avoidance,
 * and one consistent loading / error presentation. `standalone` adds its own safe-area for screens outside the workspace shell.
 */
export function Screen({ title, subtitle, onBack, action, loading, error, onRetry, refreshing, onRefresh, footer, standalone, children }: ScreenProps) {
  const body = <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={s.flex} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
      {title || onBack ? <View style={s.head}>
        {onBack ? <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back" style={s.back}><Icon name="chevronLeft" size={26} color={palette.ink} /></Pressable> : null}
        <View style={s.flex}>
          {title ? <Text style={s.title} numberOfLines={2}>{title}</Text> : null}
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View> : null}
      {loading ? <View style={s.center}><ActivityIndicator color={palette.green} /><Text style={s.muted}>Loading…</Text></View>
        : error ? <View style={s.error}><Icon name="shield" size={26} color={palette.red} /><Text style={s.errorTitle}>Something went wrong</Text><Text style={s.errorText}>{error}</Text>{onRetry ? <PillButton title="Try again" icon="arrowRight" variant="soft" onPress={onRetry} /> : null}</View>
        : children}
    </ScrollView>
    {footer}
  </KeyboardAvoidingView>;
  return standalone ? <SafeAreaView style={s.safe} edges={['top', 'bottom']}>{body}</SafeAreaView> : <View style={s.safe}>{body}</View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg }, flex: { flex: 1, minWidth: 0 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 }, back: { marginLeft: -6, width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 24, fontWeight: '800', lineHeight: 30 }, subtitle: { color: palette.body, fontSize: 13, lineHeight: 19, marginTop: 2 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 48 }, muted: { color: palette.muted, fontSize: 13 },
  error: { alignItems: 'center', gap: 8, padding: 22, borderRadius: 18, backgroundColor: palette.redSoft },
  errorTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' }, errorText: { color: palette.body, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 6 },
});
