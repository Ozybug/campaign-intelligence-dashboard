"use client";
import { useEffect, useState } from 'react';
import { CalendarEvent, CampaignMetrics } from '@/types/campaign';
import {
    CHANNELS,
    GROUPS,
    getGroupForChannel,
    isDirectLaunch,
    API_DELIVERY_TYPE_MAP,
} from '@/lib/taxonomy';

interface SegmentFilter {
    name: string;
    operator?: string;
    value?: string | number | boolean;
    category?: string;
    data_type?: string;
    negate?: boolean;
}

interface CampaignInfo {
    targetAudience?: string;
    segmentName?: string;
    includedFilters?: SegmentFilter[];
    excludedFilters?: SegmentFilter[];
}

interface Props {
    campaign: CalendarEvent | null;
}

const STATUS_COLORS: Record<string, string> = {
    active:    'bg-[#1e1e1e] text-emerald-700 border-emerald-200',
    completed: 'bg-slate-100 text-[#B0B0B0] border-slate-200',
    scheduled: 'bg-[#2a2a2a] text-[#888888] border-[#444444]',
    paused:    'bg-amber-100 text-amber-600 border-amber-200',
    draft:     'bg-gray-100 text-gray-500 border-[#444444]',
};

// Group label colours (one per group)
const GROUP_COLORS: Record<string, string> = {
    OUTBOUND:        'bg-blue-50 text-blue-700 border-blue-200',
    INBOUND:         'bg-purple-50 text-purple-700 border-purple-200',
    MESSAGING_APPS:  'bg-green-50 text-green-700 border-green-200',
    PERSONALIZATION: 'bg-pink-50 text-pink-700 border-pink-200',
    AUDIENCE:        'bg-orange-50 text-orange-700 border-orange-200',
    CONNECTOR:       'bg-slate-100 text-[#B0B0B0] border-slate-200',
};

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
    return (
          <div className="bg-[#1e1e1e] rounded-lg p-4 border border-[#444444] shadow-sm">
                <div className="flex items-center justify-between mb-1">
                        <span className="text-[#B0B0B0] text-xs uppercase tracking-wide">{label}</span>span>
                        <span className="text-lg">{icon}</span>span>
                </div>div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>p>
          </div>div>
        );
}

