import type { Filters } from './filters';

export type Chip = { key: string; label: string; remove: (f: Filters) => Filters };

/** What the AI understood, as removable chips. Removing one re-runs the search without calling the AI. */
export function chipsFor(f: Filters): Chip[] {
  const chips: Chip[] = [];
  if (f.vegan) chips.push({ key: 'vegan', label: 'Vegan', remove: (x) => ({ ...x, vegan: false }) });
  if (f.vegetarian) chips.push({ key: 'veg', label: 'Vegetarian', remove: (x) => ({ ...x, vegetarian: false, vegan: false }) });
  for (const a of f.excludeAllergens) {
    chips.push({ key: `no-${a}`, label: `No ${a}`, remove: (x) => ({ ...x, excludeAllergens: x.excludeAllergens.filter((y) => y !== a) }) });
  }
  if (f.maxPrice) chips.push({ key: 'max', label: `Under KES ${f.maxPrice}`, remove: (x) => ({ ...x, maxPrice: null }) });
  if (f.minPrice) chips.push({ key: 'min', label: `Over KES ${f.minPrice}`, remove: (x) => ({ ...x, minPrice: null }) });
  if (f.minSpice) chips.push({ key: 'spicy', label: 'Spicy', remove: (x) => ({ ...x, minSpice: null }) });
  if (f.maxSpice !== null) chips.push({ key: 'mild', label: 'Mild', remove: (x) => ({ ...x, maxSpice: null }) });
  for (const t of f.tags) chips.push({ key: `tag-${t}`, label: t.replace('-', ' '), remove: (x) => ({ ...x, tags: x.tags.filter((y) => y !== t) }) });
  for (const k of f.keywords) chips.push({ key: `kw-${k}`, label: `“${k}”`, remove: (x) => ({ ...x, keywords: x.keywords.filter((y) => y !== k) }) });
  return chips;
}
