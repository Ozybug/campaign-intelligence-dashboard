import { CampaignMetrics } from '@/types/campaign';

/**
 * Fetch GA4 metrics for a campaign date range.
 * Returns null if GA4 credentials are not configured — no mock/fake data.
 */
export async function getCampaignMetrics(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<CampaignMetrics | null> {
    const hasGACredentials =
          process.env.GA_PROPERTY_ID &&
          process.env.GA_CLIENT_EMAIL &&
          process.env.GA_PRIVATE_KEY;

  if (!hasGACredentials) {
        console.log('[GA4] No credentials configured, skipping GA4 metrics');
        return null;
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
        if (!row) return null;

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
        console.error('[GA4] API error:', error);
        return null;
  }
}
