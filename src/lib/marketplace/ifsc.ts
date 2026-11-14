import { SUPPORT } from './constants';

export type IfscBranch = { bank: string; branch: string; city?: string };

/**
 * Looks the branch up on the public IFSC directory so the bank name can be pre-filled. A failed or slow lookup
 * must never block registration, so this resolves to null instead of throwing.
 */
export async function lookupIfsc(code: string, signal?: AbortSignal): Promise<IfscBranch | null> {
  try {
    const response = await fetch(`${SUPPORT.ifscLookupUrl}/${encodeURIComponent(code.trim().toUpperCase())}`, { signal });
    if (!response.ok) return null;
    const data = await response.json() as { BANK?: string; BRANCH?: string; CITY?: string };
    return data.BANK ? { bank: data.BANK, branch: data.BRANCH ?? '', city: data.CITY } : null;
  } catch { return null; }
}
