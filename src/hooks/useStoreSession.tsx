import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { PartnerApiError, partnerApi } from '../lib/partnerApi';
import { merchantApi, onStoreAccessLost } from '../lib/marketplace/api';
import { errorMessage, isNetworkError } from '../lib/marketplace/errors';
import { Permission, can as roleCan } from '../lib/marketplace/permissions';
import type { MerchantSummary, StoreRole, StoreStatus } from '../lib/marketplace/types';

type Phase = 'loading' | 'ready' | 'error';

interface StoreSession {
  phase: Phase; error: string; status: StoreStatus | null; merchant: MerchantSummary | null; role: StoreRole | null;
  can: (permission: Permission) => boolean; refresh: () => Promise<void>; signOut: () => Promise<void>;
}

const Context = createContext<StoreSession | null>(null);

export const useStoreSession = (): StoreSession => {
  const value = useContext(Context);
  if (!value) throw new Error('useStoreSession must be used inside <StoreSessionProvider>.');
  return value;
};

/**
 * The store gate (hand-off §3, §6): every launch and resume re-reads /auth/status and routes on the answer.
 * Not signed in → home. No store → register. Pending / suspended / rejected → blocked screen. Otherwise the workspace opens.
 */
export function StoreSessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<StoreStatus | null>(null);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setPhase('loading');
    try {
      const session = await partnerApi.session();
      if (!session.user) { router.replace('/' as never); return; }
      let next = await merchantApi.status();
      // A staff member's first login claims the invitation, after which the store appears on their status.
      if (!next.isMerchant && next.hasPendingInvite) { await merchantApi.login().catch(() => undefined); next = await merchantApi.status(); }
      if (!next.isMerchant) { router.replace('/store/register' as never); return; }
      setStatus(next);
      if (!next.canAccessDashboard) { router.replace('/store/blocked' as never); return; }
      setError(''); setPhase('ready');
    } catch (cause) {
      if (cause instanceof PartnerApiError && cause.status === 401) { router.replace('/' as never); return; }
      if (silent) return;
      setError(errorMessage(cause, 'Could not open your store.')); setPhase('error');
    }
  }, []);

  // Check the store once on entry.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(false); }, [load]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(true); });
    return () => subscription.remove();
  }, [load]);
  useEffect(() => {
    onStoreAccessLost(reason => router.replace((reason === 'revoked' ? '/' : `/store/blocked?reason=${reason}`) as never));
    return () => onStoreAccessLost(null);
  }, []);

  const signOut = useCallback(async () => {
    await merchantApi.logout().catch(error => { if (!isNetworkError(error)) throw error; });
    router.replace('/' as never);
  }, []);

  const value = useMemo<StoreSession>(() => ({
    phase, error, status, merchant: status?.merchant ?? null, role: status?.storeRole ?? null,
    can: permission => roleCan(status?.storeRole, permission), refresh: () => load(true), signOut,
  }), [phase, error, status, load, signOut]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
