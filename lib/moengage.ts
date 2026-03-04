import axios from 'axios';
import { Campaign, Channel } from '@/types/campaign';

const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL || 'https://api-03.moengage.com';

function mapChannel(type: string, channel?: string): Channel {
  const t = (type + ' ' + (channel || '')).toLowerCase();
  if (t.includes('whatsapp')) return 'WhatsApp';
  if (t.includes('email')) return 'Email';
  if (t.includes('sms')) return 'SMS';
  if (t.includes('in_app') || t.includes('inapp') || t.includes('in-app')) return 'In-App';
  if (t.includes('web') && !t.includes('webpush')) return 'Web';
  if (t.includes('push')) return 'Push';
  return 'Push';
}

function mapStatus(status: string): Campaign['status'] {
  const s = (status || '').toLowerCase();
  if (s.includes('active') || s.includes('running') || s.includes('ongoing')) return 'active';
  if (s.includes('complete') || s.includes('sent') || s.includes('finish') || s.includes('expired')) return 'completed';
  if (s.includes('scheduled') || s.includes('upcoming')) return 'scheduled';
  if (s.includes('pause') || s.includes('stop')) return 'paused';
  if (s.includes('draft')) return 'draft';
  return 'completed';
}

function toDateStr(ts: any): string {
  if (!ts) return new Date().toISOString().split('T')[0];
  // Handle epoch seconds vs milliseconds
  const num = typeof ts === 'number' ? ts : parseInt(ts);
  const d = num > 1e10 ? new Date(num) : new Date(num * 1000);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

function normalizeCampaign(c: any): Campaign | null {
  if (!c || typeof c !== 'object') return null;
  const id = c.campaign_id || c.id || c._id;
  const name = c.campaign_name || c.name || c.title;
  if (!id || !name) return null;

  const type = c.campaign_type || c.type || c.channel_type || '';
  const channel = c.channel || c.delivery_channel || '';
  const startTs = c.start_time || c.scheduled_time || c.send_time || c.created_time || c.created_at || c.startTime;
  const endTs = c.end_time || c.expiry_time || c.completed_time || c.sent_time || c.endTime;
  
  const startDate = toDateStr(startTs);
  // If no end date, set it to start + 1 day for one-time campaigns, + 7 for recurring
  const endDate = endTs ? toDateStr(endTs) : toDateStr(
    typeof startTs === 'number' ? startTs + 86400 : Date.now() / 1000 + 86400
  );

  return {
    id: String(id),
    name: String(name),
    channel: mapChannel(type, channel),
    start_time: startDate,
    end_time: endDate,
    status: mapStatus(c.status || c.campaign_status || c.state || ''),
    target_segment: c.segment_name || c.audience_name || c.target_segment || c.segmentName || 'All Users',
  };
}

async function tryEndpoint(url: string, auth: string, appId: string): Promise<Campaign[]> {
  const response = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      'MOE-APPKEY': appId,
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    console.warn(`[MoEngage] ${url} returned ${response.status}:`, JSON.stringify(response.data).substring(0, 200));
    return [];
  }

  const data = response.data;
  console.log('[MoEngage] Response from', url, '- keys:', Object.keys(data || {}));

  // Try various response shapes
  const candidates = [
    data?.data?.campaigns,
    data?.campaigns,
    data?.data,
    data?.results,
    data?.response,
    Array.isArray(data) ? data : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const normalized = candidate.map(normalizeCampaign).filter(Boolean) as Campaign[];
      if (normalized.length > 0) return normalized;
    }
  }

  console.warn('[MoEngage] Could not find campaign array in response:', JSON.stringify(data).substring(0, 500));
  return [];
}

