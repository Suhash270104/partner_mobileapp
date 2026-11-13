import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { partnerApi } from './partnerApi';
import { getPartnerExpoPushToken } from './partnerNotifications';

const TOKEN_KEY = 'kraftnex_partner_push_token';
let registered = false;

/**
 * Registers this phone for partner alerts (new leads, proposals, messages, job offers, approvals...)
 * once a partner is signed in, whichever workspace they use. Needs notification permission and the
 * project's Firebase credentials; when either is missing it quietly does nothing, because push is a
 * convenience and must never get in the way of using the app.
 */
export async function registerPartnerDevicePush(): Promise<void> {
  if (registered) return;
  try {
    const token = await getPartnerExpoPushToken();
    if (!token) return;
    await partnerApi.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    registered = true;
  } catch {
    /* try again the next time the session is loaded */
  }
}

/** Stops pushes to this phone (called when signing out, while the session is still valid). */
export async function unregisterPartnerDevicePush(): Promise<void> {
  registered = false;
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) await partnerApi.unregisterPushToken(token).catch(() => {});
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* best effort */
  }
}
