import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LeadContactCard } from '../../../../components/marketplace/lead/LeadContactCard';
import { LeadRequestCard } from '../../../../components/marketplace/lead/LeadRequestCard';
import { QuotationCard } from '../../../../components/marketplace/lead/QuotationCard';
import { QuotationFormSheet } from '../../../../components/marketplace/lead/QuotationFormSheet';
import { StatusBadge } from '../../../../components/marketplace/StatusBadge';
import { AlertBanner, EmptyState, FormField, PillButton, Screen, SectionCard, SelectField, StickyActionBar } from '../../../../components/ui';
import { useAction } from '../../../../hooks/useAction';
import { useAsyncData } from '../../../../hooks/useAsyncData';
import { merchantApi } from '../../../../lib/marketplace/api';
import { LEAD_STATUS_OPTIONS, LIMITS } from '../../../../lib/marketplace/constants';
import type { Json, Lead } from '../../../../lib/marketplace/types';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { run, isBusy } = useAction();
  const loaded = useAsyncData(() => merchantApi.findLead(String(id)), [id], { errorText: 'Could not load this enquiry.' });
  // `override` holds the lead after a write; until then the loaded lead is shown. `noteDraft` is the note being typed.
  const [override, setOverride] = useState<Lead | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const lead = override ?? loaded.data ?? null;
  const note = noteDraft ?? lead?.merchantNote ?? '';
  const [quoting, setQuoting] = useState(false);
  const [notice, setNotice] = useState('');

  // The server returns the updated lead for most writes; fall back to a reload when it does not.
  const apply = async (updated?: Lead) => { const next = updated ?? await merchantApi.findLead(String(id)); if (next) { setOverride(next); setNoteDraft(null); } };

  const changeStatus = (status: string) => void run('status', async () => { await apply(await merchantApi.updateLead(String(id), { status })); setNotice('Status updated.'); });
  const saveNote = () => void run('note', async () => { await apply(await merchantApi.updateLead(String(id), { merchantNote: note.trim() })); setNotice('Note saved.'); });
  const sendQuote = async (payload: Json) => { await apply(await merchantApi.sendQuotation(String(id), payload)); setNotice('Quotation sent to the buyer.'); };

  if (!lead) return <Screen title="Enquiry" onBack={() => router.back()} loading={loaded.loading} error={loaded.error || (!loaded.loading && !loaded.data ? 'This enquiry could not be found. It may have been removed.' : '')} onRetry={() => void loaded.reload()} />;

  const quotes = [...(lead.quotations ?? [])].reverse();
  const won = lead.status === 'won';
  return <Screen title={lead.buyerName || 'Enquiry'} subtitle={lead.productId?.title || lead.requirementTitle} onBack={() => router.back()} action={<StatusBadge status={lead.status} />}
    footer={won ? undefined : <StickyActionBar actions={[{ title: quotes.length ? 'Send revised quotation' : 'Send quotation', icon: 'send', onPress: () => setQuoting(true) }]} />}>
    {notice ? <AlertBanner tone="green" icon="check" title={notice} /> : null}
    {won ? <AlertBanner tone="green" icon="award" title="The buyer accepted your quotation" message="This enquiry is won. Follow up with the buyer to complete the supply." /> : null}
    <LeadContactCard lead={lead} />
    <LeadRequestCard lead={lead} />

    <SectionCard title={`Quotations · ${quotes.length}`}>
      {quotes.length ? quotes.map((quote, index) => <QuotationCard key={quote._id ?? index} quote={quote} />)
        : <EmptyState icon="fileText" title="No quotation sent yet" message="Send a price and terms so the buyer can accept or decline." />}
    </SectionCard>

    <SectionCard title="Status & private note" subtitle="The note is only visible to your team">
      <View style={{ gap: 14 }}>
        <SelectField label="Enquiry status" value={lead.status} options={LEAD_STATUS_OPTIONS} onChange={changeStatus} />
        <FormField label="Private note" value={note} onChangeText={setNoteDraft} multiline maxLength={LIMITS.noteLength} helper="Not shown to the buyer." />
        <PillButton title="Save note" variant="soft" loading={isBusy('note')} disabled={note.trim() === (lead.merchantNote ?? '')} onPress={saveNote} />
      </View>
    </SectionCard>

    <QuotationFormSheet visible={quoting} lead={lead} revising={quotes.length > 0} onClose={() => setQuoting(false)} onSend={sendQuote} />
  </Screen>;
}
