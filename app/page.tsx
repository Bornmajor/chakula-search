'use client';

import { useState } from 'react';
import { DishCard } from '@/components/DishCard';
import { chipsFor } from '@/lib/chips';
import type { Filters } from '@/lib/filters';
import type { DishWithWhy } from '@/lib/types';

type Relax = { label: string; filters: Filters; results: DishWithWhy[] };
type Payload = { mode: 'ai' | 'fallback' | 'edited'; filters: Filters; results: DishWithWhy[]; relaxations: Relax[] };

const EXAMPLES = [
  'something spicy and filling under 800',
  'vegetarian lunch, no nuts',
  'comfort food for a rainy day',
  'something for kids',
  'kitu ya kushiba bila nyama',
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run(q: string, filters?: Filters) {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setAsked(q);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, filters }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Search failed');
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const chips = data ? chipsFor(data.filters) : [];

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Chakula Finder</h1>
        <p>Tell us what you feel like, in English, Swahili or Sheng.</p>
      </header>

      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); run(query); }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. something filling under 800, no nuts"
          aria-label="Search the menu"
          maxLength={200}
        />
        <button disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {!data && (
        <div className="examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip example" onClick={() => { setQuery(ex); run(ex); }}>{ex}</button>
          ))}
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {data && (
        <section>
          <div className="understood">
            <span className="muted">We understood:</span>
            {chips.length === 0 && <span className="muted">no specific filters</span>}
            {chips.map((c) => (
              <button key={c.key} className="chip" title="Tap to remove" onClick={() => run(asked, c.remove(data.filters))}>
                {c.label} <span aria-hidden>×</span>
              </button>
            ))}
            {data.mode === 'fallback' && <span className="badge" title="The AI was unavailable, so we used keyword matching">basic search</span>}
          </div>

          {data.results.length > 0 ? (
            <div className="grid">{data.results.map((d) => <DishCard key={d.id} dish={d} />)}</div>
          ) : (
            <div className="empty">
              <h2>No dishes match all of that</h2>
              {data.relaxations.length === 0 && <p className="muted">Try removing a filter above, or searching for something different.</p>}
              {data.relaxations.map((r) => (
                <div key={r.label} className="relax">
                  <button className="link" onClick={() => run(asked, r.filters)}>{r.label} →</button>
                  <div className="grid small">{r.results.map((d) => <DishCard key={d.id} dish={d} />)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
