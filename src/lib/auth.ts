import { captureTokens, clearTokens, getRefreshToken, nativeHeaders } from './sessionTokens';

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly field?: string, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  roles: { type: string; status: string }[];
  profiles?: Record<string, { name?: string }>;
}

export interface AuthResult {
  user: AuthUser;
  activeRole: string;
  isNew?: boolean;
  isNewUser?: boolean;
}

/** The server accepted the credential but this account has no OTP-verified phone yet (MOBILE_AUTH_API.md §1, §7, §8). */
export interface PendingPhone { pendingToken: string; isNew: boolean; name?: string; email?: string }
export type SignInOutcome = { kind: 'session'; result: AuthResult; isNew: boolean } | { kind: 'verifyPhone'; pending: PendingPhone };

/** Roles a person can start as through the mobile OTP flow. */
export type AuthIntent = 'customer' | 'designer' | 'technician' | 'realtor';
export type RealtorAccountType = 'individual_owner' | 'agent' | 'builder' | 'developer';

export interface MobileVerifyResult extends Partial<AuthResult> {
  isNewUser: boolean; phone?: string; phoneVerificationToken?: string; needsDetails?: boolean; nextPath?: string | null; dashboardPath?: string | null;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!configuredBaseUrl) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL in partner_mobileapp/.env before connecting to the Kraftnex backend.');
  }
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await nativeHeaders()), ...init.headers },
    });
  } catch {
    throw new AuthApiError('Could not reach Kraftnex. Check your internet connection and try again.', 0, 'NETWORK');
  }
  let body: { message?: string; code?: string; field?: string; retryAfterSeconds?: number } = {};
  try {
    body = await response.json();
  } catch {
    // The server may return an empty response for a failed request.
  }
  if (!response.ok) {
    throw new AuthApiError(body.message ?? `Request failed (${response.status}).`, response.status, body.code, body.field, body.retryAfterSeconds);
  }
  await captureTokens(body);
  return body as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

/** Turns a login / Google response into "you are signed in" or "verify your phone first". */
function toOutcome(body: Record<string, unknown>): SignInOutcome {
  if (body.verificationRequired && typeof body.pendingToken === 'string') {
    return { kind: 'verifyPhone', pending: { pendingToken: body.pendingToken, isNew: !!body.isNew, name: body.name as string | undefined, email: body.email as string | undefined } };
  }
  return { kind: 'session', result: body as unknown as AuthResult, isNew: !!body.isNew };
}

export const authApi = {
  // ── Email + phone OTP sign-up ────────────────────────────────────────────────
  registerSendOtp: (phone: string, email: string) =>
    post<{ message: string; expiresInSeconds: number; resendAfterSeconds: number }>('/v1/auth/register/otp/send', { phone, email }),
  registerVerifyOtp: (phone: string, otp: string) =>
    post<{ message: string; exists: boolean; phone?: string; phoneVerificationToken?: string }>('/v1/auth/register/otp/verify', { phone, otp }),
  register: (payload: { name: string; email: string; password: string; phone: string; phoneVerificationToken: string; website?: string }) =>
    post<AuthResult>('/v1/auth/register', payload),
  recordLegalConsent: (context: string) =>
    post<{ ok: boolean; acceptedAt: string; policyVersion: string }>('/consent/legal', { audience: 'partner', context, policyVersion: '2026-10-22', source: 'partner' }),

  // ── Sign in ──────────────────────────────────────────────────────────────────
  login: (emailOrPhone: string, password: string) => post<Record<string, unknown>>('/v1/auth/login', { emailOrPhone, password }).then(toOutcome),
  google: (idToken: string) => post<Record<string, unknown>>('/v1/auth/google', { idToken }).then(toOutcome),

  // ── Mobile OTP (sign in or sign up with a phone number; `intent` picks the workspace role) ──
  mobileSend: (phone: string) => post<{ message?: string; maskedPhone?: string; expiresInSeconds: number; resendAfterSeconds: number }>('/auth/mobile/send', { phone }),
  mobileVerify: (phone: string, otp: string, intent: AuthIntent) => post<MobileVerifyResult>('/auth/mobile/verify', { phone, otp, intent }),
  mobileComplete: (input: { phone: string; phoneVerificationToken: string; name: string; email: string; city?: string; intent: AuthIntent; accountType?: RealtorAccountType }) =>
    post<AuthResult>('/auth/mobile/complete', { ...input, website: '' }),
  mobileUpdateBasics: (input: { name: string; email: string; city?: string }) => request<{ success: boolean }>('/auth/mobile/basics', { method: 'PATCH', body: JSON.stringify(input) }),

  // ── Finish an account that still needs a verified phone (after login / Google) ──
  linkSend: (pendingToken: string, phone: string) => post<{ maskedPhone?: string; expiresInSeconds: number; resendAfterSeconds: number }>('/auth/mobile/link/send', { pendingToken, phone }),
  linkComplete: (pendingToken: string, phone: string, otp: string) => post<AuthResult>('/auth/mobile/link/complete', { pendingToken, phone, otp }),

  // ── Roles ────────────────────────────────────────────────────────────────────
  /** Adds a workspace role (e.g. realtor) to the signed-in account without a second registration. */
  addProfile: (type: 'realtor' | 'designer' | 'technician', body: Record<string, unknown>) =>
    post<{ message: string; profileId: string; activeRole: string; status: string }>(`/v1/profiles/${type}`, body),

  forgotPassword: (email: string) => post<{ message: string }>('/v1/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => post<{ message: string }>('/v1/auth/reset-password', { token, password }),
  session: () => request<{ user: AuthUser | null; activeRole?: string }>('/v1/auth/session'),
  logout: async () => {
    const refreshToken = await getRefreshToken();
    try { return await post<{ message: string }>('/v1/auth/logout', refreshToken ? { refreshToken } : {}); }
    finally { await clearTokens(); }
  },
};
