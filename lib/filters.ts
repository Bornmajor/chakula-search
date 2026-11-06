import { z } from 'zod';

export const ALLERGENS = ['nuts', 'dairy', 'gluten', 'eggs', 'fish', 'shellfish', 'soy', 'sesame'] as const;
export const TAGS = [
  'filling', 'comfort', 'light', 'kids', 'sharing', 'cheap', 'snack', 'healthy',
  'sweet', 'traditional', 'rainy-day', 'breakfast', 'grilled', 'rice',
] as const;

/** Shared business rules for vague words, kept in one place. */
export const CHEAP_MAX_PRICE = 400; // "cheap" / "rahisi" means up to KES 400

/**
 * What the AI (or the rule parser) extracts from a query. Everything here is a
 * *request*: the SQL function decides what actually gets returned.
 */
export const FiltersSchema = z.object({
  maxPrice: z.number().int().positive().nullable().default(null),
  minPrice: z.number().int().positive().nullable().default(null),
  vegetarian: z.boolean().default(false),
  vegan: z.boolean().default(false),
  excludeAllergens: z.array(z.enum(ALLERGENS)).default([]),
  minSpice: z.number().int().min(0).max(3).nullable().default(null),
  maxSpice: z.number().int().min(0).max(3).nullable().default(null),
  tags: z.array(z.enum(TAGS)).default([]),
  keywords: z.array(z.string().min(2).max(30)).max(5).default([]),
  /** The meaning of the query, in plain English, used for the vector search. */
  semanticQuery: z.string().max(200).default(''),
});

export type Filters = z.infer<typeof FiltersSchema>;
export const emptyFilters = (): Filters => FiltersSchema.parse({});

/** Ensures the safety-relevant parts of `rules` are never lost when merging in an AI result. */
export function mergeSafety(ai: Filters, rules: Filters): Filters {
  return {
    ...ai,
    excludeAllergens: [...new Set([...ai.excludeAllergens, ...rules.excludeAllergens])],
    vegetarian: ai.vegetarian || rules.vegetarian || ai.vegan || rules.vegan,
    vegan: ai.vegan || rules.vegan,
    maxPrice: ai.maxPrice ?? rules.maxPrice,
    minPrice: ai.minPrice ?? rules.minPrice,
    maxSpice: ai.maxSpice ?? rules.maxSpice,
    minSpice: ai.minSpice ?? rules.minSpice,
  };
}
