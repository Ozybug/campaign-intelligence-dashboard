import { NextResponse } from 'next/server';
import { fetchMoEngageCampaigns } from '@/lib/moengage';
import { detectCollisions } from '@/lib/collision';

export async function GET() {
  try {
    const campaigns = await fetchMoEngageCampaigns();
    const collisions = detectCollisions(campaigns);
    
    const isMock = campaigns.length > 0 && campaigns[0].id.startsWith('mock_');
    
    return NextResponse.json({
      campaigns,
      collisions,
      total: campaigns.length,
      source: isMock ? 'mock' : 'moengage_api',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error?.message },
      { status: 500 }
    );
  }
}
