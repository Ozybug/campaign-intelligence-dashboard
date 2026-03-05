import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Robustly decode the GA_PRIVATE_KEY from various Vercel env encodings */
function decodePrivateKey(raw: string): string {
  // 1. Try literal \n → newline (most common Vercel storage format)
  let key = raw.replace(/\\n/g, '\n');
  // 2. If still no real newlines, try replacing literal backslash-n
  if (!key.includes('\n')) {
    key = raw.split('\\n').join('\n');
  }
  // 3. Strip surrounding quotes that some env editors add
  key = key.replace(/^["']|["']$/g, '');
  return key;
}

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
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');

    const privateKey = decodePrivateKey(process.env.GA_PRIVATE_KEY!);

    const analytics = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA_CLIENT_EMAIL,
        private_key: privateKey,
      },
    });

    const [report] = await analytics.runReport({
      property: `properties/${process.env.GA_PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViews' },
        { name: 'newUsers' },
      ],
    });

    const row = report.rows?.[0];
    const mv = (i: number) => row?.metricValues?.[i]?.value ?? '0';

    const [pagesReport] = await analytics.runReport({
      property: `properties/${process.env.GA_PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 5,
    });

    const topPages = (pagesReport.rows ?? []).map((r) => ({
      page: r.dimensionValues?.[0]?.value ?? '/',
      views: parseInt(r.metricValues?.[0]?.value ?? '0'),
      users: parseInt(r.metricValues?.[1]?.value ?? '0'),
    }));

    const [sourceReport] = await analytics.runReport({
      property: `properties/${process.env.GA_PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 5,
    });

    const topSources = (sourceReport.rows ?? []).map((r) => ({
      source: r.dimensionValues?.[0]?.value ?? 'unknown',
      sessions: parseInt(r.metricValues?.[0]?.value ?? '0'),
      users: parseInt(r.metricValues?.[1]?.value ?? '0'),
    }));

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
      topPages,
      topSources,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'GA4 API call failed', detail: message },
      { status: 500 }
    );
  }
}
