import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BlockedKind, BlockedState } from '../../components/marketplace/BlockedState';
import { Screen } from '../../components/ui';
import { merchantApi } from '../../lib/marketplace/api';
import { SUPPORT } from '../../lib/marketplace/constants';
import { errorMessage } from '../../lib/marketplace/errors';
import type { StoreStatus } from '../../lib/marketplace/types';

const supportUrl = SUPPORT.email ? `mailto:${SUPPORT.email}` : SUPPORT.phone ? `tel:${SUPPORT.phone}` : '';

/** Shown when the server withholds the workspace: pending review, suspended, or rejected. Re-checks on pull-down. */
export default function StoreBlockedScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [status, setStatus] = useState<StoreStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    setChecking(true); setError('');
    try {
      const next = await merchantApi.status();
      if (next.canAccessDashboard) { router.replace('/store' as never); return; }
      if (!next.isMerchant) { router.replace('/store/register' as never); return; }
      setStatus(next);
    } catch (cause) { setError(errorMessage(cause, 'Could not check your store status.')); }
    finally { setChecking(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void check(); }, [check]);

  const approval = status?.merchant?.approvalStatus;
  // The API reports a rejected store as "suspended"; the approval status tells the two apart.
  const kind: BlockedKind = approval === 'rejected' || reason === 'rejected' ? 'rejected' : approval === 'pending' || reason === 'pending' ? 'pending' : 'suspended';

  const signOut = async () => { await merchantApi.logout().catch(() => undefined); router.replace('/' as never); };

  return <Screen standalone title="Your store" error={error} onRetry={() => void check()} refreshing={checking && !!status} onRefresh={() => void check()} onBack={() => router.replace('/' as never)}>
    <BlockedState kind={kind} reason={status?.merchant?.rejectionReason} checking={checking} onCheckAgain={() => void check()} onSignOut={() => void signOut()}
      onContactSupport={supportUrl ? () => void Linking.openURL(supportUrl) : undefined} />
  </Screen>;
}
