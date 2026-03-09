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

export async function getDestinationVisitors(): Promise<DestinationVisitorRow[]> {
  if (!METABASE_USERNAME || !METABASE_PASSWORD) {
    console.log('[Metabase] No credentials configured, skipping fetch');
    return [];
  }
  try {
    const sessionToken = await getMetabaseSession();
    const res = await fetch(`${METABASE_URL}/api/card/520/query/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Metabase-Session': sessionToken,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`[Metabase] Query error: ${res.status}`);
    return await res.json() as DestinationVisitorRow[];
  } catch (e) {
    console.error('[Metabase] fetch error:', e);
    return [];
  }
}
