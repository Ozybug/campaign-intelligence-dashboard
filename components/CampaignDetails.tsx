"use client";

import { useEffect, useState } from 'react';
import { CalendarEvent, CampaignMetrics } from '@/types/campaign';

interface Props {
  campaign: CalendarEvent | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  draft: 'bg-gray-600/20 text-gray-500 border-gray-600/30',
};

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function CampaignDetails({ campaign }: Props) {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaign) return;
    setLoading(true);
    setMetrics(null);

    const start = campaign.start;
    const end = campaign.end || campaign.start;

    fetch(`/api/analytics?campaignId=${campaign.id}&start=${start}&end=${end}`)
      .then((res) => res.json())
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [campaign]);

  if (!campaign) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 shadow-xl h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-lg font-medium">Select a campaign</p>
          <p className="text-sm mt-1">Click any campaign on the calendar to view details</p>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[campaign.extendedProps.status] || STATUS_COLORS.draft;

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">{campaign.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium border"
              style={{ backgroundColor: campaign.backgroundColor + '33', color: campaign.borderColor, borderColor: campaign.borderColor }}
            >
              {campaign.extendedProps.channel}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
              {campaign.extendedProps.status}
            </span>
          </div>
        </div>
      </div>

      {/* Campaign Info */}
      <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Start Date</p>
          <p className="text-white font-medium">{campaign.start}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">End Date</p>
          <p className="text-white font-medium">{campaign.end || campaign.start}</p>
        </div>
        {campaign.extendedProps.target_segment && (
          <div className="bg-gray-800 rounded-lg p-3 col-span-2">
            <p className="text-gray-400 text-xs mb-1">Target Segment</p>
            <p className="text-white font-medium">{campaign.extendedProps.target_segment}</p>
          </div>
        )}
        {campaign.extendedProps.budget && (
          <div className="bg-gray-800 rounded-lg p-3 col-span-2">
            <p className="text-gray-400 text-xs mb-1">Budget</p>
            <p className="text-white font-medium">${campaign.extendedProps.budget?.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Metrics */}
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Performance Metrics
      </h3>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2" />
          Loading metrics...
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Sessions" value={metrics.sessions.toLocaleString()} icon="👁" color="text-blue-400" />
          <MetricCard label="Users" value={metrics.users.toLocaleString()} icon="👥" color="text-green-400" />
          <MetricCard label="Conversions" value={metrics.conversions.toLocaleString()} icon="🎯" color="text-purple-400" />
          <MetricCard label="Revenue" value={`$${metrics.revenue.toLocaleString()}`} icon="💰" color="text-yellow-400" />
          <MetricCard
            label="Bounce Rate"
            value={`${metrics.bounceRate}%`}
            icon="📉"
            color={metrics.bounceRate > 50 ? 'text-red-400' : 'text-green-400'}
          />
          <MetricCard
            label="Conv. Rate"
            value={`${((metrics.conversions / metrics.sessions) * 100).toFixed(1)}%`}
            icon="📈"
            color="text-cyan-400"
          />
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-4">No metrics available</p>
      )}
    </div>
  );
}