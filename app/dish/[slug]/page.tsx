import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DishPhoto } from '@/components/DishCard';
import { DISH_COLUMNS, getSupabase, hasSupabaseEnv } from '@/lib/supabase';
import type { Dish } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SPICE = ['Not spicy', 'Mild', 'Spicy', 'Very spicy'];

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!hasSupabaseEnv()) notFound();
  const { data } = await getSupabase().from('dishes').select(DISH_COLUMNS).eq('slug', slug).maybeSingle();
  const dish = data as Dish | null;
  if (!dish) notFound();

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '254700000000';
  const text = encodeURIComponent(`Hi! I'd like to order: ${dish.name} (KES ${dish.price}).`);

  return (
    <main className="wrap narrow">
      <Link href="/" className="muted">← Back to search</Link>
      <DishPhoto dish={dish} size="hero" />
      <div className="row">
        <h1>{dish.name}</h1>
        <strong className="price">KES {dish.price}</strong>
      </div>
      <p>{dish.description}</p>
      <ul className="facts">
        <li>🌶️ {SPICE[dish.spice_level]}</li>
        <li>{dish.is_vegan ? '🌱 Vegan' : dish.is_vegetarian ? '🥕 Vegetarian' : '🍖 Contains meat or fish'}</li>
        <li>⚠️ Allergens: {dish.allergens.length ? dish.allergens.join(', ') : 'none listed'}</li>
      </ul>
      {dish.sold_out ? (
        <p className="badge">Sold out today</p>
      ) : (
        <a className="order" href={`https://wa.me/${phone}?text=${text}`} target="_blank" rel="noreferrer">
          Order on WhatsApp
        </a>
      )}
    </main>
  );
}
