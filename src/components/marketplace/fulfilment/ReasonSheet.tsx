import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '../../../lib/marketplace/errors';
import { BottomSheet, FormField, PillButton, Text, palette } from '../../ui';

function ReasonForm({ confirmLabel, onConfirm, onClose }: { confirmLabel: string; onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (reason.trim().length < 3) { setError('Please give a short reason.'); return; }
    setBusy(true); setError('');
    try { await onConfirm(reason.trim()); onClose(); }
    catch (cause) { setError(errorMessage(cause, 'Could not save this step.')); }
    finally { setBusy(false); }
  };

  return <View style={{ gap: 14 }}>
    <FormField label="Reason" required value={reason} onChangeText={setReason} multiline maxLength={500} helper="The buyer is told this reason." />
    {error ? <Text style={{ color: palette.red, fontSize: 13, fontWeight: '700' }}>{error}</Text> : null}
    <PillButton title={confirmLabel} variant="danger" loading={busy} onPress={() => void confirm()} />
  </View>;
}

/** Asks for a written reason before a rejecting step (cancel an order, reject a return). Starts empty on every open. */
export function ReasonSheet({ visible, title, confirmLabel, onClose, onConfirm }: { visible: boolean; title: string; confirmLabel: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  return <BottomSheet visible={visible} onClose={onClose} title={title}>{visible ? <ReasonForm confirmLabel={confirmLabel} onConfirm={onConfirm} onClose={onClose} /> : null}</BottomSheet>;
}
