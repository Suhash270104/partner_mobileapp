import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import type * as NotificationsTypes from 'expo-notifications';
import { isExpoGo } from '../lib/runtime';
import { fontAssets } from '../theme/typography';

// Keep the splash up until the app fonts are ready so no screen flashes in the system font.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export { ErrorBoundary } from 'expo-router';

function usePartnerNotificationNavigation() {
  useEffect(() => {
    if (isExpoGo()) return;

    let active = true;
    let subscription: NotificationsTypes.EventSubscription | undefined;

    void import('expo-notifications').then((Notifications) => {
      if (!active) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const openOnboarding = (response: NotificationsTypes.NotificationResponse | null) => {
        const screen = response?.notification.request.content.data?.screen;
        if (screen === 'technician-setup') {
          router.push('/technician/setup');
          void Notifications.clearLastNotificationResponse();
        }
      };

      openOnboarding(Notifications.getLastNotificationResponse());
      subscription = Notifications.addNotificationResponseReceivedListener(openOnboarding);
    }).catch(error => console.warn('Could not initialize partner notifications.', error));

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);
}

export default function RootLayout() {
  usePartnerNotificationNavigation();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#f7faf8' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </View>
  );
}