function FilterBadge({ filter, isExcluded }: { filter: SegmentFilter; isExcluded?: boolean }) {
    const negative = isExcluded || filter.negate;
    const showNot  = filter.negate === true;
    return (
          <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${
                            negative
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-violet-50 text-violet-700 border-violet-200'
                  }`}
                >
            {showNot && <span className="font-bold text-rose-500">NOT</span>span>}
                <span className="font-semibold">{filter.name}</span>span>
            {filter.operator && <span className="text-slate-400">{filter.operator}</span>span>}
            {filter.value !== undefined && filter.value !== '' && (
                          <span className="text-violet-900 font-medium">{String(filter.value)}</span>span>
                )}
          </span>span>
        );
}

function parseCampaignInfo(data: any): CampaignInfo {
    const seg = data?.segmentation_details || data?.segmentation || {};
    const isAllUsers = seg?.is_all_user_campaign ?? false;
    const targetAudience = isAllUsers
          ? 'All Users'
          : seg?.segment_name || data?.segment_name || data?.target_audience || 'Segmented Users';
    const segmentName = seg?.segment_name || data?.segment_name;
    const mapFilter = (f: any): SegmentFilter => ({
          name:     f?.attribute_name || f?.segment_name || f?.name || f?.event_name || 'Filter',
          operator: f?.operator || f?.filter_operator,
          value:    f?.attribute_value ?? f?.value,
          category: f?.category || f?.filter_type,
          data_type:f?.data_type,
          negate:   !!f?.negate,
    });
    const rawIncluded: any[] = seg?.included_segments || seg?.filters || seg?.conditions || data?.filters || [];
    const rawExcluded: any[] = seg?.excluded_segments || seg?.exclude_filters || data?.exclude_filters || [];
    return {
          targetAudience,
          segmentName,
          includedFilters:  Array.isArray(rawIncluded) ? rawIncluded.map(mapFilter) : [],
          excludedFilters:  Array.isArray(rawExcluded) ? rawExcluded.map(mapFilter) : [],
    };
}

// ─── Delivery type display helpers ───────────────────────────────────────────
function resolveDeliveryTypeLabel(raw: string | undefined): string | null {
    if (!raw) return null;
    if (Object.values(API_DELIVERY_TYPE_MAP).includes(raw as any)) return raw;
    const mapped = API_DELIVERY_TYPE_MAP[raw.toUpperCase()];
    if (mapped) return mapped;
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function CampaignDetails({ campaign }: Props) {
    const [metrics, setMetrics]           = useState<CampaignMetrics | null>(null);
    const [campaignInfo, setCampaignInfo] = useState<CampaignInfo | null>(null);
    const [loading, setLoading]           = useState(false);
    const [statsError, setStatsError]     = useState<string | null>(null);
  
    useEffect(() => {
          if (!campaign) return;
          setLoading(true);
          setMetrics(null);
          setCampaignInfo(null);
          setStatsError(null);
          const channel = campaign.extendedProps.channel;
          const id  = encodeURIComponent(campaign.id);
          const ch  = encodeURIComponent(channel);
          fetch(`/api/campaign-stats?campaignId=${id}&channel=${ch}&attribution=click_through`)
                  .then((res) => res.json())
                  .then((data) => {
                            if (data.error) {
                                        setStatsError(data.error);
                            } else {
                                        setMetrics(data);
                                        if (data.campaignData) setCampaignInfo(parseCampaignInfo(data.campaignData));
                            }
                            setLoading(false);
                  })
                  .catch(() => {
                            setStatsError('unavailable');
                            setLoading(false);
                  });
    }, [campaign]);
  
    if (!campaign) {
          return (
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-violet-100 h-full flex items-center justify-center">
                          <div className="text-center">
                                    <div className="text-5xl mb-3">📋</div>div>
                                    <p className="text-lg font-medium text-violet-500">Select a campaign</p>p>
                                    <p className="text-sm mt-1 text-violet-300">Click any campaign on the calendar to view details</p>p>
                          </div>div>
                  </div>div>
                );
    }
  
    const ep         = campaign.extendedProps;
    const channel    = ep.channel;
    const channelCfg = CHANNELS[channel];
    const groupId    = getGroupForChannel(channel);
    const groupCfg   = GROUPS.find(g => g.id === groupId);
    const statusColor = STATUS_COLORS[ep.status?.toLowerCase()] || STATUS_COLORS.draft;
    const groupColor  = GROUP_COLORS[groupId || ''] || GROUP_COLORS.OUTBOUND;
  
    const deliveryLabel   = resolveDeliveryTypeLabel(ep.campaignType);
    const showDeliveryType = deliveryLabel && channelCfg?.hasSubTypes === true;
    const channelDirect   = isDirectLaunch(channel);
  
    const resolvedTarget = campaignInfo?.targetAudience || ep.targetAudience || 'Segmented Users';
    const isAllUsers     = resolvedTarget === 'All Users';
    const includedFilters: SegmentFilter[] = campaignInfo?.includedFilters ?? ep.includedFilters ?? [];
    const excludedFilters: SegmentFilter[] = campaignInfo?.excludedFilters ?? ep.excludedFilters ?? [];
    const hasFilters = includedFilters.length > 0 || excludedFilters.length > 0;
    const hasMetrics = metrics !== null && !statsError;
  
    return (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-violet-100">
            {/* ── Header ──────────────────────────────────────────────────────── */}
                <div className="mb-5">
                        <h2 className="text-xl font-bold text-violet-900 mb-2">{campaign.title}</h2>h2>
                        <div className="flex items-center gap-2 flex-wrap">
                          {groupCfg && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${groupColor}`}>
                          {groupCfg.label}
                        </span>span>
                                  )}
                                  <span
                                                className="px-2 py-0.5 rounded-full text-xs font-medium border"
                                                style={{
                                                                backgroundColor: campaign.backgroundColor + '33',
                                                                color:           campaign.borderColor,
                                                                borderColor:     campaign.borderColor,
                                                }}
                                              >
                                    {channelCfg?.icon ?? ''} {channel}
                                  </span>span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
                                    {ep.status}
                                  </span>span>
                          {showDeliveryType && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-sky-50 text-sky-700 border-sky-200">
                          {deliveryLabel}
                        </span>span>
                                  )}
                          {channelDirect && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-teal-50 text-teal-700 border-teal-200">
                                      Direct Launch
                        </span>span>
                                  )}
                        </div>div>
                </div>div>
          
            {/* ── Dates ───────────────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                                  <p className="text-violet-400 text-xs mb-1">Start Date</p>p>
                                  <p className="text-violet-800 font-medium">{campaign.start}</p>p>
                        </div>
                        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                                  <p className="text-violet-400 text-xs mb-1">End Date</p>p>
                                  <p className="text-violet-800 font-medium">{campaign.end || campaign.start}</p>p>
                        </div>div>
                </div>div>
          
            {/* ── Target Users ─────────────────────────────────────────────────── */}
                <div className="mb-4">
                        <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">
                                  Target Users
                        </h3>h3>
                        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                                  <div className="flex items-center gap-2 mb-1">
                                              <span className="text-lg">{isAllUsers ? '🌐' : '🎯'}</span>span>
                                              <span className="text-violet-800 font-semibold text-sm">{resolvedTarget}</span>span>
                                  </div>div>
                          {includedFilters.length > 0 && (
                        <div className="mt-2">
                                      <p className="text-violet-400 text-xs mb-1.5 font-medium">Include filters</p>p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {includedFilters.map((f, i) => (
                                            <FilterBadge key={i} filter={f} />
                                          ))}
                                      </div>div>
                        </div>div>
                                  )}
                          {excludedFilters.length > 0 && (
                        <div className="mt-2">
                                      <p className="text-rose-400 text-xs mb-1.5 font-medium">Exclude filters</p>p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {excludedFilters.map((f, i) => (
                                            <FilterBadge key={i} filter={f} isExcluded />
                                          ))}
                                      </div>div>
                        </div>div>
                                  )}
                          {!hasFilters && !isAllUsers && (
                        <p className="text-violet-300 text-xs mt-1">No filter details available</p>p>
                                  )}
                        </div>div>
                </div>div>
          
            {/* ── Performance Metrics ──────────────────────────────────────────── */}
            {loading && (
                    <div className="flex items-center justify-center h-16 text-violet-300">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-300 mr-2" />
                              <span className="text-sm">Loading metrics…</span>span>
                    </div>div>
                )}
            {!loading && hasMetrics && metrics && (
                    <>
                              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-1">
                                          Performance Metrics
                              </h3>h3>
                              <p className="text-xs text-violet-300 mb-3 flex items-center gap-1">
                                          <span>📊</span>span> Campaign performance stats · Attribution:{' '}
                                          <span className="font-semibold text-violet-400">Click-through</span>span>
                              </p>p>
                              <div className="grid grid-cols-2 gap-3">
                                {metrics.attempted  !== undefined && <MetricCard label="Attempted"     value={metrics.attempted.toLocaleString()}              icon="🚀" color="text-violet-600" />}
                                {metrics.sent       !== undefined && <MetricCard label="Sent"          value={metrics.sent.toLocaleString()}                   icon="📤" color="text-violet-600" />}
                                {metrics.failedToSend !== undefined && <MetricCard label="Failed to Send" value={metrics.failedToSend.toLocaleString()}        icon="⚠️" color="text-rose-500"   />}
                                {metrics.impressions !== undefined && <MetricCard label="Impressions"  value={metrics.impressions.toLocaleString()}            icon="👁️" color="text-violet-600" />}
                                {metrics.clicks     !== undefined && <MetricCard label="Clicked"       value={metrics.clicks.toLocaleString()}                 icon="🖱️" color="text-sky-600"    />}
                                {metrics.ctr        !== undefined && <MetricCard label="CTR"           value={`${metrics.ctr.toFixed(2)}%`}                   icon="📈" color="text-sky-600"    />}
                              </div>div>
                    </>>
                  )}
          </div>div>
        );
}</></div>
