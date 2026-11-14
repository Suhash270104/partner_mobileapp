import { Redirect, useLocalSearchParams } from 'expo-router';

// Kept so older deep links and notifications (/store/dashboard?tab=leads) still land in the right place.
const TAB_ROUTES: Record<string, string> = { overview: '/store', leads: '/store/leads', products: '/store/products', orders: '/store/orders', reviews: '/store/reviews', settings: '/store/settings', more: '/store/more' };

export default function StoreDashboardRedirect() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <Redirect href={(TAB_ROUTES[String(tab)] ?? '/store') as never} />;
}
