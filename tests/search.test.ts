import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './db';
import { CASES } from './queries';
import { ALLERGENS, emptyFilters } from '@/lib/filters';
import { ruleParse } from '@/lib/ruleParse';
import { searchDishes, type Rpc } from '@/lib/search';
import { suggestRelaxations } from '@/lib/relax';

let rpc: Rpc;
let db: Awaited<ReturnType<typeof createTestDb>>['db'];

beforeAll(async () => {
  ({ rpc, db } = await createTestDb());
});

describe('query set (rule parser -> SQL)', () => {
  for (const c of CASES) {
    it(c.q, async () => {
      const rows = await searchDishes(rpc, ruleParse(c.q), { limit: 50 });
      const slugs = rows.map((r) => r.slug);
      if (c.empty) expect(slugs).toEqual([]);
      for (const s of c.include ?? []) expect(slugs, `expected ${s}`).toContain(s);
      for (const s of c.exclude ?? []) expect(slugs, `must not contain ${s}`).not.toContain(s);
      if (c.all) for (const r of rows) expect(c.all(r), `${r.slug} violates the query`).toBe(true);
      // Global invariant: sold-out dishes are never returned.
      for (const r of rows) expect(r.sold_out).toBe(false);
    });
  }
});

describe('safety invariants', () => {
  it.each(ALLERGENS)('excluding "%s" never returns a dish containing it', async (a) => {
    const rows = await searchDishes(rpc, { ...emptyFilters(), excludeAllergens: [a] }, { limit: 100 });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.allergens).not.toContain(a);
  });

  it('dishes with unverified allergen data are excluded from allergen-restricted searches', async () => {
    await db.exec(`insert into dishes (slug,name,description,category,price,allergens,allergens_verified,tags)
      values ('mystery-dish','Mystery Dish','Allergens not yet checked.','Test',100,'{}',false,'{filling}')`);
    const restricted = await searchDishes(rpc, { ...emptyFilters(), excludeAllergens: ['nuts'] }, { limit: 100 });
    expect(restricted.map((r) => r.slug)).not.toContain('mystery-dish');
    const open = await searchDishes(rpc, emptyFilters(), { limit: 100 });
    expect(open.map((r) => r.slug)).toContain('mystery-dish'); // fine when no allergen restriction
  });

  it('sold-out dishes disappear from results', async () => {
    await db.exec(`update dishes set sold_out = true where slug = 'githeri'`);
    const rows = await searchDishes(rpc, ruleParse('githeri'), { limit: 20 });
    expect(rows.map((r) => r.slug)).not.toContain('githeri');
  });
});

describe('no-results handling', () => {
  it('suggests relaxing the price, and never relaxes allergens', async () => {
    const f = ruleParse('vegetarian no nuts under 100');
    expect(await searchDishes(rpc, f)).toHaveLength(0);
    const relaxed = await suggestRelaxations(rpc, f);
    expect(relaxed.length).toBeGreaterThan(0);
    expect(relaxed[0].label).toMatch(/under KES/);
    for (const r of relaxed) {
      expect(r.filters.excludeAllergens).toEqual(['nuts']);
      expect(r.filters.vegetarian).toBe(true);
      for (const d of r.results) expect(d.allergens).not.toContain('nuts');
    }
  });
});
