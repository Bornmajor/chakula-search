import { NextResponse } from 'next/server';
import { FiltersSchema } from '@/lib/filters';
import { understandQuery } from '@/lib/understand';
import { searchDishes } from '@/lib/search';
import { suggestRelaxations } from '@/lib/relax';
import { embedText } from '@/lib/embed';
import { whyItMatches } from '@/lib/why';
import { getSupabase, hasSupabaseEnv } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Tiny per-instance rate limit so a bot can't burn your Claude credits.
// (On serverless this is per instance; use Upstash/Redis for a hard limit.)
const hits = new Map<string, number[]>();
function limited(ip: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
}

export async function POST(req: Request) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: 'Supabase is not configured. See README.' }, { status: 503 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return NextResponse.json({ error: 'Too many searches. Try again in a minute.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const query = String(body.query ?? '').trim().slice(0, 200);
  if (!query) return NextResponse.json({ error: 'Type what you feel like eating.' }, { status: 400 });

  // 1. Understand: either the user's edited chips (no AI call) or Claude (with rule-parser fallback).
  let mode: 'ai' | 'fallback' | 'edited';
  let filters;
  if (body.filters) {
    const parsed = FiltersSchema.safeParse(body.filters);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid filters' }, { status: 400 });
    filters = parsed.data;
    mode = 'edited';
  } else {
    const r = await understandQuery(query, { apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL });
    filters = r.filters;
    mode = r.mode;
  }

  // 2. Embed the English meaning of the query (null if the function is unavailable: ranking still works).
  const semantic = filters.semanticQuery || [...filters.tags, ...filters.keywords].join(' ');
  const embedding = semantic ? await embedText(semantic) : null;

  // 3. Hard filters + ranking happen in SQL.
  const sb = getSupabase();
  const rpc = (fn: string, args: Record<string, unknown>) => sb.rpc(fn, args);
  const rows = await searchDishes(rpc, filters, { embedding });
  const withWhy = (list: typeof rows) => list.map(({ score: _s, ...d }) => ({ ...d, why: whyItMatches(d, filters) }));

  // 4. Nothing found: suggest loosening one preference (never an allergen).
  const relaxations = rows.length === 0 ? await suggestRelaxations(rpc, filters, embedding) : [];

  // 5. Log for the owner's insights. Never let logging break a search.
  await sb.from('searches').insert({ query, filters, result_count: rows.length, mode }).then(() => {}, () => {});

  return NextResponse.json({
    mode,
    filters,
    results: withWhy(rows),
    relaxations: relaxations.map((r) => ({ label: r.label, filters: r.filters, results: r.results.map(({ score: _s, ...d }) => ({ ...d, why: whyItMatches(d, r.filters) })) })),
  });
}
