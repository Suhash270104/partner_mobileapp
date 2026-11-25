import { partnerApi } from '../partnerApi';

// Record modules of the PM API (expenses, delays, quality, selections, notes, manpower, snags, warranty, reports, invoices,
// decisions, team). Request amounts are rupees; response amounts are integer paise. Types list only the fields the app shows.
const base = (id: string) => `/execution/projects/${encodeURIComponent(id)}/pm`;
const call = partnerApi.call;

// Option lists below mirror the backend validation enums (backend/validation/projectManagement and models/projectRecordModels.js).
// The server rejects anything else, so they are the only values the forms can offer.
export const EXPENSE_CATEGORIES = ['material', 'labour', 'transport', 'vendor', 'site', 'other'] as const;
export const DELAY_REASONS = ['client', 'vendor', 'material', 'weather', 'design', 'approval', 'site', 'other'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'upi', 'cheque', 'cash', 'online'] as const;
export const LEVELS = ['low', 'medium', 'high'] as const;
export const PRIORITIES = ['low', 'normal', 'high'] as const;
export const TEAM_ROLES = ['manager', 'designer', 'supervisor', 'accounts'] as const;

export interface Expense { _id: string; category: string; description: string; vendorName?: string; amountPaise: number; incurredOn?: string; status: 'submitted' | 'approved' | 'rejected'; decisionNote?: string }
export interface ExpenseSummary { budgetPaise: number; actualPaise: number; pendingPaise: number; contractValuePaise: number; marginPaise: number | null; marginPct: number | null; byCategory: { category: string; budgetPaise: number; actualPaise: number; variancePaise: number }[] }
export interface Delay { _id: string; reason: string; days: number; description?: string; activityId?: string; onCriticalPath?: boolean; clientVisible?: boolean; ackRequested?: boolean; ackAt?: string | null; createdAt?: string }
export interface Risk { _id: string; title: string; likelihood?: string; impact?: string; mitigation?: string; status: 'open' | 'mitigated' | 'closed' }
export interface QcItem { _id: string; text: string; required?: boolean; result: 'pending' | 'pass' | 'fail'; remark?: string }
export interface QcCheck { _id: string; title: string; status: string; items: QcItem[]; signedAt?: string | null; clientVisible?: boolean }
export interface SelectionOption { _id: string; label: string; note?: string; pricePaise?: number }
export interface Selection { _id: string; room?: string; category?: string; title: string; deadline?: string | null; status: 'draft' | 'shown' | 'chosen' | 'locked'; chosenOptionId?: string; chosenAt?: string | null; options: SelectionOption[] }
export interface ActionItem { text: string; assignee?: string; done?: boolean }
export interface Note { _id: string; title: string; type: 'note' | 'mom'; body?: string; heldOn?: string | null; attendees?: string[]; actionItems?: ActionItem[]; sharedWithClient?: boolean }
export interface Manpower { _id: string; date: string; vendorName: string; trade?: string; skilled: number; unskilled: number; coordinator?: string; remark?: string; clientVisible?: boolean }
export interface Snag { _id: string; number?: number; title: string; location?: string; status: 'open' | 'fixed' | 'verified' | 'reopened'; dueDate?: string | null; ownerName?: string; fixNote?: string; raisedByRole?: string }
export interface Warranty { _id: string; name: string; vendorName?: string; startsOn?: string | null; endsOn?: string | null; notes?: string }
export interface ServiceRequest { _id: string; warrantyItemId?: string; issue: string; priority: string; status: 'open' | 'in_progress' | 'resolved' | 'closed'; slaDueAt?: string | null; resolution?: string }
export interface WeeklySnapshot { progressPct: number; plannedPct: number; health: string; completed: string[]; inProgress: { name: string; progressPct: number }[]; next: string[]; decisions: string[]; delays: { reason: string; days: number; description?: string }[] }
export interface WeeklyReport { _id: string; weekStart: string; weekEnd: string; status?: 'draft' | 'sent'; note?: string; sentAt?: string | null; snapshot: WeeklySnapshot }
export interface Decision { _id: string; at?: string; title: string; note?: string; decidedByRole?: string; decidedByName?: string }
export interface InvoiceLine { description: string; hsnSac?: string; quantity: number; unit?: string; ratePaise: number; amountPaise: number; gstRate: number }
export interface Party { name?: string; gstin?: string; pan?: string; address?: string; state?: string }
export interface Invoice {
  _id: string; number: string; status: 'draft' | 'issued' | 'paid' | 'cancelled'; issueDate?: string | null; dueDate?: string | null; milestoneId?: string | null;
  supplier?: Party; recipient?: Party; placeOfSupply?: string; taxMode?: 'intra' | 'inter' | 'none'; lines: InvoiceLine[];
  totals: { subtotalPaise?: number; discountPaise?: number; taxPaise?: number; totalPaise: number }; notes?: string; terms?: string; bankDetails?: string; cancelReason?: string;
}
export interface InvoiceInput {
  number?: string; issueDate?: string; dueDate?: string | null; supplier?: Party; recipient?: Party; placeOfSupply?: string; taxMode?: 'intra' | 'inter' | 'none';
  lines: { description: string; hsnSac?: string; quantity: number; unit?: string; rate: number; gstRate: number }[]; discount?: number; notes?: string; terms?: string; bankDetails?: string;
}
export interface TeamMember { name: string; role: string; userId?: string; addedAt?: string }

