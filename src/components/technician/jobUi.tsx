import { useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../AppText';
import type { TextInputInstance } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { JobPhoto, JobPhotoPhase, partnerApi, TECHNICIAN_CANCEL_REASONS, TechnicianBookingRecord } from '../../lib/partnerApi';
import { uploadJobPhoto } from '../../lib/technicianJobPhotoUpload';

export const colors = {
  forest: '#07523e',
  deep: '#073c30',
  ink: '#123d31',
  muted: '#71817a',
  line: '#ebefed',
  soft: '#e8f4ee',
  amber: '#b45309',
  amberSoft: '#fff7e6',
  danger: '#b3261e',
  dangerSoft: '#fff0ef',
};

const cleanAmount = (text: string) => text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function OtpBoxes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<TextInputInstance | null>(null);
  return <Pressable onPress={() => input.current?.focus()} style={ui.otpRow} accessibilityLabel="4-digit code">
    {[0, 1, 2, 3].map(index => <View key={index} style={[ui.otpBox, value.length === index && ui.otpBoxActive]}>
      <Text style={ui.otpDigit}>{value[index] || ''}</Text>
    </View>)}
    <TextInput
      ref={input}
      value={value}
      onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, 4))}
      keyboardType="number-pad"
      maxLength={4}
      style={ui.otpHidden}
      caretHidden
    />
  </Pressable>;
}

export function PhotoStrip({ bookingId, phase, photos, minRequired, label, onUploaded }: {
  bookingId: string;
  phase: JobPhotoPhase;
  photos: JobPhoto[];
  minRequired: number;
  label: string;
  onUploaded: (booking: TechnicianBookingRecord) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const count = photos.length;
  const satisfied = count >= minRequired;

  async function capture() {
    setError('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Camera permission is off. Allow camera access to document the job.');
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled) return;
      setUploading(true);
      onUploaded(await uploadJobPhoto(result.assets[0], bookingId, phase));
    } catch (e) {
      setError(message(e, 'Photo upload failed'));
    } finally {
      setUploading(false);
    }
  }

  return <View>
    <View style={ui.photoHead}>
      <Text style={ui.eyebrow}>{label}</Text>
      <Text style={[ui.countPill, satisfied ? ui.countOk : ui.countWarn]}>{count} of {minRequired} required</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.photoRow}>
      {photos.map((photo, index) => <Image key={photo.imageId || photo.url || index} source={{ uri: photo.url }} style={ui.photo} />)}
      <Pressable disabled={uploading} onPress={() => void capture()} style={[ui.photoAdd, uploading && ui.disabled]} accessibilityLabel={`Add ${phase} photo`}>
        {uploading ? <ActivityIndicator color={colors.forest} /> : <>
          <Text style={ui.photoAddIcon}>{satisfied ? '✓' : '◉'}</Text>
          <Text style={ui.photoAddText}>{satisfied ? 'Add more' : 'Capture'}</Text>
        </>}
      </Pressable>
    </ScrollView>
    {!!error && <Text style={ui.error}>{error}</Text>}
  </View>;
}

