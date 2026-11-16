import type { PendingPhone } from './auth';

// The "verify your phone" proof from login / Google lives only in memory (valid ~15 minutes, MOBILE_AUTH_API.md §7).
// It is handed to the verification screen here instead of through route params, so it never lands in a URL or in saved navigation state.
let pending: PendingPhone | null = null;

export const setPendingPhone = (value: PendingPhone | null) => { pending = value; };
export const getPendingPhone = () => pending;
