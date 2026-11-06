import { CHEAP_MAX_PRICE, emptyFilters, type Filters } from './filters';

/**
 * Deterministic query parser: English + common Swahili/Sheng phrases.
 * It has two jobs:
 *  1. the fallback when Claude is slow, down or returns something invalid;
 *  2. a safety net: allergen/diet words found here are ALWAYS merged into
 *     Claude's answer, so the AI can't drop a "no nuts".
 */
const NEG = '(?:no|without|avoid|avoiding|free of|free from|bila|sina|bila na|allergic to|allergy to|allergic|hakuna)';
const ALLERGEN_WORDS: Record<string, string> = {
  nuts: 'nuts?|peanuts?|groundnuts?|cashews?|almonds?|karanga|njugu',
  dairy: 'dairy|milk|lactose|cheese|maziwa|jibini',
  gluten: 'gluten|wheat|ngano',
  eggs: 'eggs?|mayai|yai',
  fish: 'fish|samaki',
  shellfish: 'shellfish|prawns?|shrimps?|crab|lobster|kamba',
  soy: 'soy|soya',
  sesame: 'sesame|simsim',
};

const STOPWORDS = new Set(
  ('something with without under below over above than less more food lunch dinner meal want need give please ' +
    'kitu ya na bila chini kwa the and for that not from have some kuna nataka chakula cha wa ni hii yenye ' +
    'very really good best nice any only just like free cost price bob kes ksh kshs under filling cheap spicy ' +
    'light hot mild kids comfort healthy rainy day vegetarian vegan meat nyama').split(' '),
);

const num = (s: string) => parseInt(s.replace(/,/g, ''), 10);

export function ruleParse(query: string): Filters {
  const f = emptyFilters();
  const q = ' ' + query.toLowerCase().replace(/[.,!?;:()]/g, ' ').replace(/\s+/g, ' ') + ' ';

  // Price
  const cur = '(?:kes|ksh|kshs|sh)?\\s*';
  const under = q.match(new RegExp(`(?:under|below|less than|within|max|up to|chini ya|si zaidi ya|<)\\s*${cur}(\\d[\\d,]*)`));
  if (under) f.maxPrice = num(under[1]);
  const over = q.match(new RegExp(`(?:over|above|more than|at least|(?<!si )zaidi ya|>)\\s*${cur}(\\d[\\d,]*)`));
  if (over) f.minPrice = num(over[1]);
  if (!f.maxPrice && /\b(cheap|cheaply|affordable|budget|rahisi|bei poa)\b/.test(q)) f.maxPrice = CHEAP_MAX_PRICE;

  // Diet
  if (/\bvegan\b/.test(q)) f.vegan = f.vegetarian = true;
  if (
    /\b(vegetarian|veggie|veg|meatless|mboga mboga)\b/.test(q) ||
    new RegExp(`${NEG}\\s+(?:any\\s+)?(?:meat|nyama)\\b`).test(q)
  ) {
    f.vegetarian = true;
  }

  // Allergens: only when negated ("no nuts", "bila karanga", "nut-free", "allergic to eggs").
  for (const [allergen, words] of Object.entries(ALLERGEN_WORDS)) {
    const negated = new RegExp(`${NEG}\\s+(?:any\\s+)?(?:${words})\\b`).test(q);
    const free = new RegExp(`\\b(?:${words})[- ]free\\b`).test(q); // "nut free", "dairy-free"
    if (negated || free) {
      f.excludeAllergens.push(allergen as Filters['excludeAllergens'][number]);
    }
  }

  // Spice
  const mild = /\b(not spicy|mild|isiyo kali|bila pilipili)\b/.test(q) || new RegExp(`${NEG}\\s+(?:chili|chilli|pepper|spice|pilipili)`).test(q);
  if (mild) f.maxSpice = 1;
  else if (/\b(spicy|hot|kali|pilipili|chilli|chili)\b/.test(q)) f.minSpice = 2;

  // Soft tags (ranking only)
  const tag = (t: Filters['tags'][number], re: RegExp) => re.test(q) && f.tags.push(t);
  tag('filling', /\b(filling|hearty|heavy|kushiba|ya kushiba|shiba)\b/);
  tag('comfort', /\b(comfort|comforting)\b|rainy|mvua/);
  tag('rainy-day', /\b(rainy|mvua|cold)\b/);
  tag('light', /\b(light|nyepesi|fresh)\b/);
  tag('healthy', /\b(healthy|afya)\b/);
  tag('kids', /\b(kids?|child|children|watoto|mtoto)\b/);
  tag('sharing', /\b(sharing|share|group|family|pamoja)\b/);
  tag('snack', /\b(snack|vitafunio)\b/);
  tag('breakfast', /\b(breakfast|kiamsha kinywa)\b/);
  tag('sweet', /\b(sweet|dessert|tamu)\b/);

  // Remaining content words become keywords (a name/description match boosts ranking).
  const used = /\d|^(no|bila|sina)$/;
  f.keywords = [
    ...new Set(
      q.split(' ')
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !used.test(w))
        .filter((w) => !Object.values(ALLERGEN_WORDS).some((re) => new RegExp(`^(?:${re})$`).test(w)))
        .filter((w) => !/^(nut|nuts)$/.test(w)),
    ),
  ].slice(0, 5);

  f.semanticQuery = [...f.tags, ...f.keywords].join(' ');
  return f;
}
