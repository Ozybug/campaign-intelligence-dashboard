import { CampaignMetrics } from '@/types/campaign';

// Mock metrics data
function generateMockMetrics(campaignId: string, startDate: string, endDate: string): CampaignMetrics {
  const seed = campaignId.charCodeAt(campaignId.length - 1);
  return {
    campaignId,
    startDate,
    endDate,
    sessions: Math.floor((seed * 1234) % 8000) + 2000,
    users: Math.floor((seed * 987) % 6000) + 1500,
    conversions: Math.floor((seed * 456) % 800) + 100,
    revenue: Math.floor((seed * 789) % 50000) + 5000,
    bounceRate: parseFloat((Math.random() * 40 + 20).toFixed(1)),
  };
}

export async function getCampaignMetrics(
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<CampaignMetrics> {
  const hasGACredentials =
    process.env.GA_PROPERTY_ID &&
    process.env.GA_CLIENT_EMAIL &&
    process.env.GA_PRIVATE_KEY;

  if (!hasGACredentials) {
    console.log('[GA4] No credentials configured, using mock data');
    return generateMockMetrics(campaignId, startDate, endDate);
  }

  try {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');

    const analytics = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GA_CLIENT_EMAIL,
        private_key: process.env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    const [response] = await analytics.runReport({
      property: `properties/${process.env.GA_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionCampaignName' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
        { name: 'bounceRate' },
      ],
    });

    const row = response.rows?.[0];
    if (!row) return generateMockMetrics(campaignId, startDate, endDate);

    return {
      campaignId,
      startDate,
      endDate,
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
      users: parseInt(row.metricValues?.[1]?.value || '0'),
      conversions: parseInt(row.metricValues?.[2]?.value || '0'),
      revenue: parseFloat(row.metricValues?.[3]?.value || '0'),
      bounceRate: parseFloat(row.metricValues?.[4]?.value || '0'),
    };
  } catch (error) {
    console.error('[GA4] API error, falling back to mock data:', error);
    return generateMockMetrics(campaignId, startDate, endDate);
  }
}