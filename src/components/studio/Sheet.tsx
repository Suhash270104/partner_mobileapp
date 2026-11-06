import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { c } from '../professional/onboardingUi';

// Bottom sheet used for every studio dialog (unlock, proposal, refund, invite…).
export function Sheet({ visible, title, eyebrow, onClose, locked, children }: {
  visible: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  // While a request is in flight the sheet cannot be dismissed.
  locked?: boolean;
  children: ReactNode;
}) {
  const close = () => { if (!locked) onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={close} />
        <View style={s.sheet}>
          <View style={s.grabber} />
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              {!!eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
              <Text style={s.title} numberOfLines={2}>{title}</Text>
            </View>
            <Pressable onPress={close} disabled={locked} style={[s.close, locked && { opacity: 0.4 }]} accessibilityLabel="Close"><Text style={s.closeText}>×</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,24,18,0.55)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, maxHeight: '92%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d5ddd9', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  eyebrow: { color: c.greenText, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 3 },
  title: { color: c.ink, fontSize: 18, fontWeight: '800' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eef3f0', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: c.ink, fontSize: 22, lineHeight: 24 },
});
