// Supabase Edge Function: text -> 384-d embedding using the built-in gte-small model (free, no API key).
// Deploy: supabase functions deploy embed
// gte-small is English-only, so Claude translates the query to English before we call this.
const session = new (globalThis as any).Supabase.ai.Session('gte-small');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const { input } = await req.json();
  if (typeof input !== 'string' || !input.trim()) {
    return new Response(JSON.stringify({ error: 'input required' }), { status: 400, headers: cors });
  }
  const embedding = await session.run(input.slice(0, 500), { mean_pool: true, normalize: true });
  return new Response(JSON.stringify({ embedding }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
