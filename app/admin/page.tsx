'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ALLERGENS, TAGS } from '@/lib/filters';
import { DISH_COLUMNS, getSupabase, hasSupabaseEnv } from '@/lib/supabase';
import type { Dish } from '@/lib/types';

type Draft = Omit<Dish, 'id'> & { id?: number; allergens_verified: boolean };

const blank: Draft = {
  slug: '', name: '', description: '', category: 'Traditional', price: 0, spice_level: 0,
  is_vegetarian: false, is_vegan: false, allergens: [], allergens_verified: false, tags: [],
  image_path: null, sold_out: false,
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function Admin() {
  const sb = hasSupabaseEnv() ? getSupabase() : null;
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!sb) return;
    const { data, error } = await sb.from('dishes').select(DISH_COLUMNS).order('name');
    if (error) setMsg(error.message);
    setDishes((data as Dish[]) ?? []);
  }, [sb]);

  useEffect(() => {
    if (!sb) return setSignedIn(false);
    sb.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    load();
    return () => sub.subscription.unsubscribe();
  }, [sb, load]);

  if (!sb) return <main className="wrap admin"><p>Supabase is not configured. See the README.</p></main>;
  if (signedIn === null) return <main className="wrap admin"><p className="muted">Loading…</p></main>;

  if (!signedIn) {
    return (
      <main className="wrap narrow admin">
        <h1>Admin sign in</h1>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const { error } = await sb.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) });
          setMsg(error ? error.message : '');
          if (!error) load();
        }}>
          <label className="full">Email<input name="email" type="email" required /></label>
          <label className="full">Password<input name="password" type="password" required /></label>
          <button className="btn full">Sign in</button>
        </form>
        {msg && <p className="error">{msg}</p>}
      </main>
    );
  }

  async function embed(d: { name: string; description: string; category: string; tags: string[] }) {
    // Same text we embed for every dish, so dish and query vectors live in the same space.
    const input = `${d.name}. ${d.description} ${d.category}. ${d.tags.join(' ')}`;
    const { data, error } = await sb!.functions.invoke('embed', { body: { input } });
    if (error || !data?.embedding) return null;
    return JSON.stringify(data.embedding);
  }

  async function save() {
    if (!draft) return;
    setMsg('Saving…');
    let image_path = draft.image_path;
    if (file) {
      // 1. Upload the file into the bucket; 2. store only its path in the table.
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${draft.slug || slugify(draft.name)}-${Date.now()}.${ext}`;
      const up = await sb!.storage.from('dish-images').upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) return setMsg(`Image upload failed: ${up.error.message}`);
      image_path = path;
    }
    const { id, ...fields } = draft;
    const row = { ...fields, slug: draft.slug || slugify(draft.name), image_path, embedding: await embed(draft) };
    const q = id ? sb!.from('dishes').update(row).eq('id', id) : sb!.from('dishes').insert(row);
    const { error } = await q;
    if (error) return setMsg(error.message);
    setMsg(row.embedding ? 'Saved, and search index updated.' : 'Saved. (Embedding service unavailable: tag and keyword search still work.)');
    setDraft(null);
    setFile(null);
    load();
  }

  async function toggleSold(d: Dish) {
    const { error } = await sb!.from('dishes').update({ sold_out: !d.sold_out }).eq('id', d.id);
    if (error) setMsg(error.message);
    load();
  }

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <main className="wrap admin">
      <div className="row">
        <h1>Menu admin</h1>
        <span>
          <Link href="/admin/insights" className="chip">Search insights</Link>{' '}
          <button className="chip" onClick={() => sb.auth.signOut()}>Sign out</button>
        </span>
      </div>
      {msg && <p className="muted" role="status">{msg}</p>}
      <button className="btn" onClick={() => setDraft({ ...blank })}>+ Add dish</button>

      {draft && (
        <form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>Name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Price (KES)<input required type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label>
          <label>Category<input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></label>
          <label>Spice (0-3)<input type="number" min={0} max={3} value={draft.spice_level} onChange={(e) => setDraft({ ...draft, spice_level: Number(e.target.value) })} /></label>
          <label className="full">Description<textarea required rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <div className="full">
            <strong>Diet</strong>{' '}
            <label><input type="checkbox" checked={draft.is_vegetarian} onChange={(e) => setDraft({ ...draft, is_vegetarian: e.target.checked })} /> Vegetarian</label>
            <label><input type="checkbox" checked={draft.is_vegan} onChange={(e) => setDraft({ ...draft, is_vegan: e.target.checked, is_vegetarian: e.target.checked || draft.is_vegetarian })} /> Vegan</label>
          </div>
          <div className="full">
            <strong>Allergens</strong>
            {ALLERGENS.map((a) => (
              <label key={a}><input type="checkbox" checked={draft.allergens.includes(a)} onChange={() => setDraft({ ...draft, allergens: toggle(draft.allergens, a) })} /> {a}</label>
            ))}
            <label><input type="checkbox" checked={draft.allergens_verified} onChange={(e) => setDraft({ ...draft, allergens_verified: e.target.checked })} />
              <b> I have checked these allergens</b> (unchecked dishes are hidden from allergen searches)</label>
          </div>
          <div className="full">
            <strong>Tags</strong>
            {TAGS.map((t) => (
              <label key={t}><input type="checkbox" checked={draft.tags.includes(t)} onChange={() => setDraft({ ...draft, tags: toggle(draft.tags, t) })} /> {t}</label>
            ))}
          </div>
          <label className="full">Photo<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {draft.image_path && !file && <span>Current: {draft.image_path}</span>}</label>
          <div className="full">
            <button className="btn">Save</button>{' '}
            <button type="button" className="btn ghost" onClick={() => { setDraft(null); setFile(null); }}>Cancel</button>
          </div>
        </form>
      )}

      <table>
        <thead><tr><th>Dish</th><th>KES</th><th>Status</th><th /></tr></thead>
        <tbody>
          {dishes.map((d) => (
            <tr key={d.id}>
              <td>{d.name}<br /><span className="muted">{d.category}</span></td>
              <td>{d.price}</td>
              <td>{d.sold_out ? <span className="badge">Sold out</span> : 'Available'}</td>
              <td>
                <button className="btn ghost" onClick={() => toggleSold(d)}>{d.sold_out ? 'Mark available' : 'Mark sold out'}</button>{' '}
                <button className="btn ghost" onClick={() => supabaseEdit(d)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );

  async function supabaseEdit(d: Dish) {
    // allergens_verified is not part of the public column list, so fetch it for the editor.
    const { data } = await sb!.from('dishes').select('allergens_verified').eq('id', d.id).single();
    setDraft({ ...d, allergens_verified: Boolean(data?.allergens_verified) });
  }
}
