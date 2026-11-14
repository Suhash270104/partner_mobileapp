import { partnerApi } from '../partnerApi';
import type { Json, TaxonomyCategory } from './types';

// Marketplace categories and their subcategories come live from the public catalogue endpoint, so the app never carries
// its own copy of the list. The result is cached for the session.
let cache: TaxonomyCategory[] | null = null;
let inflight: Promise<TaxonomyCategory[]> | null = null;

const parse = (home: Json): TaxonomyCategory[] => {
  const list = (home.categories ?? home.data?.categories ?? []) as Json[];
  return list
    .map(category => ({
      name: String(category.name ?? category.category ?? ''),
      subcategories: ((category.subcategories ?? []) as unknown[]).map(sub => String((sub as Json)?.name ?? sub)).filter(Boolean),
    }))
    .filter(category => category.name);
};

export function loadTaxonomy(force = false): Promise<TaxonomyCategory[]> {
  if (cache && !force) return Promise.resolve(cache);
  inflight ??= partnerApi.call<Json>('/marketplace/shop/home')
    .then(home => {
      const parsed = parse(home);
      if (!parsed.length) throw new Error('The marketplace category list is empty.');
      cache = parsed;
      return parsed;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
