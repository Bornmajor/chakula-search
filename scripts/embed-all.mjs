// Backfill embeddings for dishes that have none (e.g. right after running seed.sql).
// Run: npm run embed:all   (needs the `embed` Edge Function deployed + SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: dishes, error } = await sb.from('dishes').select('id,name,description,category,tags').is('embedding', null);
if (error) throw error;

for (const d of dishes) {
  // Must match the text built in app/admin/page.tsx
  const input = `${d.name}. ${d.description} ${d.category}. ${d.tags.join(' ')}`;
  const res = await fetch(`${url}/functions/v1/embed`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) { console.error(`✗ ${d.name}: HTTP ${res.status}`); continue; }
  const { embedding } = await res.json();
  const { error: e } = await sb.from('dishes').update({ embedding: JSON.stringify(embedding) }).eq('id', d.id);
  console.log(e ? `✗ ${d.name}: ${e.message}` : `✓ ${d.name}`);
}
