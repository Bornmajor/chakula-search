import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Rpc } from '@/lib/search';

const root = path.resolve(__dirname, '..');
const sql = (f: string) => readFileSync(path.join(root, f), 'utf8');

const PG_TYPES: Record<string, string> = {
  p_max_price: 'int', p_min_price: 'int', p_vegetarian: 'boolean', p_vegan: 'boolean',
  p_exclude_allergens: 'text[]', p_min_spice: 'int', p_max_spice: 'int', p_tags: 'text[]',
  p_keywords: 'text[]', p_strict_keywords: 'boolean', p_query_embedding: 'vector(384)', p_limit: 'int',
};

/** A real Postgres + pgvector running in-process, loaded with the exact migration and seed the app uses. */
export async function createTestDb() {
  const db = await PGlite.create({ extensions: { vector } });
  await db.exec(sql('supabase/migrations/001_tables_and_search.sql'));
  await db.exec(sql('supabase/seed.sql'));

  const rpc: Rpc = async (fn, args) => {
    try {
      const keys = Object.keys(args);
      const named = keys.map((k, i) => `${k} => $${i + 1}::${PG_TYPES[k]}`).join(', ');
      const res = await db.query(`select * from ${fn}(${named})`, keys.map((k) => args[k]));
      return { data: res.rows, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  };
  return { db, rpc };
}
