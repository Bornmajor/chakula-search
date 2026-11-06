import type { Row } from '@/lib/search';

/**
 * The evaluation set: real-sounding customer queries (English, Swahili, Sheng) with
 * what they must and must never return. Runs the full deterministic pipeline:
 * rule parser -> SQL hard filters -> ranking.
 */
export type Case = {
  q: string;
  /** slugs that must appear */
  include?: string[];
  /** slugs that must never appear */
  exclude?: string[];
  /** every returned dish must satisfy this */
  all?: (d: Row) => boolean;
  empty?: boolean;
};

const noAllergen = (a: string) => (d: Row) => !d.allergens.includes(a);

export const CASES: Case[] = [
  { q: 'something spicy and filling under 800', include: ['beef-pilau'], all: (d) => d.price <= 800 && d.spice_level >= 2 },
  { q: 'vegetarian lunch, no nuts', include: ['ugali-sukuma', 'githeri'], all: (d) => d.is_vegetarian && noAllergen('nuts')(d) },
  { q: 'no nuts', exclude: ['groundnut-stew', 'wali-maharagwe', 'samaki-wa-nazi', 'paneer-tikka', 'karanga-brittle'], all: noAllergen('nuts') },
  { q: 'nut free', all: noAllergen('nuts') },
  { q: 'allergic to peanuts', all: noAllergen('nuts') },
  { q: 'bila karanga', all: noAllergen('nuts') }, // Swahili: "without peanuts"
  { q: 'kitu ya kushiba bila nyama', include: ['githeri'], all: (d) => d.is_vegetarian }, // "something filling without meat"
  { q: 'comfort food for a rainy day', include: ['chicken-supu', 'mukimo-beef-stew'] },
  { q: 'something for kids', include: ['chips-mayai', 'margherita-pizza'] },
  { q: 'vegan under 300', include: ['ugali-sukuma'], all: (d) => d.is_vegan && d.price <= 300 },
  { q: 'cheap filling food', include: ['ugali-sukuma'], all: (d) => d.price <= 400 },
  { q: 'chakula rahisi', all: (d) => d.price <= 400 }, // "cheap food"
  { q: 'chicken, not spicy', include: ['chips-chicken'], exclude: ['beef-burger'], all: (d) => d.spice_level <= 1 },
  { q: 'no dairy no gluten', all: (d) => noAllergen('dairy')(d) && noAllergen('gluten')(d) },
  { q: 'sina mayai', exclude: ['chips-mayai', 'mandazi-chai'], all: noAllergen('eggs') }, // "I have no eggs"
  { q: 'pizza', include: ['margherita-pizza'], exclude: ['ugali-sukuma'] },
  { q: 'fish, no shellfish under 1000', include: ['grilled-tilapia'], all: (d) => d.price <= 1000 },
  { q: 'spicy vegetarian under 800', include: ['spicy-veg-curry'], all: (d) => d.is_vegetarian && d.spice_level >= 2 && d.price <= 800 },
  { q: 'light healthy meal', include: ['kachumbari-salad'] },
  { q: 'pilipili wings', exclude: ['pilipili-wings'] }, // sold out: must never be shown
  { q: 'vegetarian under 100', empty: true },
];
