import axios from 'axios';
import { Campaign, Channel } from '@/types/campaign';

// MoEngage DC-03 API base URL (derived from dashboard-03.moengage.com)
const MOENGAGE_BASE_URL = process.env.MOENGAGE_BASE_URL || 'https://api-03.moengage.com';

// Map MoEngage campaign types to our Channel type
function mapChannel(campaignType: string, channel?: string): Channel {
  const type = (campaignType || '').toLowerCase();
  const ch = (channel || '').toLowerCase();
  
  if (type.includes('push') || ch.includes('push')) return 'Push';
  if (type.includes('email') || ch.includes('email')) return 'Email';
  if (type.includes('whatsapp') || ch.includes('whatsapp')) return 'WhatsApp';
  if (type.includes('sms') || ch.includes('sms')) return 'SMS';
  if (type.includes('in_app') || type.includes('inapp') || ch.includes('in-app')) return 'In-App';
  if (type.includes('web') || ch.includes('web')) return 'Web';
  return 'Push'; // default
}

// Map MoEngage status to our status type
function mapStatus(status: string): Campaign['status'] {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'running') return 'active';
  if (s === 'completed' || s === 'sent' || s === 'finished') return 'completed';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'paused' || s === 'stopped') return 'paused';
  if (s === 'draft') return 'draft';
  return 'completed';
}

// Format date to YYYY-MM-DD
function formatDate(ts: number | string | undefined): string {
  if (!ts) return new Date().toISOString().split('T')[0];
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toISOString().split('T')[0];
}

// Fetch real campaigns from MoEngage Campaign Report API v5
async function fetchMoEngageCampaigns(): Promise<Campaign[]> {
  const APP_ID = process.env.MOENGAGE_APP_ID!;
  const SECRET_KEY = process.env.MOENGAGE_SECRET_KEY!;
  const basicAuth = Buffer.from(`${APP_ID}:${SECRET_KEY}`).toString('base64');

  // Fetch last 90 days of campaigns
  const now = Math.floor(Date.now() / 1000);
  const ninetyDaysAgo = now - 90 * 24 * 3600;

  const response = await axios.get(
    `${MOENGAGE_BASE_URL}/v5/reports/campaigns?app_id=${APP_ID}`,
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'MOE-APPKEY': APP_ID,
      },
      params: {
        from: ninetyDaysAgo,
        to: now,
      },
      timeout: 15000,
    }
  );

  const data = response.data;
  
  // MoEngage v5 returns { data: { campaigns: [...] } } or { campaigns: [...] }
  const rawCampaigns = data?.data?.campaigns || data?.campaigns || data?.data || [];
  
  if (!Array.isArray(rawCampaigns) || rawCampaigns.length === 0) {
    console.warn('[MoEngage] No campaigns in response, response keys:', Object.keys(data || {}));
    return [];
  }

  return rawCampaigns.map((c: any) => {
    // MoEngage campaign object fields
    const startTs = c.start_time || c.scheduled_time || c.created_time || c.created_at;
    const endTs = c.end_time || c.expiry_time || c.completed_time || c.sent_time;
    
    return {
      id: c.campaign_id || c.id || c._id || String(Math.random()),
      name: c.campaign_name || c.name || 'Unnamed Campaign',
      channel: mapChannel(c.campaign_type || c.type || '', c.channel || ''),
      start_time: formatDate(startTs),
      end_time: formatDate(endTs || (startTs + 86400)), // default 1 day if no end
      status: mapStatus(c.status || c.campaign_status || ''),
      target_segment: c.segment_name || c.audience_name || c.target_segment || 'All Users',
    };
  });
}

// Mock campaigns for demo/fallback
function getMockCampaigns(): Campaign[] {
  const today = new Date();
  const d = (offsetDays: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offsetDays);
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
  const hasCredentials = process.env.MOENGAGE_APP_ID && process.env.MOENGAGE_SECRET_KEY;

  if (!hasCredentials) {
    console.log('[MoEngage] No credentials configured, using mock data');
    return getMockCampaigns();
  }

  try {
    const campaigns = await fetchMoEngageCampaigns();
    if (campaigns.length === 0) {
      console.warn('[MoEngage] API returned 0 campaigns, falling back to mock');
      return getMockCampaigns();
    }
    console.log(`[MoEngage] Fetched ${campaigns.length} real campaigns`);
    return campaigns;
  } catch (error: any) {
    console.error('[MoEngage] API error:', error?.response?.data || error?.message || error);
    console.log('[MoEngage] Falling back to mock data');
    return getMockCampaigns();
  }
}