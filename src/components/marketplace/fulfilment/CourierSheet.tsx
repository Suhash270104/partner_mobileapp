import { useState } from 'react';
import { View } from 'react-native';
import { COURIER_OPTIONS } from '../../../lib/marketplace/constants';
import { isTrackingNumber } from '../../../lib/marketplace/fulfilment';
import { errorMessage } from '../../../lib/marketplace/errors';
import { BottomSheet, FormField, PillButton, SelectField, Text, palette } from '../../ui';

type Confirm = (input: { courierPartner: string; trackingNumber: string }) => Promise<void>;

function CourierForm({ confirmLabel, onConfirm, onClose }: { confirmLabel: string; onConfirm: Confirm; onClose: () => void }) {
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!courier) { setError('Choose a courier partner.'); return; }
    if (!isTrackingNumber(tracking)) { setError('Enter a tracking number using letters, digits and hyphens.'); return; }
    setBusy(true); setError('');
    try { await onConfirm({ courierPartner: courier, trackingNumber: tracking.trim() }); onClose(); }
    catch (cause) { setError(errorMessage(cause, 'Could not save this step.')); }
    finally { setBusy(false); }
  };

  return <View style={{ gap: 14 }}>
    <SelectField label="Courier partner" required value={courier} options={COURIER_OPTIONS} onChange={setCourier} placeholder="Select courier" />
    <FormField label="Tracking / AWB number" required value={tracking} onChangeText={setTracking} autoCapitalize="none" />
    {error ? <Text style={{ color: palette.red, fontSize: 13, fontWeight: '700' }}>{error}</Text> : null}
    <PillButton title={confirmLabel} icon="send" loading={busy} onPress={() => void confirm()} />
  </View>;
}

/** Courier partner + tracking number, used to ship an order or schedule a return pickup. The form remounts on every open, so it always starts empty. */
export function CourierSheet({ visible, title, confirmLabel, onClose, onConfirm }: { visible: boolean; title: string; confirmLabel: string; onClose: () => void; onConfirm: Confirm }) {
  return <BottomSheet visible={visible} onClose={onClose} title={title}>{visible ? <CourierForm confirmLabel={confirmLabel} onConfirm={onConfirm} onClose={onClose} /> : null}</BottomSheet>;
}
