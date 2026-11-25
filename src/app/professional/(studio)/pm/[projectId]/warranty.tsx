import { useState } from 'react';
import { View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Actions, Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, labelOf, optionsOf, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Chips, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, SectionTitle, Tone, isoFromField, shortDate, todayField } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { PRIORITIES, recordsApi, type ServiceRequest } from '../../../../../lib/pm/records';

const STATUS: Record<ServiceRequest['status'], Tone> = { open: 'warn', in_progress: 'blue', resolved: 'ok', closed: 'gray' };
const isActive = (endsOn?: string | null) => !endsOn || new Date(endsOn).getTime() >= Date.now();

// Warranty items and the service requests raised against them. The service clock (SLA) starts when a request is raised.
export default function WarrantyScreen() {
  const m = usePmModule(id => recordsApi.warranty(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [addingWarranty, setAddingWarranty] = useState(false);
  const [addingRequest, setAddingRequest] = useState(false);
  const [resolving, setResolving] = useState<ServiceRequest | null>(null);
  const manageWarranty = can(m.role, 'warranty.manage');
  const raise = can(m.role, 'service.raise') || can(m.role, 'service.manage');
  const items = m.payload?.items || [];
  const requests = m.payload?.requests || [];
  const nameOf = (id?: string) => items.find(item => item._id === id)?.name;

  return (
    <PmScreen title="Warranty & service" subtitle={items.length ? `${items.filter(i => isActive(i.endsOn)).length} active warranties` : undefined}
      right={manageWarranty ? <HeaderAction icon="plus" label="Add warranty" onPress={() => setAddingWarranty(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      <SectionTitle>Warranty items</SectionTitle>
      {m.payload && items.length === 0 && <Empty title="No warranty items" text="Add what is covered, by whom, and until when." />}
      {items.map(item => (
        <Card key={item._id}>
          <RowBetween><Title>{item.name}</Title><Pill text={isActive(item.endsOn) ? 'Active' : 'Expired'} tone={isActive(item.endsOn) ? 'ok' : 'gray'} /></RowBetween>
          <Muted>{[item.vendorName, item.startsOn ? `from ${shortDate(item.startsOn)}` : '', item.endsOn ? `to ${shortDate(item.endsOn)}` : ''].filter(Boolean).join(' · ')}</Muted>
          {!!item.notes && <Body>{item.notes}</Body>}
          {manageWarranty && <Btn small kind="ghost" label="Delete" busy={busyId === item._id} onPress={() => confirmAction('Delete this warranty?', item.name, 'Delete', () => void run(item._id, () => recordsApi.deleteWarranty(m.id, item._id), 'Could not delete this warranty.'))} />}
        </Card>
      ))}

      <SectionTitle right={raise ? <Btn small kind="ghost" label="Raise a request" onPress={() => setAddingRequest(true)} /> : undefined}>Service requests</SectionTitle>
      {m.payload && requests.length === 0 && <Empty title="No service requests" />}
      {requests.map(request => (
        <Card key={request._id}>
          <RowBetween><Title>{request.issue}</Title><Pill text={labelOf(request.status)} tone={STATUS[request.status]} /></RowBetween>
          <Muted>{[nameOf(request.warrantyItemId), `${labelOf(request.priority)} priority`, request.slaDueAt && request.status !== 'resolved' && request.status !== 'closed' ? `reply by ${shortDate(request.slaDueAt)}` : ''].filter(Boolean).join(' · ')}</Muted>
          {!!request.resolution && <Body>Resolution: {request.resolution}</Body>}
          {can(m.role, 'service.manage') && (request.status === 'open' || request.status === 'in_progress') && (
            <Actions>
              {request.status === 'open' && <View style={{ flex: 1 }}><Btn small kind="ghost" label="Start work" busy={busyId === request._id} onPress={() => void run(request._id, () => recordsApi.updateService(m.id, request._id, { status: 'in_progress' }), 'Could not update this request.')} /></View>}
              <View style={{ flex: 1 }}><Btn small kind="green" label="Resolve" disabled={!!busyId} onPress={() => setResolving(request)} /></View>
            </Actions>
          )}
          {request.status === 'resolved' && can(m.role, 'service.manage') && <Btn small kind="ghost" label="Close request" busy={busyId === request._id} onPress={() => void run(request._id, () => recordsApi.updateService(m.id, request._id, { status: 'closed' }), 'Could not close this request.')} />}
        </Card>
      ))}

      <WarrantySheet visible={addingWarranty} onClose={() => setAddingWarranty(false)} submit={async body => { await recordsApi.addWarranty(m.id, body); setAddingWarranty(false); await m.silentReload(); }} />
      <RequestSheet visible={addingRequest} items={items.map(i => ({ key: i._id, label: i.name }))} onClose={() => setAddingRequest(false)} submit={async body => { await recordsApi.addService(m.id, body); setAddingRequest(false); await m.silentReload(); }} />
      <ResolveSheet request={resolving} onClose={() => setResolving(null)} submit={async resolution => { await recordsApi.updateService(m.id, resolving!._id, { status: 'resolved', resolution }); setResolving(null); await m.silentReload(); }} />
    </PmScreen>
  );
}

function WarrantySheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { name: string; vendorName?: string; startsOn: string; endsOn: string; notes?: string }) => Promise<void> }) {
  const [name, setName] = useState(''); const [vendor, setVendor] = useState(''); const [starts, setStarts] = useState(todayField()); const [ends, setEnds] = useState(''); const [notes, setNotes] = useState('');
  return (
    <FormSheet visible={visible} title="Add warranty" eyebrow="WARRANTY" submitLabel="Save warranty" onClose={onClose} submit={async () => {
      const startsOn = isoFromField(starts); const endsOn = isoFromField(ends);
      if (!name.trim()) return 'Say what is covered.';
      if (!startsOn || !endsOn) return 'Choose when the warranty starts and ends.';
      if (endsOn < startsOn) return 'The warranty cannot end before it starts.';
      await submit({ name: name.trim(), startsOn, endsOn, ...(vendor.trim() ? { vendorName: vendor.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) });
      setName(''); setVendor(''); setEnds(''); setNotes('');
    }}>
      <Field label="Covered item" value={name} onChangeText={setName} placeholder="Modular kitchen" maxLength={160} />
      <Field label="Vendor (optional)" value={vendor} onChangeText={setVendor} maxLength={120} />
      <DateField label="Starts" value={starts} onChange={setStarts} minDate={LONG_AGO} />
      <DateField label="Ends" value={ends} onChange={setEnds} minDate={LONG_AGO} />
      <Field label="Terms (optional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />
    </FormSheet>
  );
}

function RequestSheet({ visible, items, onClose, submit }: { visible: boolean; items: { key: string; label: string }[]; onClose: () => void; submit: (b: { warrantyItemId?: string; issue: string; priority: string }) => Promise<void> }) {
  const [issue, setIssue] = useState(''); const [priority, setPriority] = useState<string>('normal'); const [item, setItem] = useState('');
  return (
    <FormSheet visible={visible} title="Raise a service request" eyebrow="SERVICE" submitLabel="Send request" onClose={onClose} submit={async () => {
      if (!issue.trim()) return 'Describe the problem.';
      await submit({ issue: issue.trim(), priority, ...(item ? { warrantyItemId: item } : {}) });
      setIssue(''); setItem('');
    }}>
      {items.length > 0 && (<><FieldLabel>Which item</FieldLabel><Chips value={item} onChange={setItem} options={[{ key: '', label: 'Not sure' }, ...items]} /></>)}
      <Field label="What is wrong" value={issue} onChangeText={setIssue} multiline maxLength={600} />
      <FieldLabel>Priority</FieldLabel>
      <Chips value={priority} onChange={setPriority} options={optionsOf(PRIORITIES)} />
    </FormSheet>
  );
}

function ResolveSheet({ request, onClose, submit }: { request: ServiceRequest | null; onClose: () => void; submit: (resolution?: string) => Promise<void> }) {
  const [text, setText] = useState('');
  return (
    <FormSheet visible={!!request} title={request?.issue || ''} eyebrow="RESOLVE" submitLabel="Mark resolved" kind="green" onClose={onClose} submit={async () => { await submit(text.trim() || undefined); setText(''); }}>
      <Field label="What was done (optional)" value={text} onChangeText={setText} multiline maxLength={500} />
    </FormSheet>
  );
}
