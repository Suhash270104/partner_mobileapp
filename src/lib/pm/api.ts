import { partnerApi } from '../partnerApi';

// Typed client for the project-management (PM) API: /api/execution/projects/:id/pm/...
// Amounts that arrive are integer paise (…Paise); amounts that are sent are rupees. Dates are ISO strings.

export type ProjectRole = 'owner' | 'manager' | 'designer' | 'supervisor' | 'accounts' | 'client';
export type ExecutionStage = 'planning' | 'designing' | 'execution' | 'installation' | 'handover' | 'closed' | 'on_hold' | 'cancelled';
export type Health = 'on_track' | 'at_risk' | 'delayed';
export type ActivityStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';

export interface AttentionItem { mandatory: boolean; severity: 'high' | 'medium' | 'low'; type: string; target: string; title: string; entityId?: string; waitingDays?: number }

export interface PmOverview {
  success: boolean;
  started: boolean;
  role: ProjectRole;
  execution?: { stage: ExecutionStage; health?: Health; progressPct?: number; plannedPct?: number; baselineEnd?: string | null; projectedEnd?: string | null; handoverRequestedAt?: string | null; handoverAt?: string | null };
  attention?: AttentionItem[];
  project?: { title?: string; clientName?: string; location?: string; propertyType?: string; budgetRange?: string };
  inProgress?: { _id: string; name: string; ownerName?: string; progressPct: number; plannedEnd?: string | null }[];
  latest?: { at: string; text: string }[];
  team?: { name: string; role: string; userId?: string }[];
  money?: { contractValuePaise: number; receivedPaise: number } | null;
}

export interface PmTemplate { key: string; label: string; scopes: number; activities: number }
export interface PlanScope { _id: string; name: string; order: number }
export interface PlanActivity {
  _id: string; scopeId: string; name: string; order?: number;
  plannedStart?: string | null; plannedEnd?: string | null; actualStart?: string | null; actualEnd?: string | null;
  progressPct: number; status: ActivityStatus; isMilestone?: boolean; forecastEnd?: string | null;
  ownerName?: string; vendorName?: string; notes?: string; clientVisible?: boolean; isCritical?: boolean; isOverdue?: boolean;
}
export interface PmPlan { success: boolean; scopes: PlanScope[]; activities: PlanActivity[]; baselineEnd?: string | null; projectedEnd?: string | null; criticalCount?: number }

export type MilestoneStatus = 'planned' | 'due' | 'confirmed' | 'cancelled';
export interface Milestone {
  _id: string; name: string; order?: number; percent?: number | null; amountPaise: number; dueDate?: string | null; trigger?: string;
  status: MilestoneStatus; confirmedAt?: string | null; receivedPaise: number; awaitingConfirmationPaise: number; balancePaise: number; isOverdue?: boolean;
}
export type PaymentStatus = 'client_marked' | 'confirmed' | 'disputed' | 'rejected';
export interface Payment { _id: string; milestoneId: string; amountPaise: number; method: string; reference?: string; paidOn?: string | null; status: PaymentStatus; confirmedAt?: string | null; disputeReason?: string }
export interface PmMoney {
  success: boolean; contractValuePaise: number;
  summary: { scheduledPaise: number; receivedPaise: number; awaitingConfirmationPaise: number; dueNowPaise: number; overduePaise: number };
  milestones: Milestone[]; payments: Payment[];
}

export type ChangeStatus = 'requested' | 'submitted' | 'approved' | 'rejected' | 'withdrawn';
export interface ChangeRequest {
  _id: string; number?: number; title: string; description?: string; raisedByRole?: string; costDeltaPaise?: number | null; timeDeltaDays?: number | null;
  status: ChangeStatus; decidedAt?: string | null; decisionNote?: string; createdAt?: string;
}

const base = (id: string) => `/execution/projects/${encodeURIComponent(id)}/pm`;
const call = partnerApi.call;

