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
 * GET /api/campaign-stats?campaignId=<id>&channel=<channel>&attribution=click_through
 *
 * Fetches campaign performance stats from MoEngage API:
 * GET /v4/campaigns/info/<channel>/<campaignId>
 *
 * Attribution is always forced to click_through as per requirement.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const channel = (searchParams.get('channel') || 'push').toLowerCase();
    // Attribution is always click_through
    const attribution = 'click_through';

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    // If no API credentials, return mock stats
    if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
      return NextResponse.json(getMockStats(campaignId));
    }

    // Map channel name to MoEngage API path segment
    const channelPath = mapChannelToPath(channel);

    // Fetch campaign info/stats from MoEngage
    // Endpoint: GET /v4/campaigns/info/{channel}/{campaign_id}?attribution_type=click_through
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
    return NextResponse.json(stats);
  } catch (error: any) {
    const status = error?.response?.status;

    // If campaign not found or stats not available, return mock
    if (status === 404 || status === 422) {
      const campaignId = new URL(req.url).searchParams.get('campaignId') || 'unknown';
      return NextResponse.json(getMockStats(campaignId));
    }

    console.error('[API/campaign-stats]', error?.response?.data || error?.message);
    return NextResponse.json(
      { error: 'Failed to fetch campaign stats', details: error?.message },
      { status: 500 }
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

function parseStats(campaignId: string, data: any, attribution: string) {
  // Try to extract stats from the MoEngage response
  // The response structure varies by channel, but typically:
  // data.performance_stats or data.stats or data.campaign_stats
  const perf = data.performance_stats || data.stats || data.campaign_stats || data;

  return {
    campaignId,
    attribution,
    sent: perf.sent ?? perf.total_sent ?? perf.push_sent ?? undefined,
    delivered: perf.delivered ?? perf.total_delivered ?? undefined,
    impressions: perf.impressions ?? perf.total_impressions ?? perf.push_impressions ?? undefined,
    clicks: perf.clicks ?? perf.total_clicks ?? perf.click_count ?? undefined,
    ctr: perf.ctr ?? perf.click_rate ?? (
      perf.clicks && perf.delivered
        ? Number(((perf.clicks / perf.delivered) * 100).toFixed(2))
        : undefined
    ),
    conversions: perf.conversions ?? perf.total_conversions ?? perf.conversion_count ?? undefined,
    conversionRate: perf.conversion_rate ?? (
      perf.conversions && perf.clicks
        ? Number(((perf.conversions / perf.clicks) * 100).toFixed(2))
        : undefined
    ),
    revenue: perf.revenue ?? perf.total_revenue ?? undefined,
  };
}

function getMockStats(campaignId: string) {
  // Return realistic mock stats for development/preview
  const isMock = campaignId.startsWith('mock_');
  const seed = campaignId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (min: number, max: number) => min + Math.floor(((seed * 31) % 100) / 100 * (max - min));

  const sent = rand(5000, 50000);
  const delivered = Math.floor(sent * (0.92 + rand(0, 5) / 100));
  const clicks = Math.floor(delivered * (0.03 + rand(0, 8) / 100));
  const conversions = Math.floor(clicks * (0.10 + rand(0, 15) / 100));
  const ctr = Number(((clicks / delivered) * 100).toFixed(2));
  const conversionRate = Number(((conversions / clicks) * 100).toFixed(2));

  return {
    campaignId,
    attribution: 'click_through',
    source: isMock ? 'mock' : 'moengage_fallback',
    sent,
    delivered,
    clicks,
    ctr,
    conversions,
    conversionRate,
    revenue: Math.floor(conversions * rand(5, 50)),
  };
}
