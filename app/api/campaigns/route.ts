import { NextResponse } from 'next/server';
import { getCampaigns } from '@/lib/moengage';
import { detectCollisions } from '@/lib/collision';
import { CalendarEvent, Campaign } from '@/types/campaign';

const CHANNEL_COLORS: Record<string, string> = {
  Push: '#3B82F6',
  Email: '#10B981',
  WhatsApp: '#22C55E',
  SMS: '#F59E0B',
  'In-App': '#8B5CF6',
  Web: '#EC4899',
};

const STATUS_OPACITY: Record<string, string> = {
  active: 'dd',
  scheduled: 'aa',
  completed: '66',
  paused: '88',
  draft: '55',
};

export async function GET() {
  try {
    const campaigns = await getCampaigns();
    const collisions = detectCollisions(campaigns);

    const events: CalendarEvent[] = campaigns.map((c: Campaign) => {
      const baseColor = CHANNEL_COLORS[c.channel] || '#6B7280';
      const opacity = STATUS_OPACITY[c.status] || 'dd';
      return {
        id: c.id,
        title: c.name,
        start: c.start_time,
        end: c.end_time,
        backgroundColor: baseColor + opacity,
        borderColor: baseColor,
        extendedProps: {
          channel: c.channel,
          status: c.status,
          target_segment: c.target_segment,
          budget: c.budget,
        },
      };
    });

    return NextResponse.json({ events, collisions, source: process.env.MOENGAGE_APP_ID ? 'moengage_api' : 'mock' });
  } catch (error) {
    console.error('[API/campaigns]', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}