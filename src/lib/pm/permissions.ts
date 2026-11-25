import type { ProjectRole } from './api';

// Mirror of backend/services/pm/permissions.js. It only decides which controls to SHOW; the server still
// enforces every action and answers 403 when a role may not do something. Keep the two lists in step.
const INTERNAL_READ = ['project.view', 'plan.view', 'decision.view'];
const PERMISSIONS: Record<ProjectRole, string[]> = {
  owner: ['*'],
  manager: [...INTERNAL_READ, 'plan.edit', 'plan.progress', 'money.view', 'milestone.edit', 'change.raise', 'change.price', 'visibility.edit', 'decision.add', 'handover.request', 'stage.edit',
    'invoice.view', 'invoice.manage', 'expense.view', 'expense.add', 'expense.manage', 'delay.manage', 'risk.manage', 'qc.manage', 'selection.manage', 'note.manage', 'manpower.manage',
    'snag.manage', 'warranty.manage', 'service.manage', 'weekly.manage'],
  designer: [...INTERNAL_READ, 'plan.progress', 'visibility.edit', 'selection.manage', 'note.manage'],
  supervisor: [...INTERNAL_READ, 'plan.progress', 'expense.add', 'delay.manage', 'qc.manage', 'manpower.manage', 'snag.manage'],
  accounts: [...INTERNAL_READ, 'money.view', 'milestone.edit', 'payment.record', 'payment.confirm', 'invoice.view', 'invoice.manage', 'expense.view', 'expense.add', 'expense.manage'],
  client: ['project.view', 'plan.view', 'decision.view', 'money.view', 'invoice.view', 'payment.mark', 'change.raise', 'change.decide', 'handover.signoff', 'selection.choose', 'snag.raise', 'snag.verify', 'service.raise', 'delay.ack'],
};

export const can = (role: ProjectRole | undefined, action: string): boolean => {
  if (!role) return false;
  const list = PERMISSIONS[role];
  return !!list && (list.includes('*') || list.includes(action));
};
