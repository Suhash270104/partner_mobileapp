import type { Permission } from '../../lib/marketplace/permissions';
import type { StoreRole } from '../../lib/marketplace/types';

export type StoreTab = { key: string; label: string; icon: string; href: string; visibleTo: (role: StoreRole | null) => boolean };

const sales = (role: StoreRole | null) => role === 'owner' || role === 'manager';
const catalog = (role: StoreRole | null) => sales(role) || role === 'inventory';

/** Bottom tabs in order. Tabs a role cannot use are hidden (hand-off §2, §12). */
export const STORE_TABS: StoreTab[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', href: '/store', visibleTo: sales },
  { key: 'leads', label: 'Leads', icon: 'users', href: '/store/leads', visibleTo: sales },
  { key: 'products', label: 'Products', icon: 'layers', href: '/store/products', visibleTo: catalog },
  { key: 'orders', label: 'Orders', icon: 'clipboard', href: '/store/orders', visibleTo: role => role === 'fulfillment' },
  { key: 'reviews', label: 'Reviews', icon: 'star', href: '/store/reviews', visibleTo: sales },
  { key: 'more', label: 'More', icon: 'more', href: '/store/more', visibleTo: () => true },
];

/** Which tab stays highlighted for a pathname, including detail screens that belong to a tab. */
export function activeTabKey(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/store' || path === '/') return 'overview';
  const segment = path.split('/')[2] ?? '';
  const map: Record<string, string> = { leads: 'leads', lead: 'leads', products: 'products', product: 'products', orders: 'orders', returns: 'orders', reviews: 'reviews' };
  return map[segment] ?? 'more';
}

/** The permission a path requires, or null when any signed-in staff member may open it. */
export function permissionForPath(pathname: string): Permission | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/store' || path === '/') return 'sales';
  const segment = path.split('/')[2] ?? '';
  const map: Record<string, Permission> = {
    leads: 'sales', lead: 'sales', reviews: 'sales', analytics: 'sales', questions: 'sales',
    products: 'catalog', product: 'catalog', orders: 'orders', returns: 'orders', staff: 'staff',
  };
  return map[segment] ?? null;
}
