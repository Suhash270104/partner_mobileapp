import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { BooleanField, Field, PageHeading, Panel, PrimaryButton, SecondaryButton, SelectChips, StatePanel, palette } from '../../components/vertical/VerticalUi';
import { Text } from '../../components/AppText';
import { Row, SellerFrame } from '../../components/vertical/SellerParts';
import { merchantApi } from '../../lib/partnerVerticalApi';

const TYPES = ['text', 'textarea', 'number', 'select', 'date'];
type Q = { label: string; type: string; options: string; required: boolean };

export default function QuestionsEditor() {
  const [qs, setQs] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await merchantApi.enquiryQuestions(); setQs(((r.questions as Row[]) || []).map(q => ({ label: String(q.label || ''), type: String(q.type || 'text'), options: (q.options || []).join(', '), required: Boolean(q.required) }))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load questions.'); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const patch = (i: number, p: Partial<Q>) => { setSaved(false); setQs(cur => cur.map((q, n) => (n === i ? { ...q, ...p } : q))); };
  const move = (i: number, d: number) => { setSaved(false); setQs(cur => { const j = i + d; if (j < 0 || j >= cur.length) return cur; const next = [...cur]; [next[i], next[j]] = [next[j], next[i]]; return next; }); };
  const save = async () => {
    const out = [];
    for (const q of qs) {
      const options = q.options.split(',').map(o => o.trim()).filter(Boolean);
      if (q.label.trim().length < 2) { Alert.alert('Question text needed', 'Each question needs at least 2 characters.'); return; }
      if (q.type === 'select' && options.length < 2) { Alert.alert('Options needed', `"${q.label}" is a dropdown and needs at least 2 options.`); return; }
      out.push({ label: q.label.trim(), type: q.type, options: q.type === 'select' ? options : [], required: q.required });
    }
    setBusy(true); setError('');
    try { await merchantApi.saveEnquiryQuestions(out); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save questions.'); }
    finally { setBusy(false); }
  };
  return <SellerFrame title="Enquiry questions" subtitle="Buyer enquiry form" activeTab="settings">
    <PageHeading eyebrow="SELLER WORKSPACE" title="Enquiry form" subtitle="Reorder, remove or require the questions buyers answer (up to 15)." />
    {error ? <StatePanel title="Something went wrong" message={error} retry={() => void load()} /> : null}
    {saved ? <Panel tint><Text style={{ color: palette.green, fontWeight: '800' }}>Enquiry form saved.</Text></Panel> : null}
    {loading ? <Panel><Text style={{ color: palette.body }}>Loading…</Text></Panel> : qs.length === 0 ? <StatePanel title="No questions yet" message="Add a question to collect details from buyers." /> : null}
    {qs.map((q, i) => <Panel key={i}>
      <Field label={`Question ${i + 1}`} value={q.label} onChangeText={v => patch(i, { label: v })} />
      <SelectChips label="Answer type" values={TYPES} selected={q.type} onChange={v => patch(i, { type: String(v) })} />
      {q.type === 'select' ? <Field label="Dropdown options (comma separated)" value={q.options} onChangeText={v => patch(i, { options: v })} /> : null}
      <BooleanField label="Required" value={q.required} onChange={v => patch(i, { required: v })} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><SecondaryButton title="Move up" onPress={() => move(i, -1)} /></View><View style={{ flex: 1 }}><SecondaryButton title="Move down" onPress={() => move(i, 1)} /></View>
        <View style={{ flex: 1 }}><SecondaryButton title="Remove" onPress={() => { setSaved(false); setQs(cur => cur.filter((_, n) => n !== i)); }} /></View>
      </View>
    </Panel>)}
    {qs.length < 15 ? <SecondaryButton title="Add a question" onPress={() => { setSaved(false); setQs(cur => [...cur, { label: '', type: 'text', options: '', required: false }]); }} /> : null}
    <PrimaryButton title="Save enquiry form" loading={busy} onPress={() => void save()} />
  </SellerFrame>;
}
