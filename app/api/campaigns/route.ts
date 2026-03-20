import { NextResponse } from 'next/server'
import { fetchMoEngageCampaigns } from '@/lib/moengage'
import { detectCollisions } from '@/lib/collision'

// Prevent Vercel ISR/CDN caching — this route fetches live data from MoEngage
export const dynamic = 'force-dynamic'

const CHANNEL_COLORS: Record<string, string> = {
  'Push':        '#818CF8',
  'Email':       '#34D399',
  'SMS':         '#FCD34D',
  'MMS':         '#FB923C',
  'RCS':         '#38BDF8',
  'In-App':      '#C084FC',
  'On-site':     '#A78BFA',
  'Cards':       '#818CF8',
  'WhatsApp':    '#6EE7B7',
  'Web':         '#F9A8D4',
  'Facebook':    '#60A5FA',
  'Google Ads':  '#FCA5A5',
  'Custom':      '#94A3B8',
}

function normalizeDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toISOString()
  const normalized = dateStr.replace(' ', 'T').replace('.000', '')
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return new Date(dateStr).toISOString()
  return d.toISOString()
}

// Returns the next calendar day as a YYYY-MM-DD string using pure UTC arithmetic.
// We use this as FullCalendar's EXCLUSIVE end for single-day events.
// A date-only end like "2026-03-05" means "up to but not including Mar 5",
// so the event stays strictly on Mar 4 regardless of the viewer's timezone.
function nextUTCDay(isoStr: string): string {
  const d = new Date(isoStr.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const allCampaigns = await fetchMoEngageCampaigns()
    const isMock = allCampaigns.length > 0 && allCampaigns[0].id.startsWith('mock_')

    // On-site campaigns belong exclusively to the On-Site Litematica page (/onsite)
    const campaigns = allCampaigns.filter((c) => c.channel !== 'On-site')
    const collisions = detectCollisions(campaigns)

    const events = campaigns.map((c) => {
      const startDate = normalizeDate(c.startDate)
      const endDate   = normalizeDate(c.endDate || c.startDate)
      const start     = new Date(startDate)
      const end       = new Date(endDate)
      const startDay  = startDate.slice(0, 10)
      const endDay    = endDate.slice(0, 10)

      // Use the next day as exclusive end for single-day events;
      // for genuinely multi-day campaigns, use endDay + 1 so FullCalendar
      // renders the banner inclusive of the end date.
      const eventEndDay = endDay > startDay ? nextUTCDay(endDate) : nextUTCDay(startDate)
      const eventEnd = eventEndDay

      return {
        title: c.name,
        start: startDay,   // date-only to avoid UTC→local timezone shift
        end:   eventEnd,
        backgroundColor: CHANNEL_COLORS[c.channel] || '#6B7280',
        borderColor:     CHANNEL_COLORS[c.channel] || '#6B7280',
        extendedProps: {
          channel:         c.channel,
          status:          c.status,
          campaignType:    c.campaignType,
          targetAudience:  c.targetAudience,
          includedFilters: c.includedFilters || [],
          excludedFilters: c.excludedFilters || [],
        },
        id: c.id,
      }
    })

    return NextResponse.json({
      campaigns,
      events,
      collisions,
      total:     campaigns.length,
      source:    isMock ? 'mock' : 'moengage_api',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    )
  }
}
