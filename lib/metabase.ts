const METABASE_URL = process.env.METABASE_URL || 'https://metabase.zo.xyz';
const METABASE_USERNAME = process.env.METABASE_USERNAME || '';
const METABASE_PASSWORD = process.env.METABASE_PASSWORD || '';

export interface DestinationVisitorRow {
  destination: string;
  property: string | null;
  delta_pct_past7days: number;
  destination_unique_visitors: number | null;
  property_unique_visitors: number | null;
  instagram_users: number | null;
  meta_ads_users: number | null;
  center_users: number | null;
}

async function getMetabaseSession(): Promise<string> {
  const res = await fetch(`${METABASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: METABASE_USERNAME, password: METABASE_PASSWORD }),
  });
  if (!res.ok) throw new Error(`[Metabase] Session error: ${res.status}`);
  const { id } = await res.json();
  return id as string;
}

export async function getDestinationVisitors(
  startDate?: string | null,
  endDate?: string | null
): Promise<DestinationVisitorRow[]> {
  if (!METABASE_USERNAME || !METABASE_PASSWORD) {
    console.log('[Metabase] No credentials configured, skipping fetch');
    return [];
  }

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const defaultEnd = fmt(today);
  const defaultStart = fmt(new Date(today.getTime() - 6 * 86400000));

  const start = startDate || defaultStart;
  const end = endDate || defaultEnd;

  try {
    const sessionToken = await getMetabaseSession();
    // Use /api/card/:id/query endpoint with the parameter format Metabase expects
    const res = await fetch(`${METABASE_URL}/api/card/520/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken,
      },
      body: JSON.stringify({
        ignore_cache: false,
        collection_preview: false,
        parameters: [
          {
            id: 'start_date',
            type: 'category',
            target: ['variable', ['template-tag', 'start_date']],
            value: start,
          },
          {
            id: 'end_date',
            type: 'category',
            target: ['variable', ['template-tag', 'end_date']],
            value: end,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`[Metabase] Query error: ${res.status}`);
    const payload = await res.json();
    // /api/card/:id/query returns { data: { rows, cols } } — normalise to row objects
    if (payload && payload.data && Array.isArray(payload.data.rows)) {
      const cols: string[] = payload.data.cols.map((c: { name: string }) => c.name);
      return payload.data.rows.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        cols.forEach((col, i) => { obj[col] = row[i]; });
        return obj as unknown as DestinationVisitorRow;
      });
    }
    // Fallback: if it's already an array (e.g. /query/json format)
    if (Array.isArray(payload)) return payload as DestinationVisitorRow[];
    return [];
  } catch (e) {
    console.error('[Metabase] fetch error:', e);
    return [];
  }
}
