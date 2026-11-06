'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase, hasSupabaseEnv } from '@/lib/supabase';

type Top = { query: string; searches: number; avg_results: number };
type Zero = { query: string; searches: number; last_seen: string };

export default function Insights() {
  const [top, setTop] = useState<Top[]>([]);
  const [zero, setZero] = useState<Zero[]>([]);
  const [note, setNote] = useState('Loading…');

  useEffect(() => {
    if (!hasSupabaseEnv()) return setNote('Supabase is not configured.');
    const sb = getSupabase();
    (async () => {
      const [t, z] = await Promise.all([sb.from('top_searches').select('*'), sb.from('zero_result_searches').select('*')]);
      // Row Level Security only lets a signed-in admin read the log; anonymous visitors get nothing.
      setTop((t.data as Top[]) ?? []);
      setZero((z.data as Zero[]) ?? []);
      setNote(t.error || z.error ? 'Could not load. Are you signed in as admin?' : '');
    })();
  }, []);

  return (
    <main className="wrap admin">
      <Link href="/admin" className="muted">← Menu admin</Link>
      <h1>Search insights</h1>
      {note && <p className="muted">{note}</p>}

      <h2>What customers want but you do not have</h2>
      <p className="muted">Searches that returned zero dishes. Each row is a menu idea.</p>
      <table>
        <thead><tr><th>Search</th><th>Times</th><th>Last seen</th></tr></thead>
        <tbody>{zero.map((r) => <tr key={r.query}><td>{r.query}</td><td>{r.searches}</td><td>{new Date(r.last_seen).toLocaleDateString()}</td></tr>)}</tbody>
      </table>

      <h2>Top searches</h2>
      <table>
        <thead><tr><th>Search</th><th>Times</th><th>Avg results</th></tr></thead>
        <tbody>{top.map((r) => <tr key={r.query}><td>{r.query}</td><td>{r.searches}</td><td>{r.avg_results}</td></tr>)}</tbody>
      </table>
    </main>
  );
}
