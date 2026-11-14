import { useCallback, useState } from 'react';
import type { ListResponse } from '../lib/marketplace/types';
import { useAsyncData } from './useAsyncData';

type Extra<T> = { source: unknown; items: T[]; page: number };

/**
 * A paginated list: page 1 comes from `fetchPage(1)` (and reloads when `deps` change), "Load more" appends later pages.
 * Later pages belong to the page-1 result they were loaded after, so changing a filter or reloading drops them automatically.
 * `patchItem` / `removeItem` update a row in place after a successful write, without refetching the whole list.
 */
export function usePagedList<T, R extends ListResponse<T> = ListResponse<T>>(
  fetchPage: (page: number) => Promise<R>, getId: (item: T) => string, deps: readonly unknown[], options: { refetchOnFocus?: boolean } = {},
) {
  const first = useAsyncData(() => fetchPage(1), deps, options);
  const [extra, setExtra] = useState<Extra<T>>({ source: null, items: [], page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  const current = extra.source === first.data ? extra : { source: first.data, items: [] as T[], page: 1 };
  const items = [...(first.data?.items ?? []), ...current.items];
  const total = first.data?.pagination?.total ?? items.length;

  const loadMore = useCallback(async () => {
    const source = first.data;
    if (!source) return;
    setLoadingMore(true);
    try {
      const page = current.page + 1;
      const next = await fetchPage(page);
      setExtra(previous => ({ source, items: [...(previous.source === source ? previous.items : []), ...next.items], page }));
    } catch { /* the button stays so the person can try again */ }
    finally { setLoadingMore(false); }
  }, [first.data, current.page, fetchPage]);

  const patchItem = (id: string, change: Partial<T>) => {
    first.setData(previous => previous && { ...previous, items: previous.items.map(item => (getId(item) === id ? { ...item, ...change } : item)) });
    setExtra(previous => ({ ...previous, items: previous.items.map(item => (getId(item) === id ? { ...item, ...change } : item)) }));
  };
  const removeItem = (id: string) => {
    first.setData(previous => previous && { ...previous, items: previous.items.filter(item => getId(item) !== id), pagination: previous.pagination && { ...previous.pagination, total: Math.max(0, previous.pagination.total - 1) } });
    setExtra(previous => ({ ...previous, items: previous.items.filter(item => getId(item) !== id) }));
  };

  return { ...first, items, total, loadMore, loadingMore, patchItem, removeItem };
}
