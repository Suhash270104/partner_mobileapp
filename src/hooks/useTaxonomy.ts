import { useCallback, useEffect, useState } from 'react';
import { loadTaxonomy } from '../lib/marketplace/taxonomy';
import type { TaxonomyCategory } from '../lib/marketplace/types';

/** Marketplace categories + subcategories, fetched once and shared across screens. */
export function useTaxonomy() {
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((force = false) => {
    setLoading(true); setError('');
    loadTaxonomy(force).then(setCategories).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load categories.')).finally(() => setLoading(false));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return { categories, loading, error, retry: () => load(true), subcategoriesOf: (name: string) => categories.find(c => c.name === name)?.subcategories ?? [] };
}
