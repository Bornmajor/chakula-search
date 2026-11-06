import { claudeParse, type FetchLike } from './claude';
import { mergeSafety, type Filters } from './filters';
import { ruleParse } from './ruleParse';

export type Understood = { filters: Filters; mode: 'ai' | 'fallback' };

/** Turn free text into filters. Never throws: worst case we use the rule parser. */
export async function understandQuery(
  query: string,
  opts: { apiKey?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<Understood> {
  const rules = ruleParse(query);
  if (!opts.apiKey) return { filters: rules, mode: 'fallback' };
  try {
    const ai = await claudeParse(query, { apiKey: opts.apiKey, model: opts.model, fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs });
    // Safety net: allergen/diet restrictions found by the rules are never dropped by the AI.
    return { filters: mergeSafety(ai, rules), mode: 'ai' };
  } catch (err) {
    console.warn('[search] Claude unavailable, using rule parser:', (err as Error).message);
    return { filters: rules, mode: 'fallback' };
  }
}