export const pmApi = {
  templates: () => call<{ templates: PmTemplate[] }>('/execution/pm/templates'),
  overview: (id: string) => call<PmOverview>(base(id)),
  start: (id: string, body: { templateKey: string; startDate: string; handoverDate?: string; contractValue?: number }) => call(`${base(id)}/start`, 'POST', body),
  setStage: (id: string, stage: ExecutionStage, reason?: string) => call(`${base(id)}/stage`, 'PATCH', { stage, reason }),
  requestHandover: (id: string) => call(`${base(id)}/handover/request`, 'POST'),

  plan: (id: string) => call<PmPlan>(`${base(id)}/plan`),
  addScope: (id: string, name: string) => call<{ scope: PlanScope }>(`${base(id)}/scopes`, 'POST', { name }),
  addActivity: (id: string, body: { scopeId: string; name: string; plannedStart?: string; plannedEnd?: string; ownerName?: string; clientVisible?: boolean }) => call<{ activity: PlanActivity }>(`${base(id)}/activities`, 'POST', body),
  patchActivity: (id: string, activityId: string, body: Record<string, unknown>) => call<{ activity: PlanActivity }>(`${base(id)}/activities/${activityId}`, 'PATCH', body),
  progress: (id: string, activityId: string, body: { progressPct: number; remark?: string }) => call<{ activity: PlanActivity }>(`${base(id)}/activities/${activityId}/progress`, 'POST', body),
  setVisibility: (id: string, type: 'task' | 'progress' | 'document' | 'activity', itemId: string, clientVisible: boolean) => call(`${base(id)}/visibility`, 'PATCH', { type, id: itemId, clientVisible }),

  money: (id: string) => call<PmMoney>(`${base(id)}/money`),
  addMilestone: (id: string, body: { name: string; amount: number; dueDate?: string }) => call<{ milestone: Milestone }>(`${base(id)}/milestones`, 'POST', body),
  cancelMilestone: (id: string, milestoneId: string) => call(`${base(id)}/milestones/${milestoneId}`, 'DELETE'),
  // One idempotency key per logical payment: pass the same key when retrying the same receipt.
  recordPayment: (id: string, milestoneId: string, key: string, body: { amount: number; method: string; reference?: string; paidOn?: string; note?: string }) =>
    call<{ payment: Payment; duplicate: boolean }>(`${base(id)}/milestones/${milestoneId}/payments`, 'POST', body, { 'Idempotency-Key': key }),
  confirmPayment: (id: string, paymentId: string) => call(`${base(id)}/payments/${paymentId}/confirm`, 'POST'),
  disputePayment: (id: string, paymentId: string, reason: string) => call(`${base(id)}/payments/${paymentId}/dispute`, 'POST', { reason }),
  rejectPayment: (id: string, paymentId: string, reason: string) => call(`${base(id)}/payments/${paymentId}/reject`, 'POST', { reason }),

  changes: (id: string) => call<{ changes: ChangeRequest[] }>(`${base(id)}/changes`),
  raiseChange: (id: string, body: { title: string; description?: string; costDelta?: number; timeDeltaDays?: number }) => call<{ change: ChangeRequest }>(`${base(id)}/changes`, 'POST', body),
  priceChange: (id: string, changeId: string, body: { costDelta: number; timeDeltaDays: number; note?: string }) => call(`${base(id)}/changes/${changeId}/price`, 'POST', body),
  decideChange: (id: string, changeId: string, decision: 'approve' | 'reject', note?: string) => call(`${base(id)}/changes/${changeId}/decision`, 'POST', { decision, note }),
  withdrawChange: (id: string, changeId: string) => call(`${base(id)}/changes/${changeId}/withdraw`, 'POST'),
};

/** Roles that may see or change money. The server enforces it; this only decides which controls to show. */
export const canSeeMoney = (role?: ProjectRole) => role === 'owner' || role === 'manager' || role === 'accounts';
export const canEditPlan = (role?: ProjectRole) => role === 'owner' || role === 'manager' || role === 'designer' || role === 'supervisor';
