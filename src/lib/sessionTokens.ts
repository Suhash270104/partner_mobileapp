import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Native session transport (MOBILE_AUTH_API.md §2–§3). A phone sends `X-Client-Platform: android|ios`, which makes the
// server return the session tokens in the JSON body. The app keeps them in secure storage and sends
// `Authorization: Bearer <accessToken>` on every call. Cookies are still sent too (the store dashboard's
// `merchant_token` only ever travels as a cookie), but nothing depends on them for the Kraftnex session.
// On web (Expo web) the browser cookie flow is unchanged: no header, no stored tokens.

const ACCESS_KEY = 'kraftnex_access_token';
const REFRESH_KEY = 'kraftnex_refresh_token';
const DEVICE_KEY = 'kraftnex_device_id';

export const isNativeApp = Platform.OS === 'android' || Platform.OS === 'ios';

export interface SessionTokens { accessToken?: string; refreshToken?: string; accessExpiresIn?: number; refreshExpiresAt?: string }

const read = (key: string) => SecureStore.getItemAsync(key).catch(() => null);

export const getAccessToken = () => (isNativeApp ? read(ACCESS_KEY) : Promise.resolve(null));
export const getRefreshToken = () => (isNativeApp ? read(REFRESH_KEY) : Promise.resolve(null));

let deviceId: string | null = null;
/** A stable random id per install, used by the server for per-device OTP limits and the "devices" list. */
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  const stored = await read(DEVICE_KEY);
  if (stored) { deviceId = stored; return stored; }
  deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_KEY, deviceId).catch(() => undefined);
  return deviceId;
}

/** Headers every native request carries. Empty on web. */
export async function nativeHeaders(): Promise<Record<string, string>> {
  if (!isNativeApp) return {};
  const [access, device] = await Promise.all([getAccessToken(), getDeviceId()]);
  return { 'X-Client-Platform': Platform.OS, 'X-Device-Id': device, ...(access ? { Authorization: `Bearer ${access}` } : {}) };
}

/** Saves the tokens from any response that minted or renewed a session. The refresh token rotates, so always overwrite. */
export async function captureTokens(body: unknown): Promise<boolean> {
  if (!isNativeApp || !body || typeof body !== 'object') return false;
  const tokens = (body as { tokens?: SessionTokens }).tokens;
  if (!tokens?.accessToken) return false;
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken).catch(() => undefined);
  if (tokens.refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken).catch(() => undefined);
  return true;
}

export async function clearTokens() {
  if (!isNativeApp) return;
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]).catch(() => undefined);
}
