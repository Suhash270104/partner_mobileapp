import { PartnerApiError } from '../partnerApi';
import { ERROR_CODES } from './constants';

/** The server refused store access for a reason that needs its own screen, not an error toast. */
export type AccessLoss = 'pending' | 'suspended' | 'rejected' | 'revoked';

export function accessLossOf(error: unknown): AccessLoss | null {
  if (!(error instanceof PartnerApiError) || error.status !== 403) return null;
  switch (error.code) {
    case ERROR_CODES.pending: return 'pending';
    case ERROR_CODES.suspended: return 'suspended';
    case ERROR_CODES.rejected: return 'rejected';
    case ERROR_CODES.accessRevoked: return 'revoked';
    default: return null;
  }
}

export const isRoleForbidden = (error: unknown) => error instanceof PartnerApiError && error.code === ERROR_CODES.roleForbidden;
export const isPhoneVerificationRequired = (error: unknown) => error instanceof PartnerApiError && error.code === ERROR_CODES.phoneRequired;
export const isNetworkError = (error: unknown) => error instanceof PartnerApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT');
export const isAlreadyWon = (error: unknown) => error instanceof PartnerApiError && error.code === ERROR_CODES.alreadyWon;

/** Human text for any failure. Falls back to the supplied sentence when the error carries no message. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof PartnerApiError) {
    if (isNetworkError(error)) return 'You appear to be offline. Check your connection and try again.';
    if (error.code === ERROR_CODES.rateLimited) return error.message || 'Too many attempts. Please wait a moment and try again.';
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Server validation messages look like "businessId: Must be a valid GSTIN; phone: Invalid phone".
 * Returns a field-path → message map so each message can be shown beside its input.
 */
export function parseFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof PartnerApiError) || error.code !== ERROR_CODES.validation) return {};
  const out: Record<string, string> = {};
  for (const part of error.message.split(';')) {
    const at = part.indexOf(':');
    if (at < 1) continue;
    const path = part.slice(0, at).trim();
    if (/^[\w.[\]]+$/.test(path)) out[path] = part.slice(at + 1).trim();
  }
  return out;
}
