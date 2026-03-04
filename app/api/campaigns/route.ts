import { NextResponse } from 'next/server';
import { fetchMoEngageCampaigns } from '@/lib/moengage';
import { detectCollisions } from '@/lib/collision';

const CHANNEL_COLORS: Record<string, string> = {
  'Push': '#3B82F6',
  'Email': '#10B981',
  'WhatsApp': '#22C55E',
  'SMS': '#F59E0B',
  'In-App': '#8B5CF6',
  'Web': '#EC4899',
};

function normalizeDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString();
  const normalized = dateStr.replace(' ', 'T').replace(/\.\d{4,6}$/, '.000');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

// Returns the next calendar day as a YYYY-MM-DD string using pure UTC arithmetic.
// We use this as FullCalendar's EXCLUSIVE end for single-day events.
// A date-only end like "2026-03-05" means "up to but not including Mar 5",
// so the event stays strictly on Mar 4 regardless of the viewer's timezone.
function nextUTCDay(isoStr: string): string {
  const d = new Date(isoStr.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const campaigns = await fetchMoEngageCampaigns();
    const collisions = detectCollisions(campaigns);
    const isMock = campaigns.length > 0 && campaigns[0].id.startsWith('mock_');

    const events = campaigns.map(c => {
      const startDate = normalizeDate(c.startDate);
      const endDate   = normalizeDate(c.endDate || c.startDate);
      const start = new Date(startDate);
      const end   = new Date(endDate);
      const startDay = startDate.slice(0, 10);
      const endDay   = endDate.slice(0, 10);

      let eventEnd: string;

      if (c.campaignType === 'ONE_TIME' || c.campaignType === 'BROADCAST_LIVE_ACTIVITY') {
        if (startDay === endDay || end <= start) {
          // Single-day ONE_TIME: use a date-only exclusive end so FullCalendar
          // renders the block only within startDay regardless of timezone.
          // end="2026-03-05" keeps Happy_Holi on Mar 4 even for UTC+5:30 users.
          eventEnd = nextUTCDay(startDate);
        } else {
          eventEnd = endDate;
        }
      } else {
        eventEnd = end <= start ? nextUTCDay(startDate) : endDate;
      }

      return {
        id: c.id,
        title: c.name,
        start: startDate,
        end: eventEnd,
        backgroundColor: CHANNEL_COLORS[c.channel] || '#6B7280',
        borderColor:     CHANNEL_COLORS[c.channel] || '#6B7280',
        extendedProps: {
          channel:        c.channel,
          status:         c.status,
          campaignType:   c.campaignType,
          targetAudience: c.targetAudience,
        },
      };
    });

    return NextResponse.json({
      campaigns, events, collisions,
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
