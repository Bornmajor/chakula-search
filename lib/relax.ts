import type { Filters } from './filters';
import { searchDishes, type Row, type Rpc } from './search';

export type Relaxation = { label: string; filters: Filters; results: Row[] };

const ceil50 = (n: number) => Math.ceil(n / 50) * 50;

/**
 * When a search returns nothing, work out which single constraint to loosen.
 * Allergen and diet restrictions are NEVER suggested for relaxing: they are safety
 * constraints, not preferences.
 */
export async function suggestRelaxations(rpc: Rpc, f: Filters, embedding?: number[] | null): Promise<Relaxation[]> {
  const out: Relaxation[] = [];

  if (f.maxPrice) {
    const loose = { ...f, maxPrice: null };
    const rows = await searchDishes(rpc, loose, { embedding, limit: 30 });
    if (rows.length) {
      const target = ceil50(Math.min(...rows.map((r) => r.price)));
      const nf = { ...f, maxPrice: target };
      out.push({
        label: `Nothing under KES ${f.maxPrice}. Here are options under KES ${target}`,
        filters: nf,
        results: (await searchDishes(rpc, nf, { embedding, limit: 4 })),
      });
    }
  }
  if (f.minSpice) {
    const nf = { ...f, minSpice: null };
    const results = await searchDishes(rpc, nf, { embedding, limit: 4 });
    if (results.length) out.push({ label: 'No spicy match. Showing dishes at any spice level', filters: nf, results });
  }
  if (f.tags.length) {
    const nf = { ...f, tags: [], semanticQuery: '' };
    const results = await searchDishes(rpc, nf, { embedding: null, limit: 4 });
    if (results.length) out.push({ label: `Ignoring "${f.tags.join(', ')}" gives these`, filters: nf, results });
  }
  if (f.keywords.length) {
    const nf = { ...f, keywords: [] };
    const results = await searchDishes(rpc, nf, { embedding, limit: 4 });
    if (results.length) out.push({ label: `Nothing matched "${f.keywords.join(' ')}". Here is what else fits your filters`, filters: nf, results });
  }
  return out.slice(0, 3);
}
