import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isExpoGo } from './runtime';

const CHANNEL_ID = 'partner-updates';

// Android groups notifications by channel; the ids match the `channelId` the backend sends, so each
// kind can be silenced on its own from the phone's settings.
const EXTRA_CHANNELS: { id: string; name: string; description: string }[] = [
  { id: 'leads', name: 'New leads', description: 'New projects and enquiries for your studio' },
  { id: 'proposals', name: 'Proposals', description: 'Proposal decisions from clients' },
  { id: 'messages', name: 'Messages', description: 'New messages from clients' },
  { id: 'bookings', name: 'Jobs and bookings', description: 'Job offers, changes and reminders' },
  { id: 'marketplace', name: 'Marketplace', description: 'Enquiries and orders for your store' },
  { id: 'account-updates', name: 'Account and approvals', description: 'Verification and approval updates, credits and earnings' },
  { id: 'security', name: 'Account and security', description: 'Sign-in and password alerts' },
];

async function ensureExtraChannels(Notifications: typeof import('expo-notifications')) {
  for (const channel of EXTRA_CHANNELS) {
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      description: channel.description,
      importance: 4,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#07523e',
    }).catch(() => undefined);
  }
}

export async function getPartnerExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || isExpoGo()) return null;
    const Notifications = await import('expo-notifications');
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
      await ensureExtraChannels(Notifications);
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
    if (Platform.OS === 'web' || isExpoGo()) return false;
    const Notifications = await import('expo-notifications');
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
