import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Body, FormSheet, Title, RowBetween, confirmAction, useRunner, usePmModule, wholeNumber } from '../../../../../components/pm/PmKit';
import { Alert, Btn, Card, Empty, HeaderAction, LONG_AGO, Muted, PmScreen, SectionTitle, isoFromField, shortDate, todayField } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { recordsApi } from '../../../../../lib/pm/records';

// Manpower: how many people each vendor had on site each day. One entry per vendor per day.
export default function ManpowerScreen() {
  const m = usePmModule(id => recordsApi.manpower(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [adding, setAdding] = useState(false);
  const manage = can(m.role, 'manpower.manage');
  const reports = useMemo(() => (m.payload?.reports || []).slice().sort((a, b) => b.date.localeCompare(a.date)), [m.payload]);
  const days = useMemo(() => {
    const byDay = new Map<string, typeof reports>();
    reports.forEach(report => { const key = report.date.slice(0, 10); byDay.set(key, [...(byDay.get(key) || []), report]); });
    return [...byDay.entries()];
  }, [reports]);

  return (
    <PmScreen title="Manpower" subtitle={m.payload ? `${m.payload.totalWorkers} worker-days logged` : undefined}
      right={manage ? <HeaderAction icon="plus" label="Log manpower" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {m.payload && reports.length === 0 && <Empty title="No manpower logged" text="Record who was on site each day, by vendor and trade." />}
      {days.map(([day, rows]) => (
        <View key={day} style={{ gap: 8 }}>
          <SectionTitle>{shortDate(day)} · {rows.reduce((n, r) => n + r.skilled + r.unskilled, 0)} people</SectionTitle>
          {rows.map(report => (
            <Card key={report._id}>
              <RowBetween><Title>{report.vendorName}{report.trade ? ` · ${report.trade}` : ''}</Title><Body>{report.skilled + report.unskilled}</Body></RowBetween>
              <Muted>{report.skilled} skilled · {report.unskilled} unskilled{report.coordinator ? ` · ${report.coordinator}` : ''}</Muted>
              {!!report.remark && <Body>{report.remark}</Body>}
              {manage && <Btn small kind="ghost" label="Delete" busy={busyId === report._id} onPress={() => confirmAction('Delete this entry?', `${report.vendorName}, ${shortDate(report.date)}`, 'Delete', () => void run(report._id, () => recordsApi.deleteManpower(m.id, report._id), 'Could not delete this entry.'))} />}
            </Card>
          ))}
        </View>
      ))}
      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addManpower(m.id, body); setAdding(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { date: string; vendorName: string; trade?: string; skilled: number; unskilled: number; remark?: string; clientVisible: boolean }) => Promise<void> }) {
  const [date, setDate] = useState(todayField()); const [vendor, setVendor] = useState(''); const [trade, setTrade] = useState(''); const [skilled, setSkilled] = useState(''); const [unskilled, setUnskilled] = useState(''); const [remark, setRemark] = useState('');
  return (
    <FormSheet visible={visible} title="Log manpower" eyebrow="SITE" submitLabel="Save entry" onClose={onClose} submit={async () => {
      const when = isoFromField(date);
      const sk = skilled.trim() ? wholeNumber(skilled) : 0; const un = unskilled.trim() ? wholeNumber(unskilled) : 0;
      if (!when) return 'Choose the date.';
      if (!vendor.trim()) return 'Enter the vendor or contractor.';
      if (sk === undefined || un === undefined || sk < 0 || un < 0 || sk > 1000 || un > 1000) return 'Counts must be whole numbers between 0 and 1000.';
      if (sk + un === 0) return 'Enter at least one worker.';
      await submit({ date: when, vendorName: vendor.trim(), skilled: sk, unskilled: un, clientVisible: true, ...(trade.trim() ? { trade: trade.trim() } : {}), ...(remark.trim() ? { remark: remark.trim() } : {}) });
      setVendor(''); setTrade(''); setSkilled(''); setUnskilled(''); setRemark('');
    }}>
      <DateField label="Date" value={date} onChange={setDate} minDate={LONG_AGO} />
      <Field label="Vendor / contractor" value={vendor} onChangeText={setVendor} placeholder="RK Electricals" maxLength={120} />
      <Field label="Trade (optional)" value={trade} onChangeText={setTrade} placeholder="Electrical" maxLength={60} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Skilled" value={skilled} onChangeText={setSkilled} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Unskilled" value={unskilled} onChangeText={setUnskilled} keyboardType="number-pad" /></View>
      </View>
      <Field label="Remark (optional)" value={remark} onChangeText={setRemark} maxLength={300} />
    </FormSheet>
  );
}
