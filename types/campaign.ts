export type Channel = 'Push' | 'Email' | 'WhatsApp' | 'SMS' | 'In-App' | 'Web';

export interface Campaign {
  id: string;
  name: string;
  channel: Channel;
  start_time: string;
  end_time: string;
  status: 'active' | 'completed' | 'scheduled' | 'paused' | 'draft';
  target_segment?: string;
  budget?: number;
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
    target_segment?: string;
    budget?: number;
  };
}

export interface CampaignMetrics {
  campaignId: string;
  startDate: string;
  endDate: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  bounceRate: number;
}

export interface CollisionWarning {
  campaigns: Campaign[];
  overlapStart: string;
  overlapEnd: string;
}