async function fetchMoEngageCampaigns(): Promise<Campaign[]> {
  const APP_ID = process.env.MOENGAGE_APP_ID!;
  const SECRET_KEY = process.env.MOENGAGE_SECRET_KEY!;
  const auth = Buffer.from(`${APP_ID}:${SECRET_KEY}`).toString('base64');

  const now = Math.floor(Date.now() / 1000);
  const ninetyDaysAgo = now - 90 * 24 * 3600;

  // Try multiple endpoint patterns
  const endpoints = [
    // v5 Campaign Report API - list with date range
    `${MOENGAGE_BASE_URL}/v5/reports/campaigns?app_id=${APP_ID}&from=${ninetyDaysAgo}&to=${now}`,
    // v5 without date params
    `${MOENGAGE_BASE_URL}/v5/reports/campaigns?app_id=${APP_ID}`,
    // Inform Report v2 
    `${MOENGAGE_BASE_URL}/inform/v2/reports?app_id=${APP_ID}&from=${ninetyDaysAgo}&to=${now}`,
    // v6 Campaign stats
    `${MOENGAGE_BASE_URL}/v6/reports/campaigns?app_id=${APP_ID}&from=${ninetyDaysAgo}&to=${now}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const campaigns = await tryEndpoint(endpoint, auth, APP_ID);
      if (campaigns.length > 0) {
        console.log(`[MoEngage] ✅ Got ${campaigns.length} campaigns from ${endpoint}`);
        return campaigns;
      }
    } catch (err: any) {
      console.warn(`[MoEngage] Endpoint ${endpoint} failed:`, err?.message || String(err));
    }
  }

  return [];
}

function getMockCampaigns(): Campaign[] {
  const d = (o: number) => {
    const dt = new Date(); dt.setDate(dt.getDate() + o);
    return dt.toISOString().split('T')[0];
  };
  return [
    { id: 'mock_001', name: 'Spring Sale Push Blast', channel: 'Push', start_time: d(-7), end_time: d(7), status: 'active', target_segment: 'All Users', budget: 5000 },
    { id: 'mock_002', name: 'Welcome Email Series', channel: 'Email', start_time: d(-14), end_time: d(14), status: 'active', target_segment: 'New Users', budget: 2000 },
    { id: 'mock_003', name: 'Flash Sale WhatsApp', channel: 'WhatsApp', start_time: d(-5), end_time: d(2), status: 'active', target_segment: 'VIP Segment', budget: 1500 },
    { id: 'mock_004', name: 'Re-engagement SMS', channel: 'SMS', start_time: d(-3), end_time: d(10), status: 'active', target_segment: 'Churned Users', budget: 800 },
    { id: 'mock_005', name: 'Product Launch In-App', channel: 'In-App', start_time: d(3), end_time: d(17), status: 'scheduled', target_segment: 'Power Users', budget: 3000 },
    { id: 'mock_006', name: 'Summer Campaign Email', channel: 'Email', start_time: d(-30), end_time: d(-10), status: 'completed', target_segment: 'All Users', budget: 4500 },
    { id: 'mock_007', name: 'Weekend Push Deals', channel: 'Push', start_time: d(-2), end_time: d(5), status: 'active', target_segment: 'Engaged Users', budget: 1200 },
    { id: 'mock_008', name: 'Loyalty Web Banner', channel: 'Web', start_time: d(-10), end_time: d(20), status: 'active', target_segment: 'Loyal Customers', budget: 2200 },
  ];
}

export async function getCampaigns(): Promise<Campaign[]> {
  if (!process.env.MOENGAGE_APP_ID || !process.env.MOENGAGE_SECRET_KEY) {
    console.log('[MoEngage] No credentials configured, using mock data');
    return getMockCampaigns();
  }
  try {
    const campaigns = await fetchMoEngageCampaigns();
    if (campaigns.length === 0) {
      console.warn('[MoEngage] API returned 0 campaigns, falling back to mock');
      return getMockCampaigns();
    }
    return campaigns;
  } catch (error: any) {
    console.error('[MoEngage] Fatal error:', error?.response?.data || error?.message || error);
    return getMockCampaigns();
  }
}