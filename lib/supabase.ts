import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export const hasSupabaseEnv = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** One shared anon client. What it may do is decided by Row Level Security, not by hiding the key. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return client;
}

/** Public URL for a file in the dish-images bucket (the DB stores only the path). */
export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dish-images/${path}`;
}

export const DISH_COLUMNS =
  'id,slug,name,description,category,price,spice_level,is_vegetarian,is_vegan,allergens,tags,image_path,sold_out';
