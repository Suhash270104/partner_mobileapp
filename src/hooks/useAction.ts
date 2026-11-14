import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage, isRoleForbidden } from '../lib/marketplace/errors';

/**
 * Runs a write (save, delete, send…). Tracks which action is busy so each button can show its own spinner,
 * and reports failures once, in plain language. Returns the result, or undefined when it failed.
 */
export function useAction() {
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const run = useCallback(async <T,>(key: string, action: () => Promise<T>, options: { fallback?: string; silent?: boolean } = {}): Promise<T | undefined> => {
    setBusyKey(key); setError('');
    try { return await action(); }
    catch (cause) {
      const message = isRoleForbidden(cause) ? 'Your role cannot do this. Ask the store owner.' : errorMessage(cause, options.fallback ?? 'That did not go through. Please try again.');
      if (mounted.current) setError(message);
      if (!options.silent) Alert.alert('Could not complete', message);
      return undefined;
    } finally { if (mounted.current) setBusyKey(''); }
  }, []);

  return { run, busyKey, isBusy: (key?: string) => (key ? busyKey === key : busyKey !== ''), error, clearError: () => setError('') };
}

/** Native confirmation before a destructive step. Resolves true when the person confirms. */
export const confirmAction = (title: string, message: string, confirmLabel = 'Confirm') =>
  new Promise<boolean>(resolve => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
