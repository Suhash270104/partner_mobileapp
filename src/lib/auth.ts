const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly field?: string) {
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
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!configuredBaseUrl) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL in partner_mobileapp/.env before connecting to the Kraftnex backend.');
  }
  const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  let body: { message?: string; code?: string; field?: string } = {};
  try {
    body = await response.json();
  } catch {
    // The server may return an empty response for a failed request.
  }
  if (!response.ok) {
    throw new AuthApiError(body.message ?? `Request failed (${response.status}).`, response.status, body.code, body.field);
  }
  return body as T;
}

export const authApi = {
  registerSendOtp: (phone: string, email: string) =>
    request<{ message: string; expiresInSeconds: number; resendAfterSeconds: number }>('/v1/auth/register/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, email }),
    }),
  registerVerifyOtp: (phone: string, otp: string) =>
    request<{ message: string; exists: boolean; phone?: string; phoneVerificationToken?: string }>('/v1/auth/register/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),
  register: (payload: { name: string; email: string; password: string; phone: string; phoneVerificationToken: string; website?: string }) =>
    request<AuthResult>('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  recordLegalConsent: (context: string) =>
    request<{ ok: boolean; acceptedAt: string; policyVersion: string }>('/consent/legal', {
      method: 'POST',
      body: JSON.stringify({ audience: 'partner', context, policyVersion: '2026-10-22', source: 'partner' }),
    }),
  login: (emailOrPhone: string, password: string) =>
    request<AuthResult>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password }),
    }),
  google: (idToken: string) =>
    request<AuthResult & { isNew: boolean }>('/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  session: () => request<{ user: AuthUser | null; activeRole?: string }>('/v1/auth/session'),
  logout: () => request<{ message: string }>('/v1/auth/logout', { method: 'POST' }),
};
