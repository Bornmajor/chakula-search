import { describe, expect, it, vi } from 'vitest';
import { understandQuery } from '@/lib/understand';
import { claudeParse } from '@/lib/claude';
import { chipsFor } from '@/lib/chips';
import { whyItMatches } from '@/lib/why';
import { emptyFilters } from '@/lib/filters';

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

const toolUse = (input: unknown) => ({ content: [{ type: 'tool_use', name: 'set_filters', input }] });

describe('Claude integration (mocked HTTP)', () => {
  it('sends a forced tool call and parses the structured answer', async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse(toolUse({ vegetarian: true, vegan: false, excludeAllergens: [], tags: ['filling'], keywords: [], semanticQuery: 'filling meatless meal' })),
    ) as unknown as typeof fetch;
    const r = await understandQuery('kitu ya kushiba bila nyama', { apiKey: 'k', fetchImpl });
    expect(r.mode).toBe('ai');
    expect(r.filters.vegetarian).toBe(true);
    const body = JSON.parse((fetchImpl as any).mock.calls[0][1].body);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'set_filters' });
  });

  it('falls back to the rule parser on HTTP errors', async () => {
    const fetchImpl = (() => jsonResponse({}, 529)) as unknown as typeof fetch;
    const r = await understandQuery('vegan under 300', { apiKey: 'k', fetchImpl });
    expect(r.mode).toBe('fallback');
    expect(r.filters.vegan).toBe(true);
    expect(r.filters.maxPrice).toBe(300);
  });

  it('falls back when the model returns invalid JSON for our schema', async () => {
    const fetchImpl = (() => jsonResponse(toolUse({ excludeAllergens: ['pizza'], tags: 'oops' }))) as unknown as typeof fetch;
    expect((await understandQuery('pizza', { apiKey: 'k', fetchImpl })).mode).toBe('fallback');
  });

  it('falls back on timeout', async () => {
    const fetchImpl = ((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new Error('timeout'))))) as unknown as typeof fetch;
    const r = await understandQuery('no nuts', { apiKey: 'k', fetchImpl, timeoutMs: 50 });
    expect(r.mode).toBe('fallback');
    expect(r.filters.excludeAllergens).toContain('nuts');
  });

  it('falls back immediately with no API key', async () => {
    expect((await understandQuery('no nuts')).mode).toBe('fallback');
  });

  it('THE AI CANNOT DROP A "NO NUTS": rule-detected allergens are merged back in', async () => {
    const fetchImpl = (() =>
      jsonResponse(toolUse({ vegetarian: false, vegan: false, excludeAllergens: [], tags: [], keywords: [], semanticQuery: 'meal' }))) as unknown as typeof fetch;
    const r = await understandQuery('vegetarian lunch, no nuts', { apiKey: 'k', fetchImpl });
    expect(r.mode).toBe('ai');
    expect(r.filters.excludeAllergens).toContain('nuts');
    expect(r.filters.vegetarian).toBe(true);
  });

  it('rejects an unknown allergen from the model', async () => {
    const fetchImpl = (() => jsonResponse(toolUse({ vegetarian: false, vegan: false, excludeAllergens: ['gravity'], tags: [], keywords: [], semanticQuery: '' }))) as unknown as typeof fetch;
    await expect(claudeParse('x', { apiKey: 'k', fetchImpl })).rejects.toThrow();
  });
});

describe('chips and "why it matches"', () => {
  it('chips remove exactly one constraint', () => {
    const f = { ...emptyFilters(), vegetarian: true, maxPrice: 800, minSpice: 2 };
    const chips = chipsFor(f);
    expect(chips.map((c) => c.label)).toEqual(['Vegetarian', 'Under KES 800', 'Spicy']);
    expect(chips[1].remove(f)).toEqual({ ...f, maxPrice: null });
  });

  it('explains a match from the real filters', () => {
    const f = { ...emptyFilters(), vegetarian: true, minSpice: 2, excludeAllergens: ['nuts' as const] };
    const d = { price: 650, spice_level: 2, tags: [] } as any;
    expect(whyItMatches(d, f)).toBe('Vegetarian · Spicy · No nuts · KES 650');
  });
});
