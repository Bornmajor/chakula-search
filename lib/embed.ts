/** Calls the `embed` Edge Function. Returns null on any failure so search degrades to tags/keywords. */
export async function embedText(text: string, timeoutMs = 2000): Promise<number[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !text.trim()) return null;
  try {
    const res = await fetch(`${url}/functions/v1/embed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const { embedding } = (await res.json()) as { embedding?: number[] };
    return Array.isArray(embedding) && embedding.length === 384 ? embedding : null;
  } catch {
    return null;
  }
}
