import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── JWT helpers using Web Crypto API (bypasses OpenSSL / gRPC issues) ────────

function base64url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function makeJWT(
  email: string,
  rawKey: string,
  scope: string
): Promise<string> {
  // Normalise \n literals that Vercel stores in env vars
  const pem = rawKey.includes('\\n')
    ? rawKey.replace(/\\n/g, '\n')
    : rawKey;

  // Strip PEM header/footer and decode the DER body
  const der = Buffer.from(
    pem
      .replace(/-----BEGIN[^-]+-----/g, '')
      .replace(/-----END[^-]+-----/g, '')
      .replace(/\s+/g, ''),
    'base64'
  );

  // Import the key with Web Crypto — this works with both PKCS#1 and PKCS#8
  // Try PKCS#8 first, fall back to PKCS#1 (via pkcs8 wrapper)
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  } catch {
    // PKCS#1 keys need wrapping in a PKCS#8 envelope
    const pkcs8Header = Buffer.from(
      '308204be020100300d06092a864886f70d0101010500',
      'hex'
    );
    // Simple approach: use SubtleCrypto with raw PKCS#1 — not supported directly
    // Instead, reconstruct using spki approach
    throw new Error(
      'Private key is in PKCS#1 format. Please convert to PKCS#8 in Vercel env vars. ' +
      'Run: openssl pkcs8 -topk8 -nocrypt -in key.pem -out key_pkcs8.pem'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iss: email,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    )
  );

  const sigInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(sigInput)
  );

  return `${sigInput}.${base64url(sig)}`;
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const jwt = await makeJWT(
    email,
    privateKey,
    'https://www.googleapis.com/auth/analytics.readonly'
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

async function ga4Report(
  accessToken: string,
  property: string,
  body: object
) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 runReport failed (${res.status}): ${err}`);
  }
  return res.json();
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const hasCredentials =
    process.env.GA_PROPERTY_ID &&
    process.env.GA_CLIENT_EMAIL &&
    process.env.GA_PRIVATE_KEY;

  if (!hasCredentials) {
    return NextResponse.json(
      {
        error: 'GA4 credentials not configured',
        missing: {
          GA_PROPERTY_ID: !process.env.GA_PROPERTY_ID,
          GA_CLIENT_EMAIL: !process.env.GA_CLIENT_EMAIL,
          GA_PRIVATE_KEY: !process.env.GA_PRIVATE_KEY,
        },
      },
      { status: 503 }
    );
  }

  try {
    const email = process.env.GA_CLIENT_EMAIL!;
    const key = process.env.GA_PRIVATE_KEY!;
    const property = `properties/${process.env.GA_PROPERTY_ID}`;
    const dateRanges = [{ startDate: '30daysAgo', endDate: 'today' }];

    const accessToken = await getAccessToken(email, key);

    const [report, pagesReport, sourceReport] = await Promise.all([
      ga4Report(accessToken, property, {
        dateRanges,
        metrics: [
          { name: 'activeUsers' }, { name: 'sessions' },
          { name: 'conversions' }, { name: 'totalRevenue' },
          { name: 'bounceRate' }, { name: 'averageSessionDuration' },
          { name: 'screenPageViews' }, { name: 'newUsers' },
        ],
      }),
      ga4Report(accessToken, property, {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5,
      }),
      ga4Report(accessToken, property, {
        dateRanges,
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5,
      }),
    ]);

    const row = report.rows?.[0];
    const mv = (i: number) => row?.metricValues?.[i]?.value ?? '0';

    return NextResponse.json({
      propertyId: process.env.GA_PROPERTY_ID,
      dateRange: '30daysAgo to today',
      fetchedAt: new Date().toISOString(),
      summary: {
        activeUsers: parseInt(mv(0)),
        sessions: parseInt(mv(1)),
        conversions: parseInt(mv(2)),
        revenue: parseFloat(mv(3)),
        bounceRate: parseFloat(mv(4)),
        avgSessionDuration: parseFloat(mv(5)),
        pageViews: parseInt(mv(6)),
        newUsers: parseInt(mv(7)),
      },
      topPages: (pagesReport.rows ?? []).map((r: { dimensionValues?: {value?: string}[], metricValues?: {value?: string}[] }) => ({
        page: r.dimensionValues?.[0]?.value ?? '/',
        views: parseInt(r.metricValues?.[0]?.value ?? '0'),
        users: parseInt(r.metricValues?.[1]?.value ?? '0'),
      })),
      topSources: (sourceReport.rows ?? []).map((r: { dimensionValues?: {value?: string}[], metricValues?: {value?: string}[] }) => ({
        source: r.dimensionValues?.[0]?.value ?? 'unknown',
        sessions: parseInt(r.metricValues?.[0]?.value ?? '0'),
        users: parseInt(r.metricValues?.[1]?.value ?? '0'),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'GA4 API call failed', detail: message },
      { status: 500 }
    );
  }
}
