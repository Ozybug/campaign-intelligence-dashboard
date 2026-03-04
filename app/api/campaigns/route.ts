import { NextResponse } from 'next/server';
import { fetchMoEngageCampaigns } from '@/lib/moengage';
import { detectCollisions } from '@/lib/collision';

// Map channel to color
const CHANNEL_COLORS: Record<string, string> = {
  'Push': '#3B82F6',
  'Email': '#10B981',
  'WhatsApp': '#22C55E',
  'SMS': '#F59E0B',
  'In-App': '#8B5CF6',
  'Web': '#EC4899',
};

// Normalize date string - handle "2026-03-04 02:31:08.671000" format
function normalizeDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();
  // Replace space with T and trim microseconds to milliseconds
  const normalized = dateStr.replace(' ', 'T').replace(/\.\d{6}$/, '.000');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export async function GET() {
  try {
    const campaigns = await fetchMoEngageCampaigns();
    const collisions = detectCollisions(campaigns);
    
    const isMock = campaigns.length > 0 && campaigns[0].id.startsWith('mock_');
    
    // Convert campaigns to FullCalendar event format
    const events = campaigns.map(c => {
      const startDate = normalizeDate(c.startDate);
      const endDate = normalizeDate(c.endDate || c.startDate);
      
      // Ensure end is not before start
      const start = new Date(startDate);
      const end = new Date(endDate);
      const finalEnd = end < start ? new Date(start.getTime() + 86400000) : end;

      return {
        id: c.id,
        title: c.name,
        start: startDate,
        end: finalEnd.toISOString(),
        backgroundColor: CHANNEL_COLORS[c.channel] || '#6B7280',
        borderColor: CHANNEL_COLORS[c.channel] || '#6B7280',
        extendedProps: {
          channel: c.channel,
          status: c.status,
          campaignType: c.campaignType,
          targetAudience: c.targetAudience,
        },
      };
    });

    return NextResponse.json({
      campaigns,
      events,
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