export const recordsApi = {
  expenses: (id: string) => call<{ expenses: Expense[]; canApprove: boolean; summary?: ExpenseSummary }>(`${base(id)}/expenses`),
  addExpense: (id: string, body: { category: string; description: string; vendorName?: string; amount: number; incurredOn: string }) => call(`${base(id)}/expenses`, 'POST', body),
  decideExpense: (id: string, rid: string, decision: 'approve' | 'reject', note?: string) => call(`${base(id)}/expenses/${rid}/decision`, 'POST', { decision, note }),
  deleteExpense: (id: string, rid: string) => call(`${base(id)}/expenses/${rid}`, 'DELETE'),
  setBudget: (id: string, lines: { category: string; amount: number }[]) => call(`${base(id)}/budget`, 'PUT', { lines }),

  delays: (id: string) => call<{ delays: Delay[]; totalDays: number }>(`${base(id)}/delays`),
  addDelay: (id: string, body: { reason: string; days: number; description: string; onCriticalPath?: boolean; clientVisible?: boolean; ackRequested?: boolean }) => call(`${base(id)}/delays`, 'POST', body),
  deleteDelay: (id: string, rid: string) => call(`${base(id)}/delays/${rid}`, 'DELETE'),
  ackDelay: (id: string, rid: string) => call(`${base(id)}/delays/${rid}/ack`, 'POST'),
  risks: (id: string) => call<{ risks: Risk[] }>(`${base(id)}/risks`),
  addRisk: (id: string, body: { title: string; likelihood?: string; impact?: string; mitigation?: string }) => call(`${base(id)}/risks`, 'POST', body),
  setRiskStatus: (id: string, rid: string, status: Risk['status']) => call(`${base(id)}/risks/${rid}`, 'PATCH', { status }),

  qc: (id: string) => call<{ checks: QcCheck[] }>(`${base(id)}/qc`),
  addQc: (id: string, body: { title: string; items: { text: string; required: boolean }[]; clientVisible?: boolean }) => call(`${base(id)}/qc`, 'POST', body),
  qcResults: (id: string, rid: string, results: { itemId: string; result: string; remark?: string }[]) => call(`${base(id)}/qc/${rid}/results`, 'POST', { results }),
  signQc: (id: string, rid: string) => call(`${base(id)}/qc/${rid}/sign`, 'POST'),
  shareQc: (id: string, rid: string, clientVisible: boolean) => call(`${base(id)}/qc/${rid}/share`, 'POST', { clientVisible }),
  deleteQc: (id: string, rid: string) => call(`${base(id)}/qc/${rid}`, 'DELETE'),

  selections: (id: string) => call<{ selections: Selection[] }>(`${base(id)}/selections`),
  addSelection: (id: string, body: { room?: string; category: string; title: string; options: { label: string; note?: string; price?: number }[]; deadline?: string }) => call(`${base(id)}/selections`, 'POST', body),
  showSelection: (id: string, rid: string) => call(`${base(id)}/selections/${rid}`, 'PATCH', { status: 'shown' }),
  deleteSelection: (id: string, rid: string) => call(`${base(id)}/selections/${rid}`, 'DELETE'),
  chooseSelection: (id: string, rid: string, optionId: string) => call(`${base(id)}/selections/${rid}/choose`, 'POST', { optionId }),
  lockSelection: (id: string, rid: string) => call(`${base(id)}/selections/${rid}/lock`, 'POST'),

  notes: (id: string) => call<{ notes: Note[] }>(`${base(id)}/notes`),
  addNote: (id: string, body: { title: string; type: 'note' | 'mom'; body?: string; heldOn?: string; attendees?: string[]; actionItems?: ActionItem[]; sharedWithClient?: boolean }) => call(`${base(id)}/notes`, 'POST', body),
  deleteNote: (id: string, rid: string) => call(`${base(id)}/notes/${rid}`, 'DELETE'),
  noteTask: (id: string, rid: string, index: number) => call(`${base(id)}/notes/${rid}/action-items/${index}/task`, 'POST'),

  manpower: (id: string) => call<{ reports: Manpower[]; totalWorkers: number }>(`${base(id)}/manpower`),
  addManpower: (id: string, body: { date: string; vendorName: string; trade?: string; skilled: number; unskilled: number; remark?: string; clientVisible?: boolean }) => call(`${base(id)}/manpower`, 'POST', body),
  deleteManpower: (id: string, rid: string) => call(`${base(id)}/manpower/${rid}`, 'DELETE'),

  snags: (id: string) => call<{ snags: Snag[]; openCount: number }>(`${base(id)}/snags`),
  addSnag: (id: string, body: { title: string; location?: string; ownerName?: string; dueDate?: string }) => call(`${base(id)}/snags`, 'POST', body),
  fixSnag: (id: string, rid: string, note?: string) => call(`${base(id)}/snags/${rid}/fix`, 'POST', { note }),
  verifySnag: (id: string, rid: string) => call(`${base(id)}/snags/${rid}/verify`, 'POST'),
  reopenSnag: (id: string, rid: string, reason: string) => call(`${base(id)}/snags/${rid}/reopen`, 'POST', { reason }),
  deleteSnag: (id: string, rid: string) => call(`${base(id)}/snags/${rid}`, 'DELETE'),

  warranty: (id: string) => call<{ items: Warranty[]; requests: ServiceRequest[] }>(`${base(id)}/warranty`),
  addWarranty: (id: string, body: { name: string; vendorName?: string; startsOn: string; endsOn: string; notes?: string }) => call(`${base(id)}/warranty`, 'POST', body),
  deleteWarranty: (id: string, rid: string) => call(`${base(id)}/warranty/${rid}`, 'DELETE'),
  addService: (id: string, body: { warrantyItemId?: string; issue: string; priority: string }) => call(`${base(id)}/service-requests`, 'POST', body),
  updateService: (id: string, rid: string, body: { status: string; resolution?: string }) => call(`${base(id)}/service-requests/${rid}`, 'PATCH', body),

  weekly: (id: string) => call<{ reports: WeeklyReport[] }>(`${base(id)}/weekly-reports`),
  generateWeekly: (id: string) => call(`${base(id)}/weekly-reports/generate`, 'POST', {}),
  noteWeekly: (id: string, rid: string, note: string) => call(`${base(id)}/weekly-reports/${rid}`, 'PATCH', { note }),
  sendWeekly: (id: string, rid: string) => call(`${base(id)}/weekly-reports/${rid}/send`, 'POST'),
  deleteWeekly: (id: string, rid: string) => call(`${base(id)}/weekly-reports/${rid}`, 'DELETE'),

  decisions: (id: string) => call<{ decisions: Decision[] }>(`${base(id)}/decisions`),
  addDecision: (id: string, body: { title: string; note?: string }) => call(`${base(id)}/decisions`, 'POST', body),

  invoices: (id: string) => call<{ invoices: Invoice[]; summary: { issuedPaise: number; paidPaise: number; outstandingPaise: number }; defaults?: { number: string; supplier: Party; recipient: Party } }>(`${base(id)}/invoices`),
  addInvoice: (id: string, body: InvoiceInput) => call<{ invoice: Invoice }>(`${base(id)}/invoices`, 'POST', body),
  issueInvoice: (id: string, rid: string) => call(`${base(id)}/invoices/${rid}/issue`, 'POST'),
  payInvoice: (id: string, rid: string) => call(`${base(id)}/invoices/${rid}/paid`, 'POST', {}),
  cancelInvoice: (id: string, rid: string, reason: string) => call(`${base(id)}/invoices/${rid}/cancel`, 'POST', { reason }),
  deleteInvoice: (id: string, rid: string) => call(`${base(id)}/invoices/${rid}`, 'DELETE'),
  duplicateInvoice: (id: string, rid: string) => call(`${base(id)}/invoices/${rid}/duplicate`, 'POST'),

  inviteTeam: (id: string, email: string, role: string) => call<{ team: TeamMember[] }>(`${base(id)}/team/invite`, 'POST', { email, role }),
  setTeamRole: (id: string, userId: string, role: string | null) => call<{ team: TeamMember[] }>(`${base(id)}/team`, 'PUT', { userId, role }),
};
