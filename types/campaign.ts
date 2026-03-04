// ─── Channel type — all 11 MoEngage channels ───────────────────────────────
export type Channel =
  // OUTBOUND
  | 'Push'
  | 'Email'
  | 'SMS'
  | 'MMS'
  | 'RCS'
  // INBOUND
  | 'In-App'
  | 'On-site'
  | 'Cards'
  // MESSAGING APPS
  | 'WhatsApp'
  // PERSONALIZATION
  | 'Web'
  // AUDIENCE
  | 'Facebook'
  | 'Google Ads'
  // CONNECTOR
  | 'Custom';

// ─── Delivery / sub-type ────────────────────────────────────────────────────
export type DeliveryType =
  | 'One Time'
  | 'Periodic'
  | 'Event Triggered'
  | 'Business Event Triggered'
  | 'Device Triggered'
  | 'Location Triggered';

// ─── Group ──────────────────────────────────────────────────────────────────
export type ChannelGroup =
  | 'OUTBOUND'
  | 'INBOUND'
  | 'MESSAGING_APPS'
  | 'PERSONALIZATION'
  | 'AUDIENCE'
  | 'CONNECTOR';

export interface SegmentFilter {
  name: string;
  operator?: string;
  value?: string | number | boolean;
  category?: string;
  data_type?: string;
  negate?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  channel: Channel;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'Scheduled' | 'Paused' | 'Draft' | 'Cancelled';
  targetAudience?: string;
  campaignType?: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  includedFilters?: SegmentFilter[];
  excludedFilters?: SegmentFilter[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    channel: Channel;
    status: string;
    campaignType?: string;
    targetAudience?: string;
    includedFilters?: SegmentFilter[];
    excludedFilters?: SegmentFilter[];
    target_segment?: string;
    budget?: number;
  };
}

/**
 * Performance metrics from MoEngage Campaign Analytics.
 * Only fields natively shown in the MoEngage UI are included.
 *
 * Delivery: attempted | sent | failedToSend
 * Engagement: impressions | clicks | ctr
 *
 * Fabricated metrics (delivered, conversions, revenue, conversionRate)
 * are intentionally omitted — they are not shown in MoEngage natively.
 */
export interface CampaignMetrics {
  campaignId: string;
  attribution?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  // Delivery (MoEngage Delivery section)
  attempted?: number;
  sent?: number;
  failedToSend?: number;
  // Engagement (MoEngage Engagement section)
  impressions?: number;
  clicks?: number;
  ctr?: number;
  // GA4 supplemental fields
  sessions?: number;
  users?: number;
  bounceRate?: number;
}

export interface CollisionWarning {
  campaigns: Campaign[];
  overlapStart: string;
  overlapEnd: string;
}
