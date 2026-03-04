import axios from 'axios';
import { Campaign } from '@/types/campaign';

// Mock data for demo purposes when API key is not configured
const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp_001',
    name: 'Spring Sale Push Blast',
    channel: 'Push',
    start_time: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'active',
    target_segment: 'All Users',
    budget: 5000,
  },
  {
    id: 'camp_002',
    name: 'Welcome Email Series',
    channel: 'Email',
    start_time: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'active',
    target_segment: 'New Users',
    budget: 2000,
  },
  {
    id: 'camp_003',
    name: 'Flash Sale WhatsApp',
    channel: 'WhatsApp',
    start_time: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'active',
    target_segment: 'VIP Segment',
    budget: 1500,
  },
  {
    id: 'camp_004',
    name: 'Re-engagement SMS',
    channel: 'SMS',
    start_time: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'active',
    target_segment: 'Churned Users',
    budget: 800,
  },
  {
    id: 'camp_005',
    name: 'Product Launch In-App',
    channel: 'In-App',
    start_time: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 17 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'scheduled',
    target_segment: 'Power Users',
    budget: 3000,
  },
  {
    id: 'camp_006',
    name: 'Summer Campaign Email',
    channel: 'Email',
    start_time: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'completed',
    target_segment: 'All Users',
    budget: 4500,
  },
  {
    id: 'camp_007',
    name: 'Weekend Push Deals',
    channel: 'Push',
    start_time: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'active',
    target_segment: 'Engaged Users',
    budget: 1200,
  },
  {
    id: 'camp_008',
    name: 'Loyalty Web Banner',
    channel: 'Web',
    start_time: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
    end_time: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'active',
    target_segment: 'Loyal Customers',
    budget: 2200,
  },
];

export async function getCampaigns(): Promise<Campaign[]> {
  if (!process.env.MOENGAGE_API_KEY) {
    console.log('[MoEngage] No API key configured, using mock data');
    return MOCK_CAMPAIGNS;
  }

  try {
    const response = await axios.get('https://api-01.moengage.com/v1/campaigns', {
      headers: {
        Authorization: `Bearer ${process.env.MOENGAGE_API_KEY}`,
      },
      timeout: 10000,
    });
    return response.data.data || response.data;
  } catch (error) {
    console.error('[MoEngage] API error, falling back to mock data:', error);
    return MOCK_CAMPAIGNS;
  }
}