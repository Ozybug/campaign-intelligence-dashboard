import axios from 'axios';
import { Campaign, SegmentFilter } from '@/types/campaign';

const MOENGAGE_APP_ID = process.env.MOENGAGE_APP_ID || '';
const MOENGAGE_SECRET_KEY = process.env.MOENGAGE_SECRET_KEY || '';
const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL || 'https://api-03.moengage.com';

// Generate Basic Auth header: Base64(AppID:SecretKey)
function getAuthHeader(): string {
  const credentials = `${MOENGAGE_APP_ID}:${MOENGAGE_SECRET_KEY}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

// Extract segment filters from MoEngage segmentation_details
function extractFilters(filterObj: any): SegmentFilter[] {
  if (!filterObj || !Array.isArray(filterObj.filters)) return [];
  return filterObj.filters.map((f: any): SegmentFilter => ({
    name: f.name || f.attribute || 'unknown',
    operator: f.operator || f.condition,
    value: f.value,
    category: f.category || f.filter_type,
    data_type: f.data_type,
    negate: f.negate === true,
  }));
}

// Fetch campaigns for a given channel using the correct MoEngage Campaign API
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
          id: c.campaign_id || c.id || `${channel}_${page}_${Math.random()}`,
          name: c.basic_details?.name || c.name || 'Unnamed Campaign',
          channel: mapChannel(channel),
          status: mapStatus(c.status || 'unknown'),
          startDate: c.scheduling_details?.start_time || c.sent_time || c.created_at || new Date().toISOString(),
          endDate: c.scheduling_details?.end_time || c.sent_time || c.created_at || new Date().toISOString(),
          campaignType: c.campaign_delivery_type || c.delivery_type || 'ONE_TIME',
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
      console.error(`[MoEngage] Error fetching ${channel} campaigns:`, error?.response?.data || error?.message);
      hasMore = false;
    }
  }
  return allCampaigns;
}

function mapChannel(apiChannel: string): Campaign['channel'] {
  const map: Record<string, Campaign['channel']> = {
    PUSH: 'Push', EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp', INAPP: 'In-App', WEB: 'Web',
  };
  return map[apiChannel.toUpperCase()] || 'Push';
}

function mapStatus(apiStatus: string): Campaign['status'] {
  const s = apiStatus.toLowerCase();
  if (s === 'active') return 'Active';
  if (s === 'scheduled' || s === 'fetching users in segment') return 'Scheduled';
  if (s === 'paused') return 'Paused';
  if (s === 'sent' || s === 'completed') return 'Completed';
  if (s === 'draft') return 'Draft';
  if (s === 'stopped' || s === 'cancelled') return 'Cancelled';
  return 'Draft';
}

// Mock data used as fallback
function getMockCampaigns(): Campaign[] {
  const today = new Date();
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().split('T')[0];
  };
  return [
    { id: 'mock_1', name: 'Summer Push Blast', channel: 'Push', status: 'Active', startDate: addDays(today, -3), endDate: addDays(today, 4), campaignType: 'ONE_TIME', targetAudience: 'All Users', includedFilters: [], excludedFilters: [] },
    { id: 'mock_2', name: 'Weekly Email Newsletter', channel: 'Email', status: 'Active', startDate: addDays(today, -7), endDate: addDays(today, 7), campaignType: 'PERIODIC', targetAudience: 'Segmented', includedFilters: [{ name: 'u_em', operator: 'exists', category: 'Tracked Standard Attribute', data_type: 'string', negate: false }], excludedFilters: [] },
    { id: 'mock_3', name: 'WhatsApp Flash Sale', channel: 'WhatsApp', status: 'Scheduled', startDate: addDays(today, 2), endDate: addDays(today, 5), campaignType: 'ONE_TIME', targetAudience: 'Segmented', includedFilters: [{ name: 'user_type', operator: 'is', value: 'High Value', category: 'User Attribute', data_type: 'string', negate: false }], excludedFilters: [{ name: 'opted_out', operator: 'is', value: 'true', category: 'User Attribute', data_type: 'boolean', negate: false }] },
    { id: 'mock_4', name: 'Re-engagement SMS', channel: 'SMS', status: 'Completed', startDate: addDays(today, -14), endDate: addDays(today, -10), campaignType: 'ONE_TIME', targetAudience: 'Segmented', includedFilters: [{ name: 'last_seen', operator: 'before', value: '30d', category: 'User Attribute', data_type: 'date', negate: false }], excludedFilters: [] },
    { id: 'mock_5', name: 'In-App Onboarding', channel: 'In-App', status: 'Active', startDate: addDays(today, -30), endDate: addDays(today, 30), campaignType: 'EVENT_TRIGGERED', targetAudience: 'Segmented', includedFilters: [{ name: 'is_new_user', operator: 'is', value: 'true', category: 'User Attribute', data_type: 'boolean', negate: false }], excludedFilters: [] },
  ];
}

export async function fetchMoEngageCampaigns(): Promise<Campaign[]> {
  if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
    console.log('[MoEngage] No credentials configured, using mock data');
    return getMockCampaigns();
  }
  console.log('[MoEngage] Fetching campaigns from API...');
  const channels = ['PUSH', 'EMAIL', 'SMS', 'INAPP', 'WHATSAPP'];
  try {
    const results = await Promise.allSettled(channels.map(ch => fetchCampaignsByChannel(ch)));
    const allCampaigns: Campaign[] = [];
    for (const result of results) { if (result.status === 'fulfilled') allCampaigns.push(...result.value); }
    if (allCampaigns.length === 0) { console.warn('[MoEngage] No campaigns, using mock'); return getMockCampaigns(); }
    return allCampaigns;
  } catch (error) {
    console.error('[MoEngage] Fatal error:', error);
    return getMockCampaigns();
  }
}
