import { AuthApiError } from './auth';

/** Error codes the mobile auth endpoints return that the app reacts to (backend mobileAuthController.js). */
export const AUTH_CODE = {
  linkExpired: 'AUTH_LINK_EXPIRED', // the 15-minute pending-sign-in window passed
  phoneAlreadyVerified: 'AUTH_PHONE_ALREADY_VERIFIED', // the account was verified elsewhere meanwhile
  phoneInUse: 'AUTH_PHONE_IN_USE', // the number is verified on a different account
} as const;

export const hasAuthCode = (cause: unknown, ...codes: string[]): boolean => cause instanceof AuthApiError && !!cause.code && codes.includes(cause.code);

/** The pending sign-in can no longer be finished: the person has to start again from the beginning. */
export const isRestartError = (cause: unknown) => hasAuthCode(cause, AUTH_CODE.linkExpired, AUTH_CODE.phoneAlreadyVerified);

const waitText = (seconds: number) => {
  if (seconds >= 3600) return 'about an hour';
  if (seconds > 60) return `${Math.ceil(seconds / 60)} minutes`;
  return `${seconds} seconds`;
};

/** One place that turns an auth failure into text a person can act on. */
export function authMessage(cause: unknown, fallback: string): string {
  if (cause instanceof AuthApiError) {
    if (cause.status === 429) return cause.retryAfterSeconds ? `Too many attempts. Please try again in ${waitText(cause.retryAfterSeconds)}.` : 'Too many attempts. Please wait a few minutes and try again.';
    if (cause.code === AUTH_CODE.phoneInUse) return 'This number is already linked to another account. Sign in with that account instead.';
    if (cause.code === 'NETWORK') return cause.message;
    return cause.message || fallback;
  }
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
