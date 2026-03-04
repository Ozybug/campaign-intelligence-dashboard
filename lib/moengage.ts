import axios from 'axios';
import { Campaign } from '@/types/campaign';

const MOENGAGE_APP_ID = process.env.MOENGAGE_APP_ID || '';
const MOENGAGE_SECRET_KEY = process.env.MOENGAGE_SECRET_KEY || '';
const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL || 'https://api-03.moengage.com';

// Generate Basic Auth header: Base64(AppID:SecretKey)
function getAuthHeader(): string {
  const credentials = `${MOENGAGE_APP_ID}:${MOENGAGE_SECRET_KEY}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
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
      campaign_fields: {
        channels: [channel],
      },
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
      
      // The API returns an array or an object with campaigns
      const campaignList: any[] = Array.isArray(data) ? data : 
                                   (data.campaigns || data.data || data.message || []);
      
      if (!Array.isArray(campaignList) || campaignList.length === 0) {
        hasMore = false;
        break;
      }

      // Map to our Campaign type
      for (const c of campaignList) {
        const campaign: Campaign = {
          id: c.campaign_id || c.id || `${channel}_${page}_${Math.random()}`,
          name: c.basic_details?.name || c.name || 'Unnamed Campaign',
          channel: mapChannel(channel),
          status: mapStatus(c.status || 'unknown'),
          startDate: c.scheduling_details?.start_time || c.sent_time || c.created_at || new Date().toISOString(),
          endDate: c.scheduling_details?.end_time || c.sent_time || c.created_at || new Date().toISOString(),
          campaignType: c.campaign_delivery_type || c.delivery_type || 'ONE_TIME',
          targetAudience: c.segmentation_details?.is_all_user_campaign ? 'All Users' : 'Segmented',
          impressions: undefined,
          clicks: undefined,
          conversions: undefined,
          revenue: undefined,
        };
        allCampaigns.push(campaign);
      }

      // If we got fewer results than limit, we've reached the end
      if (campaignList.length < limit) {
        hasMore = false;
      } else {
        page++;
        // Safety: max 5 pages per channel
        if (page > 5) hasMore = false;
      }
    } catch (error: any) {
      console.error(`[MoEngage] Error fetching ${channel} campaigns (page ${page}):`, error?.response?.data || error?.message);
      hasMore = false;
    }
  }

  return allCampaigns;
}

function mapChannel(apiChannel: string): Campaign['channel'] {
  const map: Record<string, Campaign['channel']> = {
    PUSH: 'Push',
    EMAIL: 'Email',
    SMS: 'SMS',
    WHATSAPP: 'WhatsApp',
    INAPP: 'In-App',
    WEB: 'Web',
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
    const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0];
  };

  return [
    {
      id: 'mock_1',
      name: 'Summer Push Blast',
      channel: 'Push',
      status: 'Active',
      startDate: addDays(today, -3),
      endDate: addDays(today, 4),
      campaignType: 'ONE_TIME',
      targetAudience: 'All Users',
    },
    {
      id: 'mock_2',
      name: 'Weekly Email Newsletter',
      channel: 'Email',
      status: 'Active',
      startDate: addDays(today, -7),
      endDate: addDays(today, 7),
      campaignType: 'PERIODIC',
      targetAudience: 'Subscribers',
    },
    {
      id: 'mock_3',
      name: 'WhatsApp Flash Sale',
      channel: 'WhatsApp',
      status: 'Scheduled',
      startDate: addDays(today, 2),
      endDate: addDays(today, 5),
      campaignType: 'ONE_TIME',
      targetAudience: 'High Value',
    },
    {
      id: 'mock_4',
      name: 'Re-engagement SMS',
      channel: 'SMS',
      status: 'Completed',
      startDate: addDays(today, -14),
      endDate: addDays(today, -10),
      campaignType: 'ONE_TIME',
      targetAudience: 'Churned Users',
    },
    {
      id: 'mock_5',
      name: 'In-App Onboarding',
      channel: 'In-App',
      status: 'Active',
      startDate: addDays(today, -30),
      endDate: addDays(today, 30),
      campaignType: 'EVENT_TRIGGERED',
      targetAudience: 'New Users',
    },
  ];
}

export async function fetchMoEngageCampaigns(): Promise<Campaign[]> {
  if (!MOENGAGE_APP_ID || !MOENGAGE_SECRET_KEY) {
    console.log('[MoEngage] No credentials configured, using mock data');
    return getMockCampaigns();
  }

  console.log('[MoEngage] Fetching campaigns from API...');
  console.log('[MoEngage] App ID:', MOENGAGE_APP_ID);
  console.log('[MoEngage] Base URL:', MOENGAGE_BASE_URL);

  const channels = ['PUSH', 'EMAIL', 'SMS', 'INAPP', 'WHATSAPP'];
  
  try {
    const results = await Promise.allSettled(
      channels.map(ch => fetchCampaignsByChannel(ch))
    );

    const allCampaigns: Campaign[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allCampaigns.push(...result.value);
      }
    }

    console.log(`[MoEngage] Total campaigns fetched: ${allCampaigns.length}`);

    if (allCampaigns.length === 0) {
      console.warn('[MoEngage] No campaigns returned from API, using mock data as fallback');
      return getMockCampaigns();
    }

    return allCampaigns;
  } catch (error) {
    console.error('[MoEngage] Fatal error fetching campaigns:', error);
    return getMockCampaigns();
  }
}
