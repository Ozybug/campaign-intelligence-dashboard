import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const MOENGAGE_APP_ID = process.env.MOENGAGE_APP_ID || '';
const MOENGAGE_SECRET_KEY = process.env.MOENGAGE_SECRET_KEY || '';
const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL || 'https://api-03.moengage.com';
// Dashboard base URL (for internal stats API fallback)
const MOENGAGE_DASH_URL = MOENGAGE_BASE_URL.replace('api-', 'dashboard-');

function getAuthHeader(): string {
  const credentials = `${MOENGAGE_APP_ID}:${MOENGAGE_SECRET_KEY}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * GET /api/campaign-stats?campaignId=<id>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>
 *
 * Fetches campaign performance stats from MoEngage.
 * Primary: POST /core-services/v1/campaign-stats (Stats API)
 * Fallback: POST /v1/stats/performance_stats/summary (internal dashboard API)
 *
 * Maps ONLY the fields that MoEngage natively shows in its UI:
 * - attempted (Attempted)
 * - sent (Sent)
 * - failedToSend (Failed To Send)
 * - impressions (Impressions)
 * - clicks (Clicked)
 * - ctr (CTR %)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const attribution = 'CLICK_THROUGH';

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
      return NextResponse.json({
        campaignId,
        attribution,
        source: 'no_credentials',
        error: 'MoEngage API credentials not configured',
      });
    }

    const endDate = searchParams.get('end') || new Date().toISOString().slice(0, 10);
    const startDateParam = searchParams.get('start');
    let startDate: string;
    if (startDateParam) {
      startDate = startDateParam.slice(0, 10);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().slice(0, 10);
    }

    const authHeader = getAuthHeader();
    const commonHeaders = {
      'Authorization': authHeader,
      'MOE-APPKEY': MOENGAGE_APP_ID,
      'Content-Type': 'application/json',
    };

    // === Primary: Stats API ===
    try {
      const statsUrl = `${MOENGAGE_BASE_URL}/core-services/v1/campaign-stats`;
      const statsBody = {
        request_id: `req_${campaignId}_${Date.now()}`,
        campaign_ids: [campaignId],
        start_date: startDate,
        end_date: endDate,
        attribution_type: attribution,
        metric_type: 'TOTAL',
      };

      const statsResp = await axios.post(statsUrl, statsBody, {
        headers: commonHeaders,
        timeout: 15000,
      });

      const stats = parseStatsResponse(campaignId, statsResp.data, attribution);
      return NextResponse.json(stats);
    } catch (statsErr: any) {
      const statsStatus = statsErr?.response?.status;
      // If 403 (plan not enabled) or 401 (auth), try fallback
      if (statsStatus !== 403 && statsStatus !== 401) throw statsErr;
      console.warn(`[API/campaign-stats] Stats API returned ${statsStatus}, trying internal dashboard API`);
    }

    // === Fallback: Internal dashboard performance_stats API ===
    // This endpoint is used by the MoEngage dashboard itself
    const dashUrl = `${MOENGAGE_DASH_URL}/v1/stats/performance_stats/summary`;
    const dashBody = {
      campaign_id: campaignId,
      start_date: startDate,
      end_date: endDate,
      metric_type: 'TOTAL',
    };

    const dashResp = await axios.post(dashUrl, dashBody, {
      headers: commonHeaders,
      timeout: 15000,
    });

    const stats = parseDashboardStatsResponse(campaignId, dashResp.data, attribution);
    return NextResponse.json(stats);

  } catch (error: any) {
    const status = error?.response?.status;
    const campaignId = new URL(req.url).searchParams.get('campaignId') || 'unknown';
    console.error('[API/campaign-stats]', error?.response?.data || error?.message);

    return NextResponse.json(
      {
        campaignId,
        source: 'error',
        error: `MoEngage API returned ${status || 'unknown error'}: ${error?.response?.data?.description || error?.response?.data?.message || error?.message}`,
      },
      { status: status === 404 || status === 422 ? 404 : 500 }
    );
  }
}

/**
 * Parse the MoEngage POST /core-services/v1/campaign-stats response.
 */
function parseStatsResponse(campaignId: string, data: any, attribution: string) {
  const campaignEntries: any[] = data?.data?.[campaignId] ?? [];

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let impressions = 0;
  let clicks = 0;
  let ctrSum = 0;
  let ctrCount = 0;

  for (const entry of campaignEntries) {
    const platforms = entry?.platforms ?? {};
    for (const platformKey of Object.keys(platforms)) {
      const platform = platforms[platformKey];
      const locales = platform?.locales ?? {};
      for (const localeKey of Object.keys(locales)) {
        const locale = locales[localeKey];
        const allVariations = locale?.variations?.all_variations ?? {};
        const perf = allVariations?.performance_stats ?? {};
        const funnel = allVariations?.delivery_funnel ?? {};

        attempted += perf?.attempted ?? 0;
        sent += perf?.sent ?? 0;
        failed += perf?.failed ?? perf?.failure ?? 0;
        impressions += perf?.impression ?? perf?.impressions ?? funnel?.impressions ?? 0;
        clicks += perf?.click ?? perf?.clicks ?? 0;

        if (typeof perf?.ctr === 'number' && perf.ctr > 0) {
          ctrSum += perf.ctr;
          ctrCount++;
        }
      }
    }
  }

  return buildResult(campaignId, attribution, 'moengage_live', attempted, sent, failed, impressions, clicks, ctrSum, ctrCount);
}

/**
 * Parse the MoEngage internal dashboard /v1/stats/performance_stats/summary response.
 */
function parseDashboardStatsResponse(campaignId: string, data: any, attribution: string) {
  // The dashboard API returns a different shape - adapt as needed
  const perf = data?.performance_stats ?? data?.data?.performance_stats ?? data ?? {};
  const funnel = data?.delivery_funnel ?? data?.data?.delivery_funnel ?? {};

  const attempted = perf?.attempted ?? 0;
  const sent = perf?.sent ?? 0;
  const failed = perf?.failed ?? perf?.failure ?? 0;
  const impressions = perf?.impression ?? perf?.impressions ?? funnel?.impressions ?? 0;
  const clicks = perf?.click ?? perf?.clicks ?? 0;
  const ctrVal = typeof perf?.ctr === 'number' ? perf.ctr : 0;

  return buildResult(campaignId, attribution, 'moengage_dashboard', attempted, sent, failed, impressions, clicks, ctrVal, ctrVal > 0 ? 1 : 0);
}

function buildResult(campaignId: string, attribution: string, source: string, attempted: number, sent: number, failed: number, impressions: number, clicks: number, ctrSum: number, ctrCount: number) {
  let ctr: number | undefined;
  if (ctrCount > 0) {
    ctr = Number((ctrSum / ctrCount).toFixed(2));
  } else if (clicks > 0 && impressions > 0) {
    ctr = Number(((clicks / impressions) * 100).toFixed(2));
  }

  const failedToSend = failed > 0
    ? failed
    : (attempted > 0 && sent > 0 ? attempted - sent : undefined);

  return {
    campaignId,
    attribution: attribution.toLowerCase(),
    source,
    ...(attempted > 0 && { attempted }),
    ...(sent > 0 && { sent }),
    ...(failedToSend !== undefined && failedToSend > 0 && { failedToSend }),
    ...(impressions > 0 && { impressions }),
    ...(clicks > 0 && { clicks }),
    ...(ctr !== undefined && { ctr }),
  };
}
