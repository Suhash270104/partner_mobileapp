import { Image, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Badge, NavCard, PillButton, Screen, Text, palette } from '../../../components/ui';
import { useAction, confirmAction } from '../../../hooks/useAction';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useStoreSession } from '../../../hooks/useStoreSession';
import { merchantApi } from '../../../lib/marketplace/api';
import { ROLE_LABELS, SUPPORT } from '../../../lib/marketplace/constants';
import type { Store } from '../../../lib/marketplace/types';

interface MoreData { store: Store | null; legacyOrders: number }

export default function MoreScreen() {
  const { merchant, role, can, signOut } = useStoreSession();
  const { run, isBusy } = useAction();
  const { data, refreshing, refresh } = useAsyncData<MoreData>(async () => {
    const [store, metrics] = await Promise.allSettled([merchantApi.store(), can('sales') ? merchantApi.metrics() : Promise.reject(new Error('skip'))]);
    return { store: store.status === 'fulfilled' ? store.value : null, legacyOrders: metrics.status === 'fulfilled' ? metrics.value.orderTabs?.ALL ?? 0 : 0 };
  }, [role]);

  const store = data?.store;
  const city = [store?.address?.city, store?.address?.state].filter(Boolean).join(', ');
  // Checkout is retired, so Orders only appears for stores that still hold older orders (or for fulfilment staff).
  const showOrders = can('orders') && (role === 'fulfillment' || (data?.legacyOrders ?? 0) > 0);
  const marketplaceUrl = SUPPORT.siteUrl ? `${SUPPORT.siteUrl}/marketplace` : '';

  const confirmSignOut = async () => {
    if (await confirmAction('Sign out of your store?', 'You will need to sign in again to manage it.', 'Sign out')) void run('signout', signOut, { fallback: 'Could not sign out. Please try again.' });
  };

  return <Screen title="More" refreshing={refreshing} onRefresh={() => void refresh()}>
    <View style={s.card}>
      {store?.logoUrl ? <Image source={{ uri: store.logoUrl }} style={s.logo} /> : <Avatar label={merchant?.storeName ?? 'Store'} size={60} />}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.name} numberOfLines={2}>{merchant?.storeName}</Text>
        {city ? <Text style={s.city}>{city}</Text> : null}
        <View style={{ flexDirection: 'row' }}><Badge label={ROLE_LABELS[role ?? 'owner']} tone="green" /></View>
      </View>
    </View>

    <View style={{ gap: 10 }}>
      {can('sales') ? <NavCard icon="barChart" tone="blue" title="Analytics & reports" detail="Sales, order volume and top products" onPress={() => router.push('/store/analytics' as never)} /> : null}
      {can('sales') ? <NavCard icon="fileText" tone="violet" title="Enquiry form" detail="Questions buyers answer when they enquire" onPress={() => router.push('/store/questions' as never)} /> : null}
      {showOrders ? <NavCard icon="clipboard" tone="amber" title="Orders & fulfilment" detail="Earlier orders and returns" onPress={() => router.push('/store/orders' as never)} /> : null}
      <NavCard icon="settings" tone="green" title="Store settings" detail={can('settingsEdit') ? 'Profile, hours, alerts and payout' : 'View your store details'} onPress={() => router.push('/store/settings' as never)} />
      {can('staff') ? <NavCard icon="users" tone="blue" title="Team & roles" detail="Invite staff and manage access" onPress={() => router.push('/store/staff' as never)} /> : null}
      {marketplaceUrl ? <NavCard icon="externalLink" tone="green" title="Browse marketplace" detail="See how buyers see your store" onPress={() => void Linking.openURL(marketplaceUrl)} /> : null}
    </View>
    <PillButton title="Sign out of store" icon="logOut" variant="danger" loading={isBusy('signout')} onPress={() => void confirmSignOut()} />
  </Screen>;
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line },
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: palette.greenSoft }, name: { color: palette.ink, fontSize: 18, fontWeight: '800' }, city: { color: palette.body, fontSize: 13 },
});
