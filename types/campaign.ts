export type Channel = 'Push' | 'Email' | 'WhatsApp' | 'SMS' | 'In-App' | 'Web';

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
    * Delivery:  attempted | sent | failedToSend
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
