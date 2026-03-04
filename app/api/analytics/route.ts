import { NextRequest, NextResponse } from 'next/server';
import { getCampaignMetrics } from '@/lib/ga4';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId') || 'unknown';
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (!start || !end) {
      return NextResponse.json({ error: 'start and end dates required' }, { status: 400 });
    }
    const metrics = await getCampaignMetrics(campaignId, start, end);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('[API/analytics]', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}