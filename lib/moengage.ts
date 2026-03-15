import axios from 'axios';
import { Campaign, SegmentFilter } from '@/types/campaign';
import { API_CHANNEL_MAP, API_DELIVERY_TYPE_MAP } from '@/lib/taxonomy';

const MOENGAGE_APP_ID   = process.env.MOENGAGE_APP_ID    || '';
const MOENGAGE_SECRET_KEY = process.env.MOENGAGE_SECRET_KEY || '';
const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL  || 'https://api-03.moengage.com';

// Channels supported by the campaigns/search API.
// ONSITE returns 400 "channels is invalid passed value" — OSM is fetched via
// the Stats API instead (see fetchOnsiteCampaignsViaStatsApi below).
const SEARCH_API_CHANNELS = ['PUSH', 'EMAIL'];

// ─── Auth ─────────────────────────────────────────────────────────────────────
function getAuthHeader(): string {
    const credentials = `${MOENGAGE_APP_ID}:${MOENGAGE_SECRET_KEY}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
}

// ─── Filter extraction ────────────────────────────────────────────────────────
// MoEngage returns included_filters / excluded_filters in two possible formats:
// 1. { filter_operator: "and", filters: [ { name, operator, value, ... } ] }
// 2. [ { segment_name, segment_id, ... } ]  (segment reference array)
function extractFilters(filterObj: any): SegmentFilter[] {
    if (!filterObj) return [];

  // Standard format: object with a "filters" array
  if (filterObj && Array.isArray(filterObj.filters)) {
        return filterObj.filters.map((f: any): SegmentFilter => ({
                name:      f.name || f.attribute || f.event_name || f.attribute_name || 'Filter',
                operator:  f.operator || f.condition,
                value:     f.value,
                category:  f.category || f.filter_type,
                data_type: f.data_type,
                negate:    f.negate === true,
        }));
  }

  // Segment-reference array format
  if (Array.isArray(filterObj)) {
        return filterObj.map((f: any): SegmentFilter => ({
                name:      f.segment_name || f.name || f.attribute || f.event_name || 'Segment',
                operator:  f.operator || f.condition,
                value:     f.value,
                category:  f.category || f.filter_type || 'segment',
                data_type: f.data_type,
                negate:    f.negate === true,
        }));
  }

  return [];
}

// ─── Channel + delivery-type normalisation ─────────────────────────────────────
function mapChannel(apiChannel: string): Campaign['channel'] {
    return API_CHANNEL_MAP[apiChannel.toUpperCase()] ?? 'Push';
}

function mapDeliveryType(apiType: string): string {
    return API_DELIVERY_TYPE_MAP[apiType?.toUpperCase()] ?? apiType ?? 'ONE_TIME';
}

function mapStatus(apiStatus: string): Campaign['status'] {
    const s = (apiStatus || '').toLowerCase();
    if (s === 'active')  return 'Active';
    if (s === 'scheduled' || s === 'fetching users in segment') return 'Scheduled';
    if (s === 'paused')  return 'Paused';
    if (s === 'sent' || s === 'completed') return 'Completed';
    if (s === 'draft')   return 'Draft';
    if (s === 'stopped' || s === 'cancelled') return 'Cancelled';
    return 'Draft';
}

// ─── Per-channel fetch via campaigns/search ────────────────────────────────────
async function fetchCampaignsByChannel(channel: string): Promise<Campaign[]> {
    const url = `${MOENGAGE_BASE_URL}/core-services/v1/campaigns/search`;
    const authHeader = getAuthHeader();
    const requestId = `req_${Date.now()}_${channel}`;
    const allCampaigns: Campaign[] = [];
    let page = 1;
    const limit = 15;
    let hasMore = true;

  while (hasMore) {
        const body = {
                campaign_fields: { channels: [channel] },
                limit,
                page,
                request_id: requestId,
        };

      try {
              const response = await axios.post(url, body, {
                        headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': authHeader,
                                    'MOE-APPKEY': MOENGAGE_APP_ID,
                        },
                        timeout: 15000,
              });

          const data = response.data;
              const campaignList: any[] = Array.isArray(data)
                ? data
                        : (data.campaigns || data.data || data.message || []);

          if (!Array.isArray(campaignList) || campaignList.length === 0) {
                    hasMore = false;
                    break;
          }

          for (const c of campaignList) {
                    const segDet = c.segmentation_details || {};
                    const isAllUsers = segDet.is_all_user_campaign === true;
                    const includedFilters = extractFilters(segDet.included_filters);
                    const excludedFilters = extractFilters(segDet.excluded_filters);

                const campaign: Campaign = {
                            id:            c.campaign_id || c.id || `${channel}_${page}_${Math.random()}`,
                            name:          c.basic_details?.name || c.name || 'Unnamed Campaign',
                            channel:       mapChannel(channel),
                            status:        mapStatus(c.status || 'unknown'),
                            startDate:     c.scheduling_details?.start_time || c.sent_time || c.created_at || new Date().toISOString(),
                            endDate:       c.scheduling_details?.end_time   || c.sent_time || c.created_at || new Date().toISOString(),
                            campaignType:  mapDeliveryType(c.campaign_delivery_type || c.delivery_type || 'ONE_TIME'),
                            targetAudience: isAllUsers ? 'All Users' : 'Segmented',
                            includedFilters,
                            excludedFilters,
                };
                    allCampaigns.push(campaign);
          }

          if (campaignList.length < limit) {
                    hasMore = false;
          } else {
                    page++;
                    if (page > 5) hasMore = false;
          }
      } catch (error: any) {
              console.error(
                        `[MoEngage] Error fetching ${channel} campaigns:`,
                        JSON.stringify(error?.response?.data || error?.message)
                      );
              hasMore = false;
      }
  }

  return allCampaigns;
}

// ─── OSM via Stats API ─────────────────────────────────────────────────────────
// The campaigns/search API returns 400 for ONSITE. Instead, we call the Stats
// API with a date range (no campaign_ids) to discover all OSM campaign IDs,
// then build Campaign objects from the response.
//
// Stats API response shape (per campaign entry):
// { platforms: { WEB: {...}, MWEB: {...} } }   ← OSM uses WEB / MWEB platforms
// The campaign IDs are the keys of data: { "<campaignId>": [...] }
//
// Auth note: Stats API uses the same Basic Auth (MOENGAGE_APP_ID:MOENGAGE_SECRET_KEY)
// where MOENGAGE_SECRET_KEY = Campaign Report key from Settings > Account > APIs.
// This is the same key already used for /api/campaign-stats.

const OSM_PLATFORM_KEYS = new Set(['WEB', 'MWEB', 'ALL_PLATFORMS', 'UNKNOWN']);

function isOsmEntry(entry: any): boolean {
    const platforms = Object.keys(entry?.platforms ?? {});
    // OSM campaigns have WEB / MWEB platforms (not ANDROID / IOS / EMAIL / SMS etc.)
  // They will NOT have typical push/email platform keys
  const hasPush = platforms.some(p => ['ANDROID', 'IOS', 'EMAIL', 'SMS', 'WHATSAPP'].includes(p.toUpperCase()));
    const hasOsmPlatform = platforms.some(p => OSM_PLATFORM_KEYS.has(p.toUpperCase()));
    return hasOsmPlatform && !hasPush;
}

function extractOsmStatsFromEntry(campaignId: string, entries: any[]): {
    impressions: number;
    clicks: number;
    startDateHint?: string;
} {
    let impressions = 0;
    let clicks = 0;

  for (const entry of entries) {
        const platforms = entry?.platforms ?? {};
        for (const platformKey of Object.keys(platforms)) {
                const platform = platforms[platformKey];
                const locales = platform?.locales ?? {};
                for (const localeKey of Object.keys(locales)) {
                          const locale = locales[localeKey];
                          const perf = locale?.variations?.all_variations?.performance_stats ?? {};
                          impressions += perf?.impression ?? perf?.impressions ?? 0;
                          clicks      += perf?.click ?? perf?.clicks ?? 0;
                }
        }
  }

  return { impressions, clicks };
}

async function fetchOnsiteCampaignsViaStatsApi(): Promise<Campaign[]> {
    const url = `${MOENGAGE_BASE_URL}/core-services/v1/campaign-stats`;
    const authHeader = getAuthHeader();

  // Scan the last 90 days in 3 x 30-day windows to find OSM campaigns
  const windows: { start: string; end: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
          const endD = new Date(now);
          endD.setDate(now.getDate() - i * 30);
          const startD = new Date(endD);
          startD.setDate(endD.getDate() - 29);
          windows.push({
                  start: startD.toISOString().slice(0, 10),
                  end:   endD.toISOString().slice(0, 10),
          });
    }

  const osmCampaignMap = new Map<string, Campaign>();

  for (const window of windows) {
        let offset = 0;
        const limit = 10;
        let hasMore = true;

      while (hasMore) {
              try {
                        const body = {
                                    request_id: `osm_${Date.now()}_${offset}`,
                                    start_date: window.start,
                                    end_date:   window.end,
                                    attribution_type: 'VIEW_THROUGH',
                                    metric_type: 'TOTAL',
                                    offset,
                                    limit,
                        };

                const response = await axios.post(url, body, {
                            headers: {
                                          'Authorization': authHeader,
                                          'MOE-APPKEY': MOENGAGE_APP_ID,
                                          'Content-Type': 'application/json',
                            },
                            timeout: 15000,
                });

                const data = response.data;
                        const campaignData: Record<string, any[]> = data?.data ?? {};
                        const totalCampaigns: number = data?.total_campaigns ?? 0;

                let foundOsm = 0;

                for (const [campaignId, entries] of Object.entries(campaignData)) {
                            if (!Array.isArray(entries)) continue;

                          // Check if any entry looks like OSM
                          const isOsm = entries.some(isOsmEntry);
                            if (!isOsm) continue;

                          // Don't overwrite if we already have this campaign from a more recent window
                          if (osmCampaignMap.has(campaignId)) continue;

                          foundOsm++;
                            const { impressions, clicks } = extractOsmStatsFromEntry(campaignId, entries);

                          // Build a Campaign object — use window end date as a proxy for activity
                          const campaign: Campaign = {
                                        id:             campaignId,
                                        name:           `On-site Campaign (${campaignId.slice(-6)})`,
                                        channel:        'On-site',
                                        status:         'Active',       // best guess; Stats API doesn't return status
                                        startDate:      window.start + 'T00:00:00.000Z',
                                        endDate:        window.end   + 'T23:59:59.000Z',
                                        campaignType:   undefined,
                                        targetAudience: 'All Users',
                                        includedFilters: [],
                                        excludedFilters: [],
                          };

                          osmCampaignMap.set(campaignId, campaign);
                }

                console.log(`[MoEngage] Stats API ${window.start}→${window.end} offset=${offset}: found ${Object.keys(campaignData).length} campaigns, ${foundOsm} OSM`);

                // Pagination: keep going if we got a full page
                if (Object.keys(campaignData).length < limit || offset + limit >= totalCampaigns) {
                            hasMore = false;
                } else {
                            offset += limit;
                            // Safety cap: max 5 pages per window
                          if (offset >= 50) hasMore = false;
                }

              } catch (error: any) {
                        const status = error?.response?.status;
                        const msg = JSON.stringify(error?.response?.data || error?.message);
                        console.error(`[MoEngage] Stats API error (${window.start}→${window.end}):`, msg);
                        // 403 = Stats API not enabled on plan; no point retrying
                if (status === 403 || status === 401) {
                            return [];
                }
                        hasMore = false;
              }
      }
  }

  const result = Array.from(osmCampaignMap.values());
    console.log(`[MoEngage] Stats API total OSM campaigns found: ${result.length}`);
    return result;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
function getMockCampaigns(): Campaign[] {
    const today = new Date();
    const addDays = (d: Date, n: number) => {
          const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0];
    };
    return [
      { id: 'mock_1',  name: 'Summer Push Blast',       channel: 'Push',      status: 'Active',     startDate: addDays(today,-3),  endDate: addDays(today,4),   campaignType: 'One Time',              targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_2',  name: 'Weekly Email Newsletter',  channel: 'Email',     status: 'Active',     startDate: addDays(today,-7),  endDate: addDays(today,7),   campaignType: 'Periodic',              targetAudience: 'Segmented',  includedFilters: [{ name:'u_em', operator:'exists', category:'Tracked Standard Attribute', data_type:'string', negate:false }], excludedFilters: [] },
      { id: 'mock_3',  name: 'WhatsApp Flash Sale',      channel: 'WhatsApp',  status: 'Scheduled',  startDate: addDays(today,2),   endDate: addDays(today,5),   campaignType: 'One Time',              targetAudience: 'Segmented',  includedFilters: [{ name:'user_type', operator:'is', value:'High Value', category:'User Attribute', data_type:'string', negate:false }], excludedFilters: [{ name:'opted_out', operator:'is', value:'true', category:'User Attribute', data_type:'boolean', negate:false }] },
      { id: 'mock_4',  name: 'Re-engagement SMS',        channel: 'SMS',       status: 'Completed',  startDate: addDays(today,-14), endDate: addDays(today,-10), campaignType: 'One Time',              targetAudience: 'Segmented',  includedFilters: [{ name:'last_seen', operator:'before', value:'30d', category:'User Attribute', data_type:'date', negate:false }], excludedFilters: [] },
      { id: 'mock_5',  name: 'In-App Onboarding',        channel: 'In-App',    status: 'Active',     startDate: addDays(today,-30), endDate: addDays(today,30),  campaignType: 'Event Triggered',       targetAudience: 'Segmented',  includedFilters: [{ name:'is_new_user', operator:'is', value:'true', category:'User Attribute', data_type:'boolean', negate:false }], excludedFilters: [] },
      { id: 'mock_6',  name: 'Device Push Reminder',     channel: 'Push',      status: 'Active',     startDate: addDays(today,-1),  endDate: addDays(today,6),   campaignType: 'Device Triggered',      targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_7',  name: 'Location Store Alert',     channel: 'Push',      status: 'Active',     startDate: addDays(today,-2),  endDate: addDays(today,5),   campaignType: 'Location Triggered',    targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_8',  name: 'Business Email Trigger',   channel: 'Email',     status: 'Active',     startDate: addDays(today,-5),  endDate: addDays(today,10),  campaignType: 'Business Event Triggered', targetAudience: 'Segmented', includedFilters: [], excludedFilters: [] },
      { id: 'mock_9',  name: 'MMS Product Launch',       channel: 'MMS',       status: 'Scheduled',  startDate: addDays(today,3),   endDate: addDays(today,8),   campaignType: 'One Time',              targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_10', name: 'RCS Rich Promo',            channel: 'RCS',       status: 'Draft',      startDate: addDays(today,5),   endDate: addDays(today,12),  campaignType: 'Periodic',              targetAudience: 'Segmented',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_11', name: 'On-site Banner',            channel: 'On-site',   status: 'Active',     startDate: addDays(today,-10), endDate: addDays(today,20),  campaignType: undefined,               targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_12', name: 'Cards Feed Campaign',       channel: 'Cards',     status: 'Active',     startDate: addDays(today,-5),  endDate: addDays(today,15),  campaignType: undefined,               targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_13', name: 'Web Personalisation',       channel: 'Web',       status: 'Active',     startDate: addDays(today,-20), endDate: addDays(today,40),  campaignType: undefined,               targetAudience: 'All Users',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_14', name: 'Facebook Audience Sync',    channel: 'Facebook',  status: 'Active',     startDate: addDays(today,-8),  endDate: addDays(today,22),  campaignType: undefined,               targetAudience: 'Segmented',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_15', name: 'Google Ads Retargeting',   channel: 'Google Ads',status: 'Active',     startDate: addDays(today,-6),  endDate: addDays(today,24),  campaignType: undefined,               targetAudience: 'Segmented',  includedFilters: [], excludedFilters: [] },
      { id: 'mock_16', name: 'Custom Connector Flow',     channel: 'Custom',    status: 'Scheduled',  startDate: addDays(today,1),   endDate: addDays(today,9),   campaignType: 'Event Triggered',       targetAudience: 'Segmented',  includedFilters: [], excludedFilters: [] },
        ];
}

// ─── Public entry point ────────────────────────────────────────────────────────
export async function fetchMoEngageCampaigns(): Promise<Campaign[]> {
    if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
          console.log('[MoEngage] No credentials configured, using mock data');
          return getMockCampaigns();
    }

  console.log('[MoEngage] Fetching campaigns from API...');

  try {
        // Run search-API channels (Push, Email) and Stats-API OSM discovery in parallel
      const [searchResults, osmCampaigns] = await Promise.all([
              Promise.allSettled(SEARCH_API_CHANNELS.map(ch => fetchCampaignsByChannel(ch))),
              fetchOnsiteCampaignsViaStatsApi(),
            ]);

      const allCampaigns: Campaign[] = [];

      for (const result of searchResults) {
              if (result.status === 'fulfilled') allCampaigns.push(...result.value);
      }

      allCampaigns.push(...osmCampaigns);

      if (allCampaigns.length === 0) {
              console.warn('[MoEngage] No campaigns returned, falling back to mock');
              return getMockCampaigns();
      }

      console.log(`[MoEngage] Total campaigns: ${allCampaigns.length} (${osmCampaigns.length} OSM)`);
        return allCampaigns;

  } catch (error) {
        console.error('[MoEngage] Fatal error:', error);
        return getMockCampaigns();
  }
}
