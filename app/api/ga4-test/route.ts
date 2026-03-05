import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

/** Normalise GA_PRIVATE_KEY — handle literal \n stored by Vercel */
function getPrivateKey(): string {
  const raw = process.env.GA_PRIVATE_KEY ?? '';
  // Vercel stores env vars with literal \n — convert to real newlines
  return raw.replace(/\\n/g, '\n');
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
    // Use googleapis JWT auth — uses node crypto directly, avoids gRPC/google-gax
    const auth = new google.auth.JWT({
      email: process.env.GA_CLIENT_EMAIL,
      key: getPrivateKey(),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    // Use the analyticsdata v1beta REST API via googleapis
    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
    const property = `properties/${process.env.GA_PROPERTY_ID}`;

    const [report, pagesReport, sourceReport] = await Promise.all([
      analyticsdata.properties.runReport({
        property,
        requestBody: {
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
        },
      }),
      analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 5,
        },
      }),
      analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'sessionSource' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 5,
        },
      }),
    ]);

    const row = report.data.rows?.[0];
    const mv = (i: number) => row?.metricValues?.[i]?.value ?? '0';

    const topPages = (pagesReport.data.rows ?? []).map((r) => ({
      page: r.dimensionValues?.[0]?.value ?? '/',
      views: parseInt(r.metricValues?.[0]?.value ?? '0'),
      users: parseInt(r.metricValues?.[1]?.value ?? '0'),
    }));

    const topSources = (sourceReport.data.rows ?? []).map((r) => ({
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
