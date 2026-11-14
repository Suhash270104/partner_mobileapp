import type { StoreRole } from './types';

// Role matrix from hand-off §12. The server enforces it too (403 MERCHANT_ROLE_FORBIDDEN); the app
// only hides what a role cannot use.
export type Permission = 'sales' | 'catalog' | 'catalogDelete' | 'orders' | 'settingsEdit' | 'bank' | 'staff';

const MATRIX: Record<Permission, readonly StoreRole[]> = {
  sales: ['owner', 'manager'],
  catalog: ['owner', 'manager', 'inventory'],
  catalogDelete: ['owner', 'manager'],
  orders: ['owner', 'manager', 'fulfillment'],
  settingsEdit: ['owner', 'manager'],
  bank: ['owner'],
  staff: ['owner'],
};

export const can = (role: StoreRole | null | undefined, permission: Permission) => !!role && MATRIX[permission].includes(role);

/** First screen a role should land on, since fulfilment/inventory staff cannot open Overview. */
export function homeRouteFor(role: StoreRole | null | undefined): string {
  if (can(role, 'sales')) return '/store';
  if (can(role, 'catalog')) return '/store/products';
  if (can(role, 'orders')) return '/store/orders';
  return '/store/more';
}
