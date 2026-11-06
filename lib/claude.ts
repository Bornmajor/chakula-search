import { ALLERGENS, CHEAP_MAX_PRICE, FiltersSchema, TAGS, type Filters } from './filters';

/**
 * Query understanding with Claude, via a plain REST call (no SDK needed).
 * We force a tool call so the reply is structured JSON, then validate it with zod.
 * Anything wrong (timeout, HTTP error, bad JSON, schema mismatch) throws, and the
 * caller falls back to the rule parser.
 */
const SYSTEM = `You convert a restaurant customer's search into structured filters for a menu database.
Queries may be English, Swahili or Sheng (Kenyan slang), often mixed. Currency is Kenyan shillings (KES).
Rules:
- Only extract what the customer actually said. Never invent restrictions.
- "no nuts", "bila karanga", "allergic to X" => excludeAllergens. Peanuts, groundnuts, cashews, coconut count as "nuts".
- "bila nyama", "no meat", "mboga" => vegetarian=true. "vegan" => vegan=true and vegetarian=true.
- "cheap"/"rahisi"/"bei poa" => maxPrice ${CHEAP_MAX_PRICE}. "kali"/"spicy"/"pilipili" => minSpice 2. "not spicy"/"mild" => maxSpice 1.
- "kushiba"/"filling" => tag "filling". "comfort food" => tags comfort. "rainy day" => comfort + rainy-day. "for kids"/"watoto" => kids.
- Use only the allowed tags. Put leftover dish words (e.g. "chicken", "pizza", "fish") in keywords, in English when you can.
- semanticQuery: the meaning of the request in plain English, 3-12 words, no prices or allergens. Always translate Swahili/Sheng to English.
Always answer by calling set_filters.`;

const TOOL = {
  name: 'set_filters',
  description: 'Record the structured filters extracted from the customer query.',
  input_schema: {
    type: 'object',
    properties: {
      maxPrice: { type: ['integer', 'null'], description: 'KES upper bound' },
      minPrice: { type: ['integer', 'null'] },
      vegetarian: { type: 'boolean' },
      vegan: { type: 'boolean' },
      excludeAllergens: { type: 'array', items: { type: 'string', enum: [...ALLERGENS] } },
      minSpice: { type: ['integer', 'null'], description: '0-3' },
      maxSpice: { type: ['integer', 'null'], description: '0-3' },
      tags: { type: 'array', items: { type: 'string', enum: [...TAGS] } },
      keywords: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      semanticQuery: { type: 'string' },
    },
    required: ['vegetarian', 'vegan', 'excludeAllergens', 'tags', 'keywords', 'semanticQuery'],
  },
};

export type FetchLike = typeof fetch;

export async function claudeParse(
  query: string,
  opts: { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: FetchLike },
): Promise<Filters> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? 'claude-haiku-5-5',
      max_tokens: 400,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'set_filters' },
      messages: [{ role: 'user', content: query }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 3000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
  const block = data.content?.find((b) => b.type === 'tool_use');
  if (!block?.input) throw new Error('No tool_use block in response');
  return FiltersSchema.parse(block.input); // throws if the model returned something invalid
}
