import { StyleSheet, View } from 'react-native';
import { IconTile, PillButton, Text, palette } from '../ui';
import type { Tone } from '../../lib/marketplace/types';

export type BlockedKind = 'pending' | 'suspended' | 'rejected';

const COPY: Record<BlockedKind, { icon: string; tone: Tone; title: string; message: string }> = {
  pending: { icon: 'clock', tone: 'amber', title: 'Your store is awaiting approval', message: 'Our team is reviewing your store. We will let you know as soon as it goes live. Pull down to check again.' },
  suspended: { icon: 'lock', tone: 'red', title: 'This store has been suspended', message: 'Your store is hidden from the marketplace for now. Contact support to find out why and how to get it restored.' },
  rejected: { icon: 'x', tone: 'red', title: 'Your store application was not approved', message: 'Your application did not pass review. Contact support if you would like to fix the issue and apply again.' },
};

/** Full-page notice for a store that cannot open its workspace (hand-off §6). */
export function BlockedState({ kind, reason, onCheckAgain, checking, onContactSupport, onSignOut }: {
  kind: BlockedKind; reason?: string; onCheckAgain: () => void; checking: boolean; onContactSupport?: () => void; onSignOut: () => void;
}) {
  const copy = COPY[kind];
  return <View style={s.wrap}>
    <IconTile icon={copy.icon} tone={copy.tone} size={72} />
    <Text style={s.title}>{copy.title}</Text>
    <Text style={s.message}>{copy.message}</Text>
    {reason ? <View style={s.reason}><Text style={s.reasonLabel}>Reason from our team</Text><Text style={s.reasonText}>{reason}</Text></View> : null}
    <View style={s.actions}>
      <PillButton title="Check again" icon="arrowRight" loading={checking} onPress={onCheckAgain} />
      {onContactSupport ? <PillButton title="Contact support" icon="phone" variant="soft" onPress={onContactSupport} /> : null}
      <PillButton title="Sign out" icon="logOut" variant="ghost" onPress={onSignOut} />
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  title: { color: palette.ink, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  message: { color: palette.body, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  reason: { alignSelf: 'stretch', padding: 14, borderRadius: 16, backgroundColor: palette.redSoft, gap: 4 },
  reasonLabel: { color: palette.red, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }, reasonText: { color: palette.ink, fontSize: 14, lineHeight: 20 },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
});
