import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'partner-updates';

export async function getPartnerExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      || Constants.easConfig?.projectId;
    if (!projectId) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Partner updates',
        description: 'Technician onboarding and account updates',
        importance: 5,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#07523e',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Expo Go and devices without a configured EAS project cannot issue a remote push token.
    return null;
  }
}

export async function showPartnerNotification(title: string, body: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Partner updates',
        description: 'Technician onboarding and account updates',
        importance: 5,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#07523e',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { screen: 'technician-setup' },
      },
      trigger: null,
    });
    return true;
  } catch {
    // Notification permission or device support must not block account setup.
    return false;
  }
}
