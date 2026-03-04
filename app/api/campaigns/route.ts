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
  const normalized = dateStr.replace(' ', 'T').replace(/\.\d{4,6}$/, '.000');
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
      
      const start = new Date(startDate);
      const end = new Date(endDate);

      let finalEnd: Date;

      if (c.campaignType === 'ONE_TIME' || c.campaignType === 'BROADCAST_LIVE_ACTIVITY') {
        // One-time campaigns: show on a single day.
        // If end is same as start (or before), show as a 1-hour pill on the start day.
        // If end is genuinely a different date, use it.
        const startDay = start.toISOString().slice(0, 10);
        const endDay = end.toISOString().slice(0, 10);

        if (startDay === endDay || end <= start) {
          // Same day — cap to end of that day (23:59) so it stays within the day cell
          finalEnd = new Date(start);
          finalEnd.setHours(23, 59, 59, 999);
        } else {
          finalEnd = end;
        }
      } else {
        // Recurring / triggered campaigns: if end <= start, show for 1 day
        finalEnd = end <= start ? new Date(start.getTime() + 86400000) : end;
      }

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
