import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function usePartnerNotificationNavigation() {
  useEffect(() => {
    const openOnboarding = (response: Notifications.NotificationResponse | null) => {
      const screen = response?.notification.request.content.data?.screen;
      if (screen === 'technician-setup') {
        router.push('/technician/setup');
        Notifications.clearLastNotificationResponse();
      }
    };

    openOnboarding(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(openOnboarding);
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  usePartnerNotificationNavigation();
  return (
    <View style={{ flex: 1, backgroundColor: '#f7faf8' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </View>
  );
}
