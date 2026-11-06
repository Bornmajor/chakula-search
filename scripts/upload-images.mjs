// Bulk-upload photos from ./images into the dish-images bucket and link them to dishes.
// Name each file after the dish slug:  images/ugali-sukuma.jpg  ->  dishes.slug = 'ugali-sukuma'
// Run: npm run seed:images   (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dir = new URL('../images/', import.meta.url);
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

for (const file of readdirSync(dir)) {
  const ext = path.extname(file).toLowerCase();
  if (!types[ext]) continue;
  const slug = path.basename(file, ext);
  const { error: upErr } = await sb.storage.from('dish-images').upload(file, readFileSync(new URL(file, dir)), { contentType: types[ext], upsert: true });
  if (upErr) { console.error(`✗ ${file}: ${upErr.message}`); continue; }
  const { data, error } = await sb.from('dishes').update({ image_path: file }).eq('slug', slug).select('slug');
  if (error || !data?.length) console.error(`✗ ${file}: no dish with slug "${slug}"`);
  else console.log(`✓ ${file} -> ${slug}`);
}
