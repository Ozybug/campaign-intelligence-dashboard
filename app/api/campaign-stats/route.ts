import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const MOENGAGE_APP_ID = process.env.MOENGAGE_APP_ID || '';
const MOENGAGE_SECRET_KEY = process.env.MOENGAGE_SECRET_KEY || '';
const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL || 'https://api-03.moengage.com';

function getAuthHeader(): string {
    const credentials = `${MOENGAGE_APP_ID}:${MOENGAGE_SECRET_KEY}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
}

/**
 * GET /api/campaign-stats?campaignId=<id>&channel=<channel>
 *
 * Fetches campaign performance stats from MoEngage:
 *   GET /v4/campaigns/info/<channel>/<campaignId>?attribution_type=click_through
 *
 * Maps ONLY the fields that MoEngage natively shows in its UI:
 *   - attempted      (Attempted)
 *   - sent           (Sent)
 *   - failedToSend   (Failed To Send)
 *   - impressions    (Impressions)
 *   - clicks         (Clicked)
 *   - ctr            (CTR %)
 *
 * No fabricated metrics (delivered, conversions, revenue, conversionRate)
 * are included — those are not shown in the MoEngage campaign analytics UI
 * and would be made-up data.
 */
export async function GET(req: NextRequest) {
    try {
          const { searchParams } = new URL(req.url);
          const campaignId = searchParams.get('campaignId');
          const channel = (searchParams.get('channel') || 'push').toLowerCase();
          const attribution = 'click_through';

      if (!campaignId) {
              return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
      }

      // If no API credentials configured, return empty stats (no fake data)
      if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
              return NextResponse.json({
                        campaignId,
                        attribution,
                        source: 'no_credentials',
                        error: 'MoEngage API credentials not configured',
              });
      }

      const channelPath = mapChannelToPath(channel);

      // GET /v4/campaigns/info/{channel}/{campaign_id}?attribution_type=click_through
      const url = `${MOENGAGE_BASE_URL}/v4/campaigns/info/${channelPath}/${campaignId}`;

      const response = await axios.get(url, {
              params: { attribution_type: attribution },
              headers: {
                        'Authorization': getAuthHeader(),
                        'MOE-APPKEY': MOENGAGE_APP_ID,
                        'Content-Type': 'application/json',
              },
              timeout: 15000,
      });

      const data = response.data;
          const stats = parseStats(campaignId, data, attribution);

      return NextResponse.json({
              ...stats,
              campaignData: data,
      });
    } catch (error: any) {
          const status = error?.response?.status;
          const campaignId = new URL(req.url).searchParams.get('campaignId') || 'unknown';

      console.error('[API/campaign-stats]', error?.response?.data || error?.message);

      // Return an error response — never fall back to fake/mock data
      return NextResponse.json(
        {
                  campaignId,
                  source: 'error',
                  error: `MoEngage API returned ${status || 'unknown error'}: ${error?.response?.data?.message || error?.message}`,
        },
        { status: status === 404 || status === 422 ? 404 : 500 }
            );
    }
}

function mapChannelToPath(channel: string): string {
    const map: Record<string, string> = {
          push: 'push',
          email: 'email',
          sms: 'sms',
          whatsapp: 'whatsapp',
          'in-app': 'inapp',
          inapp: 'inapp',
          web: 'web',
    };
    return map[channel.toLowerCase()] || 'push';
}

/**
 * Parse the MoEngage /v4/campaigns/info response into only the metrics
 * that are natively visible in the MoEngage Campaign Analytics UI:
 *
 *  Delivery section:
 *    attempted     -> performance_stats.attempted / total_attempted / push_attempted
 *    sent          -> performance_stats.sent / total_sent / push_sent
 *    failedToSend  -> performance_stats.failed_to_send / bounced / failed / not_sent
 *
 *  Engagement section:
 *    impressions   -> performance_stats.impressions / total_impressions / push_impressions
 *    clicks        -> performance_stats.clicks / total_clicks / click_count
 *    ctr           -> performance_stats.ctr / click_rate, or computed as clicks/impressions
 *
 * Metrics NOT included (not shown in MoEngage UI): delivered, conversions, revenue, conversionRate
 */
function parseStats(campaignId: string, data: any, attribution: string) {
    // MoEngage may nest stats under different keys depending on version/channel
  const perf =
        data?.performance_stats ||
        data?.stats ||
        data?.campaign_stats ||
        data?.analytics ||
        data;

  // --- Delivery ---
  const attempted =
        perf?.attempted ??
        perf?.total_attempted ??
        perf?.push_attempted ??
        perf?.target_count ??
        undefined;

  const sent =
        perf?.sent ??
        perf?.total_sent ??
        perf?.push_sent ??
        undefined;

  const failedToSend =
        perf?.failed_to_send ??
        perf?.failed ??
        perf?.bounced ??
        perf?.not_sent ??
        perf?.failure_count ??
        (attempted !== undefined && sent !== undefined ? attempted - sent : undefined);

  // --- Engagement ---
  const impressions =
        perf?.impressions ??
        perf?.total_impressions ??
        perf?.push_impressions ??
        perf?.delivered ??          // for push, impressions ≈ delivered (notification shown)
        undefined;

  const clicks =
        perf?.clicks ??
        perf?.total_clicks ??
        perf?.click_count ??
        perf?.clicked ??
        undefined;

  // CTR: prefer native value, else compute from clicks/impressions
  const ctrRaw =
        perf?.ctr ??
        perf?.click_rate ??
        perf?.click_through_rate ??
        undefined;

  const ctr =
        ctrRaw !== undefined
        ? Number(ctrRaw)
          : clicks !== undefined && impressions !== undefined && impressions > 0
        ? Number(((clicks / impressions) * 100).toFixed(2))
          : undefined;

  return {
        campaignId,
        attribution,
        source: 'moengage_live',
        // Delivery
        ...(attempted !== undefined && { attempted }),
        ...(sent !== undefined && { sent }),
        ...(failedToSend !== undefined && { failedToSend }),
        // Engagement
        ...(impressions !== undefined && { impressions }),
        ...(clicks !== undefined && { clicks }),
        ...(ctr !== undefined && { ctr }),
  };
}
