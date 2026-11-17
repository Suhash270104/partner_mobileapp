import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Native session storage and transport (MOBILE_AUTH_API.md §2–§3).
//
// A phone sends `X-Client-Platform: android|ios`, so the server returns session tokens in the JSON body. They live in the
// Keychain / Android Keystore as ONE value (a crash can never leave an access token from one login next to a refresh token
// from another) and are cached in memory after the first read, so requests never wait on the keychain.
// `AFTER_FIRST_UNLOCK` keeps them readable while the phone is locked, which background refreshes and push handlers need.
// Lifetimes are decided by the server: 15-minute access token, refresh token 30 days idle (sliding), 90 days absolute.
// On web the browser's cookie flow is unchanged: no header, nothing stored here.

const KEYS = { tokens: 'kraftnex.partner.tokens', snapshot: 'kraftnex.partner.snapshot', deviceId: 'kraftnex.partner.device_id' } as const;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
const EXPIRY_MARGIN_MS = 60_000; // renew one minute before the access token lapses

export const isNativeApp = Platform.OS === 'android' || Platform.OS === 'ios';

export interface SessionTokens { accessToken?: string; refreshToken?: string; accessExpiresIn?: number; refreshExpiresAt?: string }
/** Display data only, never a credential: lets a returning person see their account at once, even offline. */
export interface SessionSnapshot { user: unknown; activeRole?: string }

let tokens: { accessToken: string; refreshToken: string } | null = null;
let snapshot: SessionSnapshot | null = null;
let deviceId = '';
let accessExpiresAt = 0; // 0 = unknown: rely on a 401
let lastRefreshAt = 0;
let loading: Promise<void> | null = null;

async function read(key: string) { try { return await SecureStore.getItemAsync(key, OPTIONS); } catch { return null; } }
async function write(key: string, value: string | null) {
  try { if (value === null) await SecureStore.deleteItemAsync(key, OPTIONS); else await SecureStore.setItemAsync(key, value, OPTIONS); }
  catch { /* storage can be briefly unavailable while the phone is locked; the in-memory copy still serves this run */ }
}
const parse = <T>(raw: string | null): T | null => { if (!raw) return null; try { return JSON.parse(raw) as T; } catch { return null; } };

/** Reads storage once per app run. Everything below waits on it, so callers never see half-loaded state. */
export function loadStoredSession(): Promise<void> {
  if (!isNativeApp) return Promise.resolve();
  loading ??= (async () => {
    const [rawTokens, rawSnapshot, savedDevice] = await Promise.all([read(KEYS.tokens), read(KEYS.snapshot), read(KEYS.deviceId)]);
    tokens = parse(rawTokens);
    snapshot = parse(rawSnapshot);
    deviceId = savedDevice || '';
    if (!deviceId) { deviceId = Crypto.randomUUID(); await write(KEYS.deviceId, deviceId); }
  })();
  return loading;
}

export const getAccessToken = async () => { await loadStoredSession(); return tokens?.accessToken ?? null; };
export const getRefreshToken = async () => { await loadStoredSession(); return tokens?.refreshToken ?? null; };
/** A stable random id per install; survives sign-out because it identifies the phone, not the person. */
export const getDeviceId = async () => { await loadStoredSession(); return deviceId; };
export const getSessionSnapshot = async () => { await loadStoredSession(); return snapshot; };

export async function saveSessionSnapshot(next: SessionSnapshot) {
  if (!isNativeApp) return;
  snapshot = next;
  await write(KEYS.snapshot, JSON.stringify(next));
}

/** Headers every native request carries. Empty on web. */
export async function nativeHeaders(): Promise<Record<string, string>> {
  if (!isNativeApp) return {};
  await loadStoredSession();
  return { 'X-Client-Platform': Platform.OS, 'X-Device-Id': deviceId, ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) };
}

/**
 * Phones authenticate with the Bearer token alone. The store dashboard session (`merchant_token`) is still delivered only as
 * a cookie, so calls to it keep the cookie jar until the backend also returns that token in the body.
 */
export const credentialsFor = (path: string): RequestCredentials => (!isNativeApp || path.includes('/marketplace/merchant') ? 'include' : 'omit');

/** Saves the tokens from any response that minted or renewed a session. The refresh token rotates, so always overwrite. */
export async function captureTokens(body: unknown): Promise<boolean> {
  if (!isNativeApp || !body || typeof body !== 'object') return false;
  const issued = (body as { tokens?: SessionTokens }).tokens;
  if (!issued?.accessToken) return false;
  await loadStoredSession();
  const refreshToken = issued.refreshToken || tokens?.refreshToken;
  if (!refreshToken) return false;
  tokens = { accessToken: issued.accessToken, refreshToken };
  lastRefreshAt = Date.now();
  accessExpiresAt = issued.accessExpiresIn && issued.accessExpiresIn > 0 ? Date.now() + issued.accessExpiresIn * 1000 - EXPIRY_MARGIN_MS : Date.now() + 14 * 60_000;
  await write(KEYS.tokens, JSON.stringify(tokens));
  return true;
}

/** True when a signed-in phone should renew its access token before sending the next request. */
export const accessTokenExpiring = () => isNativeApp && !!tokens && accessExpiresAt > 0 && Date.now() >= accessExpiresAt;
/** True until this app run has renewed once; the first renewal slides the 30-day idle window forward. */
export const needsLaunchRefresh = () => isNativeApp && !!tokens && lastRefreshAt === 0;

export async function clearTokens() {
  if (!isNativeApp) return;
  tokens = null; snapshot = null; accessExpiresAt = 0; lastRefreshAt = 0;
  await Promise.all([write(KEYS.tokens, null), write(KEYS.snapshot, null)]);
}
