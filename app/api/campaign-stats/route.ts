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
 * GET /api/campaign-stats?campaignId=<id>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>
 *
 * Fetches campaign performance stats from MoEngage Stats API:
 *   POST /core-services/v1/campaign-stats
 *
 * Maps ONLY the fields that MoEngage natively shows in its UI:
 *   - attempted      (Attempted)
 *   - sent           (Sent)
 *   - failedToSend   (Failed To Send)
 *   - impressions    (Impressions)
 *   - clicks         (Clicked)
 *   - ctr            (CTR %)
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

        const url = `${MOENGAGE_BASE_URL}/core-services/v1/campaign-stats`;
        const requestBody = {
            request_id: `req_${campaignId}_${Date.now()}`,
            campaign_ids: [campaignId],
            start_date: startDate,
            end_date: endDate,
            attribution_type: attribution,
            metric_type: 'TOTAL',
        };

        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': getAuthHeader(),
                'MOE-APPKEY': MOENGAGE_APP_ID,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        const stats = parseStatsResponse(campaignId, response.data, attribution);
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
 *
 * Response shape:
 * { data: { "<campaignId>": [ { platforms: { "<PLATFORM>": { locales: {
 *   "<locale>": { variations: { all_variations: {
 *     performance_stats: { attempted, sent, failed, impression, click, ctr }
 *     delivery_funnel: { impressions }
 *   } } } } } } } ] } }
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
        source: 'moengage_live',
        ...(attempted > 0 && { attempted }),
        ...(sent > 0 && { sent }),
        ...(failedToSend !== undefined && failedToSend > 0 && { failedToSend }),
        ...(impressions > 0 && { impressions }),
        ...(clicks > 0 && { clicks }),
        ...(ctr !== undefined && { ctr }),
    };
}
