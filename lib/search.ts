import type { Filters } from './filters';
import type { Dish } from './types';

/** Anything shaped like supabase.rpc(); lets tests swap in an in-memory Postgres. */
export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type SearchOptions = { embedding?: number[] | null; limit?: number };

export type Row = Dish & { score: number };

export function toRpcArgs(f: Filters, opts: SearchOptions = {}): Record<string, unknown> {
  const hasSemantic = Boolean(opts.embedding) || f.tags.length > 0;
  return {
    p_max_price: f.maxPrice,
    p_min_price: f.minPrice,
    p_vegetarian: f.vegetarian || f.vegan,
    p_vegan: f.vegan,
    p_exclude_allergens: f.excludeAllergens,
    p_min_spice: f.minSpice,
    p_max_spice: f.maxSpice,
    p_tags: f.tags,
    p_keywords: f.keywords,
    // A pure keyword query ("pizza") must actually match the keyword; if the query also has
    // meaning to rank by (tags / embedding), keywords only boost the ranking.
    p_strict_keywords: f.keywords.length > 0 && !hasSemantic,
    p_query_embedding: opts.embedding ? `[${opts.embedding.join(',')}]` : null,
    p_limit: opts.limit ?? 12,
  };
}

export async function searchDishes(rpc: Rpc, f: Filters, opts: SearchOptions = {}): Promise<Row[]> {
  const { data, error } = await rpc('search_dishes', toRpcArgs(f, opts));
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}