export function ScopeSheet({ visible, bookingId, originalIssue, onClose, onSubmitted }: {
  visible: boolean;
  bookingId: string;
  originalIssue: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [discoveredIssue, setDiscoveredIssue] = useState('');
  const [suggestedFix, setSuggestedFix] = useState('');
  const [partName, setPartName] = useState('');
  const [partPrice, setPartPrice] = useState('');
  const [laborPrice, setLaborPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = (value: string) => Math.max(0, Number(value) || 0);
  const total = amount(partPrice) + amount(laborPrice);

  async function submit() {
    if (!discoveredIssue.trim() || total <= 0) {
      setError('Describe the discovered issue and enter a part/labor price above ₹0');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await partnerApi.submitTechnicianDiagnosisAddon(bookingId, {
        discoveredIssue: discoveredIssue.trim(),
        suggestedFix: suggestedFix.trim(),
        partName: partName.trim(),
        partPrice: amount(partPrice),
        laborPrice: amount(laborPrice),
      });
      setDiscoveredIssue(''); setSuggestedFix(''); setPartName(''); setPartPrice(''); setLaborPrice('');
      onSubmitted();
      onClose();
    } catch (e) {
      setError(message(e, 'Could not submit scope change'));
    } finally {
      setBusy(false);
    }
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.backdrop}>
      <View style={ui.sheet}>
        <View style={ui.sheetHead}>
          <Text style={ui.sheetTitle}>Report scope change</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close"><Text style={ui.close}>✕</Text></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.sheetBody}>
          {!!originalIssue && <View style={ui.note}><Text style={ui.noteText}>Original request: <Text style={ui.noteStrong}>{originalIssue}</Text></Text></View>}
          <Text style={ui.label}>Discovered issue *</Text>
          <TextInput style={ui.input} value={discoveredIssue} onChangeText={setDiscoveredIssue} placeholder="e.g. Condenser coil flare joint crack" placeholderTextColor="#9aa8a2" />
          <Text style={ui.label}>Suggested fix</Text>
          <TextInput style={[ui.input, ui.textArea]} value={suggestedFix} onChangeText={setSuggestedFix} multiline placeholder="e.g. Braze joint and replace service valve" placeholderTextColor="#9aa8a2" />
          <Text style={ui.label}>Part name (optional)</Text>
          <TextInput style={ui.input} value={partName} onChangeText={setPartName} placeholder="Part name" placeholderTextColor="#9aa8a2" />
          <View style={ui.twoCols}>
            <View style={ui.flex}>
              <Text style={ui.label}>Part cost (₹)</Text>
              <TextInput style={ui.input} value={partPrice} onChangeText={text => setPartPrice(cleanAmount(text))} keyboardType="numeric" placeholder="0" placeholderTextColor="#9aa8a2" />
            </View>
            <View style={ui.flex}>
              <Text style={ui.label}>Labor cost (₹)</Text>
              <TextInput style={ui.input} value={laborPrice} onChangeText={text => setLaborPrice(cleanAmount(text))} keyboardType="numeric" placeholder="0" placeholderTextColor="#9aa8a2" />
            </View>
          </View>
          <View style={ui.totalRow}>
            <Text style={ui.totalLabel}>Total add-on price</Text>
            <Text style={ui.totalValue}>₹{total.toLocaleString('en-IN')}</Text>
          </View>
          {!!error && <Text style={ui.errorBox}>{error}</Text>}
          <Pressable disabled={busy} onPress={() => void submit()} style={[ui.primary, busy && ui.disabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryText}>Send to customer for approval  →</Text>}
          </Pressable>
          <Text style={ui.fineprint}>The customer approves or rejects this in their app. They are never charged without approval.</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function CancelSheet({ visible, initialReason, busy, error, onClose, onCancel }: {
  visible: boolean;
  initialReason?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCancel: (reasonCode: string, note: string) => void;
}) {
  const [reasonCode, setReasonCode] = useState(initialReason || '');
  const [note, setNote] = useState('');
  const needsNote = reasonCode === 'OTHER';
  const canSubmit = Boolean(reasonCode) && (!needsNote || note.trim().length > 0) && !busy;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ui.backdrop}>
      <View style={ui.sheet}>
        <View style={ui.sheetHead}>
          <Text style={ui.sheetTitle}>Cancel this job</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close"><Text style={ui.close}>✕</Text></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.sheetBody}>
          <View style={ui.warnBox}>
            <Text style={ui.warnTitle}>Can&apos;t make it?</Text>
            <Text style={ui.warnText}>We will offer it to the next technician straight away. The customer keeps their booking. Cancelling close to the visit is recorded against your reliability.</Text>
          </View>
          <Text style={ui.eyebrow}>Primary reason</Text>
          {TECHNICIAN_CANCEL_REASONS.map(reason => <Pressable key={reason.code} onPress={() => setReasonCode(reason.code)} style={[ui.reason, reasonCode === reason.code && ui.reasonActive]} accessibilityRole="radio" accessibilityState={{ selected: reasonCode === reason.code }}>
            <View style={[ui.radio, reasonCode === reason.code && ui.radioActive]}>{reasonCode === reason.code && <View style={ui.radioDot} />}</View>
            <Text style={ui.reasonText}>{reason.label}</Text>
          </Pressable>)}
          {needsNote && <TextInput
            style={[ui.input, ui.textArea]}
            value={note}
            onChangeText={text => setNote(text.slice(0, 500))}
            multiline
            placeholder="Tell us briefly why (only our team sees this)"
            placeholderTextColor="#9aa8a2"
          />}
          {!!error && <Text style={ui.errorBox}>{error}</Text>}
          <View style={ui.twoCols}>
            <Pressable onPress={onClose} style={[ui.secondary, ui.flex]}><Text style={ui.secondaryText}>Keep the job</Text></Pressable>
            <Pressable disabled={!canSubmit} onPress={() => onCancel(reasonCode, note.trim())} style={[ui.danger, ui.flex, !canSubmit && ui.disabled]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryText}>Cancel job</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export const ui = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  eyebrow: { color: '#5f7068', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  label: { color: '#33463f', fontSize: 11, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#dfe6e2', backgroundColor: '#f8faf9', paddingHorizontal: 12, color: '#123d31', fontSize: 13, fontWeight: '600' },
  textArea: { minHeight: 70, paddingTop: 10, textAlignVertical: 'top' },
  twoCols: { flexDirection: 'row', gap: 10, marginTop: 4 },
  error: { color: colors.danger, fontSize: 11, fontWeight: '700', marginTop: 6 },
  errorBox: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 10, padding: 10, fontSize: 11, fontWeight: '700', marginTop: 10, overflow: 'hidden' },
  primary: { height: 48, borderRadius: 12, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  secondary: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#d9e3de', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  secondaryText: { color: '#3f5a50', fontSize: 12, fontWeight: '800' },
  danger: { height: 46, borderRadius: 12, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  otpBox: { width: 52, height: 58, borderRadius: 12, borderWidth: 1.5, borderColor: '#d9e3de', backgroundColor: '#f1f6f3', alignItems: 'center', justifyContent: 'center' },
  otpBoxActive: { borderColor: colors.forest, backgroundColor: '#fff' },
  otpDigit: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  otpHidden: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
  photoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  countPill: { fontSize: 10, fontWeight: '900', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  countOk: { backgroundColor: '#d9f2e5', color: '#126744' },
  countWarn: { backgroundColor: '#fdecc8', color: colors.amber },
  photoRow: { gap: 8 },
  photo: { width: 84, height: 84, borderRadius: 12, backgroundColor: '#e6ece9' },
  photoAdd: { width: 84, height: 84, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#b7c9c1', alignItems: 'center', justifyContent: 'center', gap: 3 },
  photoAddIcon: { color: colors.forest, fontSize: 18 },
  photoAddText: { color: '#5f7068', fontSize: 10, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(7,31,24,0.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  close: { color: '#6b7c75', fontSize: 18, paddingHorizontal: 4 },
  sheetBody: { padding: 18, paddingBottom: 30 },
  note: { backgroundColor: '#f3f6f4', borderRadius: 10, padding: 10 },
  noteText: { color: '#6b7c75', fontSize: 11 },
  noteStrong: { color: '#33463f', fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3f6f4', borderRadius: 11, padding: 12, marginTop: 14 },
  totalLabel: { color: '#5f7068', fontSize: 12, fontWeight: '700' },
  totalValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  fineprint: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10 },
  warnBox: { backgroundColor: colors.amberSoft, borderRadius: 12, padding: 12, marginBottom: 14 },
  warnTitle: { color: '#7a3d00', fontSize: 12, fontWeight: '900' },
  warnText: { color: '#8a5320', fontSize: 11, lineHeight: 16, marginTop: 4 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e2e9e5', borderRadius: 12, padding: 12, marginTop: 8 },
  reasonActive: { borderColor: colors.forest, backgroundColor: '#f1f8f4' },
  reasonText: { flex: 1, color: '#33463f', fontSize: 12, fontWeight: '700' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#b7c9c1', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.forest },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.forest },
});
