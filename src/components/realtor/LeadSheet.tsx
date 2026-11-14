import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Icon } from '../Icon';
import { Text } from '../AppText';
import { palette } from '../vertical/VerticalUi';
import { BottomSheet, PillButton, SelectField, toOptions } from './RealtorControls';
import { FormField } from './RealtorForm';
import { Data, LEAD_STATUS_OPTIONS, humanize } from './realtorFormat';
import { realtorApi } from '../../lib/partnerVerticalApi';

const dateOnly = (value: unknown) => { const t = new Date(String(value || '')); return Number.isFinite(t.getTime()) ? t.toISOString().slice(0, 10) : ''; };
const whatsapp = (phone: string) => { const digits = phone.replace(/\D/g, ''); return digits.length === 10 ? `91${digits}` : digits; };

/** Lead detail sheet: contact summary, status, follow-up note and site visit (PUT /realestate/realtor/leads/:id). */
export function LeadSheet({ lead, onClose, onSaved }: { lead: Data | null; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState('unlocked');
  const [note, setNote] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = String(lead?._id || lead?.id || '');

  // Reset the form each time a different lead is opened.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!lead) return; setStatus(String(lead.status || 'unlocked')); setNote(''); setVisitDate(dateOnly(lead.siteVisit?.scheduledDate)); setVisitNotes(String(lead.siteVisit?.notes || '')); setError(''); }, [lead]);

  async function save() {
    if (visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) { setError('Enter the site visit date as YYYY-MM-DD, for example 2026-11-22.'); return; }
    if (visitDate && Number.isNaN(new Date(`${visitDate}T10:00:00`).getTime())) { setError('That site visit date is not valid.'); return; }
    setBusy(true); setError('');
    try {
      const body: Record<string, unknown> = { status, siteVisit: { scheduledDate: visitDate ? new Date(`${visitDate}T10:00:00`).toISOString() : null, notes: visitNotes.trim() } };
      if (note.trim()) body.note = note.trim().slice(0, 1000);
      await realtorApi.updateLead(id, body);
      onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this lead.'); }
    finally { setBusy(false); }
  }

  const phone = String(lead?.customerPhone || '');
  const email = String(lead?.customerEmail || '');
  const history: Data[] = Array.isArray(lead?.notes) ? lead!.notes : [];
  return <BottomSheet visible={!!lead} onClose={onClose} title={String(lead?.customerName || 'Buyer lead')} tall>
    {lead ? <>
      <View style={s.summary}>
        <Text style={s.listing}>{String(lead.listing?.title || 'Listing')}</Text>
        {phone ? <View style={s.row}><Icon name="phone" size={18} color={palette.green} /><Text style={s.rowText}>{phone}</Text></View> : null}
        {email ? <View style={s.row}><Icon name="mail" size={18} color="#667085" /><Text style={[s.rowText, { fontWeight: '500' }]}>{email}</Text></View> : null}
        {lead.source ? <Text style={s.source}>SOURCE: {humanize(lead.source).toUpperCase()}</Text> : null}
      </View>
      {phone ? <View style={s.contactRow}>
        <PillButton title="Call" icon="phone" grow onPress={() => void Linking.openURL(`tel:${phone}`).catch(() => setError('Could not open the phone dialer.'))} />
        <PillButton title="WhatsApp" icon="message" variant="soft" grow onPress={() => void Linking.openURL(`https://wa.me/${whatsapp(phone)}`).catch(() => setError('Could not open WhatsApp.'))} />
      </View> : null}
      <SelectField label="Status" value={status} options={toOptions(LEAD_STATUS_OPTIONS)} onChange={setStatus} />
      {history.length ? <View style={s.history}><Text style={s.historyTitle}>Previous notes</Text>{history.slice(-3).map((entry, index) => <Text key={index} style={s.historyText}>• {String(entry.text || entry.note || entry)}</Text>)}</View> : null}
      <FormField label="Add a note" value={note} onChangeText={setNote} multiline placeholder="Called, discussed budget…" maxLength={1000} />
      <FormField label="Site visit date" value={visitDate} onChangeText={setVisitDate} placeholder="YYYY-MM-DD" keyboardType="numeric" helper="Leave empty if no visit is planned." />
      <FormField label="Site visit notes" value={visitNotes} onChangeText={setVisitNotes} placeholder="Meet at the gate" maxLength={1000} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={{ alignSelf: 'flex-start' }}><PillButton title="Save Changes" onPress={() => void save()} loading={busy} /></View>
    </> : null}
  </BottomSheet>;
}

const s = StyleSheet.create({
  summary: { backgroundColor: '#f4f7fa', borderRadius: 22, padding: 16, gap: 9 }, listing: { color: palette.ink, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, rowText: { color: '#0f3b2e', fontSize: 16, fontWeight: '700' }, source: { color: '#8a97a6', fontSize: 12, fontWeight: '800', letterSpacing: 0.9 },
  contactRow: { flexDirection: 'row', gap: 10 }, history: { gap: 4, backgroundColor: palette.bg, borderRadius: 16, padding: 12 }, historyTitle: { color: '#33463f', fontSize: 13, fontWeight: '800' }, historyText: { color: palette.body, fontSize: 13, lineHeight: 19 },
  error: { color: palette.red, fontSize: 13, fontWeight: '700', lineHeight: 19 },
});
