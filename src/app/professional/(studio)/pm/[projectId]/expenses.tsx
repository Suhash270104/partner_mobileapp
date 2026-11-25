import { useState } from 'react';
import { View } from 'react-native';
import { Field } from '../../../../../components/professional/onboardingUi';
import { DateField } from '../../../../../components/studio/DateTimeFields';
import { Actions, Body, FormSheet, FieldLabel, Title, RowBetween, confirmAction, labelOf, optionsOf, rupees, useRunner, usePmModule } from '../../../../../components/pm/PmKit';
import { Alert, Bar, Btn, Card, Chips, Empty, HeaderAction, LONG_AGO, Muted, Pill, PmScreen, SectionTitle, Tone, inr, isoFromField, pm, shortDate, todayField } from '../../../../../components/pm/PmUi';
import { can } from '../../../../../lib/pm/permissions';
import { EXPENSE_CATEGORIES, recordsApi, type Expense } from '../../../../../lib/pm/records';

const STATUS: Record<Expense['status'], { label: string; tone: Tone }> = { submitted: { label: 'Awaiting approval', tone: 'warn' }, approved: { label: 'Approved', tone: 'ok' }, rejected: { label: 'Rejected', tone: 'bad' } };

// Expenses and budget vs actual. Internal to the studio: clients never see any of this.
export default function ExpensesScreen() {
  const m = usePmModule(id => recordsApi.expenses(id));
  const { run, busyId, error } = useRunner(m.silentReload);
  const [adding, setAdding] = useState(false);
  const [budgeting, setBudgeting] = useState(false);
  const [rejecting, setRejecting] = useState<Expense | null>(null);

  const data = m.payload;
  const summary = data?.summary;
  const margin = summary?.marginPct;

  return (
    <PmScreen title="Expenses" subtitle="Budget vs actual" right={can(m.role, 'expense.add') ? <HeaderAction icon="plus" label="Add expense" onPress={() => setAdding(true)} /> : undefined}
      loading={m.loading} error={m.error} refreshing={m.refreshing} onRefresh={() => void m.reload()}>
      {!!error && <Alert tone="bad" text={error} />}
      {summary && (
        <Card>
          <RowBetween><View><Muted>Spent (approved)</Muted><Title>{inr(summary.actualPaise)}</Title></View>
            <View style={{ alignItems: 'flex-end' }}><Muted>Budget</Muted><Title>{summary.budgetPaise ? inr(summary.budgetPaise) : 'Not set'}</Title></View></RowBetween>
          {summary.budgetPaise > 0 && <Bar pct={(summary.actualPaise / summary.budgetPaise) * 100} tone={summary.actualPaise > summary.budgetPaise ? 'bad' : 'ok'} />}
          {summary.pendingPaise > 0 && <Muted>{inr(summary.pendingPaise)} waiting for approval.</Muted>}
          {margin != null && <Muted>Margin {inr(summary.marginPaise)} ({margin}%) against the contract value.</Muted>}
          {can(m.role, 'expense.manage') && <Btn small kind="ghost" label="Set category budgets" onPress={() => setBudgeting(true)} />}
        </Card>
      )}
      {summary && summary.byCategory.some(c => c.budgetPaise || c.actualPaise) && (
        <>
          <SectionTitle>By category</SectionTitle>
          <Card>
            {summary.byCategory.filter(c => c.budgetPaise || c.actualPaise).map(c => (
              <View key={c.category} style={{ gap: 3, paddingVertical: 3 }}>
                <RowBetween><Body>{labelOf(c.category)}</Body><Muted>{inr(c.actualPaise)}{c.budgetPaise ? ` of ${inr(c.budgetPaise)}` : ''}</Muted></RowBetween>
                {c.budgetPaise > 0 && <Bar pct={(c.actualPaise / c.budgetPaise) * 100} tone={c.variancePaise < 0 ? 'bad' : 'ok'} />}
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>{data?.canApprove ? 'All expenses' : 'Your expenses'}</SectionTitle>
      {data && data.expenses.length === 0 && <Empty title="No expenses yet" text="Add material, labour and site costs as they happen so the margin stays honest." />}
      {(data?.expenses || []).map(expense => (
        <Card key={expense._id}>
          <RowBetween><View style={{ flex: 1 }}><Title>{expense.description}</Title><Muted>{[labelOf(expense.category), expense.vendorName, expense.incurredOn ? shortDate(expense.incurredOn) : ''].filter(Boolean).join(' · ')}</Muted></View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}><Title>{inr(expense.amountPaise)}</Title><Pill text={STATUS[expense.status]?.label || expense.status} tone={STATUS[expense.status]?.tone} /></View></RowBetween>
          {!!expense.decisionNote && <Muted>Note: {expense.decisionNote}</Muted>}
          {data?.canApprove && expense.status === 'submitted' && (
            <Actions>
              <View style={{ flex: 1 }}><Btn small kind="green" label="Approve" busy={busyId === expense._id} onPress={() => void run(expense._id, () => recordsApi.decideExpense(m.id, expense._id, 'approve'), 'Could not approve this expense.')} /></View>
              <View style={{ flex: 1 }}><Btn small kind="danger" label="Reject" disabled={!!busyId} onPress={() => setRejecting(expense)} /></View>
            </Actions>
          )}
          {expense.status === 'submitted' && (
            <Btn small kind="ghost" label="Delete" busy={busyId === `d${expense._id}`}
              onPress={() => confirmAction('Delete this expense?', expense.description, 'Delete', () => void run(`d${expense._id}`, () => recordsApi.deleteExpense(m.id, expense._id), 'Could not delete this expense.'))} />
          )}
        </Card>
      ))}

      <AddSheet visible={adding} onClose={() => setAdding(false)} submit={async body => { await recordsApi.addExpense(m.id, body); setAdding(false); await m.silentReload(); }} />
      <RejectSheet expense={rejecting} onClose={() => setRejecting(null)} submit={async note => { await recordsApi.decideExpense(m.id, rejecting!._id, 'reject', note); setRejecting(null); await m.silentReload(); }} />
      <BudgetSheet visible={budgeting} current={summary?.byCategory || []} onClose={() => setBudgeting(false)} submit={async lines => { await recordsApi.setBudget(m.id, lines); setBudgeting(false); await m.silentReload(); }} />
    </PmScreen>
  );
}

function AddSheet({ visible, onClose, submit }: { visible: boolean; onClose: () => void; submit: (b: { category: string; description: string; vendorName?: string; amount: number; incurredOn: string }) => Promise<void> }) {
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]); const [description, setDescription] = useState(''); const [vendor, setVendor] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(todayField());
  return (
    <FormSheet visible={visible} title="Add expense" eyebrow="EXPENSES" submitLabel="Save expense" onClose={onClose} submit={async () => {
      const value = rupees(amount);
      if (!description.trim()) return 'Describe what the money was spent on.';
      if (value === undefined || value <= 0) return 'Enter the amount in rupees.';
      const incurredOn = isoFromField(date);
      if (!incurredOn) return 'Choose the date of the expense.';
      await submit({ category, description: description.trim(), amount: value, incurredOn, ...(vendor.trim() ? { vendorName: vendor.trim() } : {}) });
      setDescription(''); setVendor(''); setAmount('');
    }}>
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <FieldLabel>Category</FieldLabel>
      <Chips value={category} onChange={setCategory} options={optionsOf(EXPENSE_CATEGORIES)} />
      <Field label="What was it for" value={description} onChangeText={setDescription} placeholder="Plywood for wardrobe carcass" maxLength={300} />
      <Field label="Vendor (optional)" value={vendor} onChangeText={setVendor} maxLength={120} />
      <DateField label="Date" value={date} onChange={setDate} minDate={LONG_AGO} />
    </FormSheet>
  );
}

function RejectSheet({ expense, onClose, submit }: { expense: Expense | null; onClose: () => void; submit: (note?: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  return (
    <FormSheet visible={!!expense} title={expense?.description || ''} eyebrow={expense ? `REJECT ${inr(expense.amountPaise)}` : ''} submitLabel="Reject expense" kind="danger" onClose={onClose} submit={async () => { await submit(note.trim() || undefined); setNote(''); }}>
      <Field label="Reason (optional)" value={note} onChangeText={setNote} multiline maxLength={300} />
    </FormSheet>
  );
}

function BudgetSheet({ visible, current, onClose, submit }: { visible: boolean; current: { category: string; budgetPaise: number }[]; onClose: () => void; submit: (lines: { category: string; amount: number }[]) => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState(false);
  if (visible && !seen) { setSeen(true); setValues(Object.fromEntries(current.map(c => [c.category, c.budgetPaise ? String(c.budgetPaise / 100) : '']))); }
  if (!visible && seen) setSeen(false);
  return (
    <FormSheet visible={visible} title="Category budgets" eyebrow="EXPENSES" submitLabel="Save budgets" onClose={onClose} submit={async () => {
      const lines: { category: string; amount: number }[] = [];
      for (const category of EXPENSE_CATEGORIES) {
        const text = values[category] || '';
        if (!text.trim()) continue;
        const amount = rupees(text);
        if (amount === undefined || amount < 0) return `Enter a valid budget for ${labelOf(category).toLowerCase()}.`;
        lines.push({ category, amount });
      }
      await submit(lines);
    }}>
      <Muted style={{ color: pm.muted }}>Amounts in rupees. Leave a category empty for no budget.</Muted>
      {EXPENSE_CATEGORIES.map(category => <Field key={category} label={labelOf(category)} value={values[category] || ''} onChangeText={text => setValues(prev => ({ ...prev, [category]: text }))} keyboardType="decimal-pad" />)}
    </FormSheet>
  );
}
