import Image from 'next/image';
import Link from 'next/link';
import { imageUrl } from '@/lib/supabase';
import type { DishWithWhy } from '@/lib/types';

const EMOJI: Record<string, string> = {
  Grill: '🍖', Traditional: '🍲', Rice: '🍛', Seafood: '🐟', Snacks: '🥟', 'Street Food': '🍟',
  Salads: '🥗', Curries: '🍛', Soups: '🍜', 'Fast Food': '🍔', Wraps: '🌯',
};

export function DishPhoto({ dish, size = 'card' }: { dish: Pick<DishWithWhy, 'name' | 'image_path' | 'category'>; size?: 'card' | 'hero' }) {
  const src = imageUrl(dish.image_path);
  return (
    <div className={`photo ${size}`}>
      {src ? (
        <Image src={src} alt={dish.name} fill sizes="(max-width: 700px) 100vw, 360px" style={{ objectFit: 'cover' }} />
      ) : (
        <span className="emoji" aria-hidden>{EMOJI[dish.category] ?? '🍽️'}</span>
      )}
    </div>
  );
}

export function DishCard({ dish }: { dish: DishWithWhy }) {
  return (
    <Link href={`/dish/${dish.slug}`} className="card">
      <DishPhoto dish={dish} />
      <div className="card-body">
        <div className="row">
          <h3>{dish.name}</h3>
          <strong>KES {dish.price}</strong>
        </div>
        <p className="why">{dish.why}</p>
        <p className="desc">{dish.description}</p>
      </div>
    </Link>
  );
}
