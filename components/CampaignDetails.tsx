"use client";

import { useEffect, useState } from 'react';
import { CalendarEvent, CampaignMetrics } from '@/types/campaign';

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
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-slate-100 text-slate-500 border-slate-200',
  scheduled: 'bg-violet-100 text-violet-600 border-violet-200',
  paused: 'bg-amber-100 text-amber-600 border-amber-200',
  draft: 'bg-gray-100 text-gray-500 border-gray-200',
};

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-violet-100 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function FilterBadge({ filter, negate }: { filter: SegmentFilter; negate?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${
        negate
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-violet-50 text-violet-700 border-violet-200'
      }`}
    >
      {negate && <span className="font-bold text-rose-500">NOT</span>}
      <span className="font-semibold">{filter.name}</span>
      {filter.operator && <span className="text-slate-400">{filter.operator}</span>}
      {filter.value !== undefined && filter.value !== '' && (
        <span className="text-violet-900 font-medium">{String(filter.value)}</span>
      )}
    </span>
  );
}

// Parse segmentation / target-user details from the MoEngage campaign info response
function parseCampaignInfo(data: any): CampaignInfo {
  const seg = data?.segmentation_details || data?.segmentation || {};
  const isAllUsers = seg?.is_all_user_campaign ?? false;
  const targetAudience = isAllUsers
    ? 'All Users'
    : seg?.segment_name || data?.segment_name || data?.target_audience || 'Segmented Users';
  const segmentName = seg?.segment_name || data?.segment_name;

  const mapFilter = (f: any): SegmentFilter => ({
    name: f?.attribute_name || f?.name || f?.event_name || 'Filter',
    operator: f?.operator || f?.filter_operator,
    value: f?.attribute_value ?? f?.value,
    category: f?.category || f?.filter_type,
    data_type: f?.data_type,
    negate: !!f?.negate,
  });

  const rawIncluded: any[] =
    seg?.included_segments ||
    seg?.filters ||
    seg?.conditions ||
    data?.filters ||
    [];
  const rawExcluded: any[] =
    seg?.excluded_segments ||
    seg?.exclude_filters ||
    data?.exclude_filters ||
    [];

  return {
    targetAudience,
    segmentName,
    includedFilters: Array.isArray(rawIncluded) ? rawIncluded.map(mapFilter) : [],
    excludedFilters: Array.isArray(rawExcluded) ? rawExcluded.map(mapFilter) : [],
  };
}

export default function CampaignDetails({ campaign }: Props) {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [campaignInfo, setCampaignInfo] = useState<CampaignInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaign) return;

    setLoading(true);
    setMetrics(null);
    setCampaignInfo(null);
    setStatsError(null);

    const channel = campaign.extendedProps.channel;
    const id = encodeURIComponent(campaign.id);
    const ch = encodeURIComponent(channel);

    // Fetch campaign performance stats with attribution always click_through
    fetch(`/api/campaign-stats?campaignId=${id}&channel=${ch}&attribution=click_through`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatsError(data.error);
        } else {
          setMetrics(data);
          // If the API returns full campaign info (segmentation), parse it
          if (data.campaignData) {
            setCampaignInfo(parseCampaignInfo(data.campaignData));
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setStatsError('Failed to load campaign stats');
        setLoading(false);
      });
  }, [campaign]);

  if (!campaign) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-violet-100 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-lg font-medium text-violet-500">Select a campaign</p>
          <p className="text-sm mt-1 text-violet-300">Click any campaign on the calendar to view details</p>
        </div>
      </div>
    );
  }

  const statusColor =
    STATUS_COLORS[campaign.extendedProps.status?.toLowerCase()] || STATUS_COLORS.draft;
  const ep = campaign.extendedProps;

  // Prefer live-fetched info; fall back to extendedProps from calendar event
  const resolvedTarget =
    campaignInfo?.targetAudience || ep.targetAudience || 'Segmented Users';
  const isAllUsers = resolvedTarget === 'All Users';
  const includedFilters: SegmentFilter[] =
    campaignInfo?.includedFilters ?? ep.includedFilters ?? [];
  const excludedFilters: SegmentFilter[] =
    campaignInfo?.excludedFilters ?? ep.excludedFilters ?? [];
  const hasFilters = includedFilters.length > 0 || excludedFilters.length > 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-violet-100">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-violet-900 mb-1">{campaign.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: campaign.backgroundColor + '33',
                color: campaign.borderColor,
                borderColor: campaign.borderColor,
              }}
            >
              {ep.channel}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
              {ep.status}
            </span>
            {ep.campaignType && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-sky-50 text-sky-600 border-sky-200">
                {ep.campaignType.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Info */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
          <p className="text-violet-400 text-xs mb-1">Start Date</p>
          <p className="text-violet-800 font-medium">{campaign.start}</p>
        </div>
        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
          <p className="text-violet-400 text-xs mb-1">End Date</p>
          <p className="text-violet-800 font-medium">{campaign.end || campaign.start}</p>
        </div>
      </div>

      {/* Target Users */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">
          Target Users
        </h3>
        <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{isAllUsers ? '🌐' : '🎯'}</span>
            <span className="text-violet-800 font-semibold text-sm">{resolvedTarget}</span>
          </div>

          {/* Included Filters */}
          {includedFilters.length > 0 && (
            <div className="mt-2">
              <p className="text-violet-400 text-xs mb-1.5 font-medium">Include filters</p>
              <div className="flex flex-wrap gap-1.5">
                {includedFilters.map((f, i) => (
                  <FilterBadge key={i} filter={f} negate={f.negate} />
                ))}
              </div>
            </div>
          )}

          {/* Excluded Filters */}
          {excludedFilters.length > 0 && (
            <div className="mt-2">
              <p className="text-rose-400 text-xs mb-1.5 font-medium">Exclude filters</p>
              <div className="flex flex-wrap gap-1.5">
                {excludedFilters.map((f, i) => (
                  <FilterBadge key={i} filter={f} negate />
                ))}
              </div>
            </div>
          )}

          {!hasFilters && !isAllUsers && (
            <p className="text-violet-300 text-xs mt-1">No filter details available</p>
          )}
        </div>
      </div>

      {/* Performance Metrics - dynamic from campaign-stats API, always click_through */}
      <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide mb-1">
        Performance Metrics
      </h3>
      <p className="text-xs text-violet-300 mb-3 flex items-center gap-1">
        <span>📊</span>
        Campaign performance stats · Attribution:{' '}
        <span className="font-semibold text-violet-400">Click-through</span>
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-violet-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400 mr-2" />
          Loading metrics...
        </div>
      ) : statsError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-600 text-sm">
          <span className="font-medium">Could not load stats:</span> {statsError}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-3">
          {metrics.sent !== undefined && (
            <MetricCard label="Sent" value={metrics.sent.toLocaleString()} icon="📤" color="text-violet-600" />
          )}
          {metrics.delivered !== undefined && (
            <MetricCard label="Delivered" value={metrics.delivered.toLocaleString()} icon="✅" color="text-emerald-600" />
          )}
          {metrics.impressions !== undefined && (
            <MetricCard label="Impressions" value={metrics.impressions.toLocaleString()} icon="👁️" color="text-violet-600" />
          )}
          {metrics.clicks !== undefined && (
            <MetricCard label="Clicks" value={metrics.clicks.toLocaleString()} icon="🖱️" color="text-sky-600" />
          )}
          {metrics.conversions !== undefined && (
            <MetricCard label="Conversions" value={metrics.conversions.toLocaleString()} icon="🎯" color="text-fuchsia-600" />
          )}
          {metrics.revenue !== undefined && metrics.revenue > 0 && (
            <MetricCard label="Revenue" value={`$${metrics.revenue.toLocaleString()}`} icon="💰" color="text-amber-600" />
          )}
          {metrics.ctr !== undefined && (
            <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} icon="📈" color="text-sky-600" />
          )}
          {metrics.conversionRate !== undefined && (
            <MetricCard label="Conv. Rate" value={`${metrics.conversionRate.toFixed(2)}%`} icon="📊" color="text-fuchsia-600" />
          )}
          {metrics.sessions !== undefined && (
            <MetricCard label="Sessions" value={metrics.sessions.toLocaleString()} icon="👁️" color="text-violet-600" />
          )}
          {metrics.users !== undefined && metrics.clicks === undefined && (
            <MetricCard label="Users" value={metrics.users.toLocaleString()} icon="👥" color="text-emerald-600" />
          )}
        </div>
      ) : (
        <p className="text-violet-300 text-sm text-center py-4">No metrics available</p>
      )}
    </div>
  );
}
