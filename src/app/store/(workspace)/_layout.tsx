import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Stack, usePathname } from 'expo-router';
import { StoreHeader } from '../../../components/marketplace/StoreHeader';
import { StoreTabBar } from '../../../components/marketplace/StoreTabBar';
import { STORE_TABS, activeTabKey, permissionForPath } from '../../../components/marketplace/storeNav';
import { Screen, palette } from '../../../components/ui';
import { StoreSessionProvider, useStoreSession } from '../../../hooks/useStoreSession';
import { ROLE_LABELS } from '../../../lib/marketplace/constants';
import { homeRouteFor } from '../../../lib/marketplace/permissions';

/** Everything after sign-in: gates on the store session, then keeps one header and tab bar on every page. */
export default function WorkspaceLayout() {
  return <StoreSessionProvider><WorkspaceShell /></StoreSessionProvider>;
}

function WorkspaceShell() {
  const session = useStoreSession();
  const pathname = usePathname();
  const needed = permissionForPath(pathname);
  const allowed = !needed || session.can(needed);

  // A role that cannot open this page (e.g. inventory staff on Overview) is sent to its own home screen.
  useEffect(() => { if (session.phase === 'ready' && !allowed) router.replace(homeRouteFor(session.role) as never); }, [session.phase, allowed, session.role]);

  if (session.phase === 'error') return <Screen standalone title="Your store" error={session.error} onRetry={() => void session.refresh()} onBack={() => router.replace('/' as never)} />;
  if (session.phase !== 'ready' || !allowed) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}><ActivityIndicator color={palette.green} /></View>;

  const tabs = STORE_TABS.filter(tab => tab.visibleTo(session.role));
  return <View style={{ flex: 1, backgroundColor: palette.bg }}>
    <StoreHeader storeName={session.merchant?.storeName ?? 'Your store'} roleLabel={ROLE_LABELS[session.role ?? 'owner']}
      onAdd={session.can('catalog') ? () => router.push('/store/product/new' as never) : undefined} onMenu={() => router.push('/store/more' as never)} />
    <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: palette.bg } }} /></View>
    <StoreTabBar tabs={tabs} activeKey={activeTabKey(pathname)} onSelect={tab => router.replace(tab.href as never)} />
  </View>;
}
