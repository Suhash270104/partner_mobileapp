import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export interface AsyncData<T> {
  data: T | undefined; loading: boolean; refreshing: boolean; error: string; reload: () => Promise<void>; refresh: () => Promise<void>;
  setData: (value: T | undefined | ((previous: T | undefined) => T | undefined)) => void;
}

/**
 * Loads data for a screen. `loading` is true only for the first load (and when `deps` change); pull-to-refresh and
 * refocus keep the existing content on screen. Stale responses from an older request are ignored.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: readonly unknown[], options: { refetchOnFocus?: boolean; errorText?: string } = {}): AsyncData<T> {
  const { refetchOnFocus = false, errorText = 'Could not load this. Pull down to try again.' } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const ticket = useRef(0);
  const loaderRef = useRef(loader);
  // Always call the latest loader without making it a dependency (callers pass a fresh closure every render).
  useEffect(() => { loaderRef.current = loader; });

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const mine = ++ticket.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await loaderRef.current();
      if (mine === ticket.current) { setData(result); setError(''); }
    } catch (cause) {
      if (mine === ticket.current) setError(cause instanceof Error && cause.message ? cause.message : errorText);
    } finally {
      if (mine === ticket.current) { setLoading(false); setRefreshing(false); }
    }
  }, [errorText]);

  // Reload when the inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { void run('initial'); }, deps);
  useFocusEffect(useCallback(() => { if (refetchOnFocus && ticket.current > 0) void run('silent'); }, [refetchOnFocus, run]));

  return {
    data, loading, refreshing, error, setData,
    reload: useCallback(() => run('initial'), [run]),
    refresh: useCallback(() => run('refresh'), [run]),
  };
}
