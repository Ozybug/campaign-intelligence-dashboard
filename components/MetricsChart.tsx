"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CampaignMetrics } from '@/types/campaign';

interface Props {
  metrics: CampaignMetrics | null;
  campaignName: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e1e1e] border border-[#444444] rounded-lg p-3 text-sm shadow-md">
        <p className="text-[#888888] font-medium mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.fill }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MetricsChart({ metrics, campaignName }: Props) {
  if (!metrics) {
    return (
      <div className="bg-[#1e1e1e] rounded-xl p-6 shadow-sm border border-[#444444] flex items-center justify-center h-48">
        <p className="text-[#888888] text-sm">Select a campaign to view performance charts</p>
      </div>
    );
  }

  // Delivery metrics from MoEngage Stats API
  const deliveryData = [
    ...(metrics.attempted ? [{ name: 'Attempted', value: metrics.attempted, fill: '#818CF8' }] : []),
    ...(metrics.sent ? [{ name: 'Sent', value: metrics.sent, fill: '#34D399' }] : []),
    ...(metrics.failedToSend ? [{ name: 'Failed', value: metrics.failedToSend, fill: '#F87171' }] : []),
  ];

  // Engagement metrics from MoEngage Stats API
  const engagementData = [
    ...(metrics.impressions ? [{ name: 'Impressions', value: metrics.impressions, fill: '#818CF8' }] : []),
    ...(metrics.clicks ? [{ name: 'Clicks', value: metrics.clicks, fill: '#34D399' }] : []),
  ];

  const barData = deliveryData.length > 0 ? deliveryData : engagementData;
  const hasDelivery = metrics.attempted || metrics.sent || metrics.failedToSend;
  const hasEngagement = metrics.impressions || metrics.clicks;

  return (
    <div className="bg-[#1e1e1e] rounded-xl p-6 shadow-sm border border-[#444444]">
      <h3 className="text-lg font-bold text-[#E0E0E0] mb-1">Performance Chart</h3>
      <p className="text-[#888888] text-sm mb-5 truncate">{campaignName}</p>

      {barData.length > 0 && (
        <div className="mb-6">
          <p className="text-[#888888] text-xs uppercase tracking-wide mb-3">
            {hasDelivery ? 'Delivery Metrics' : 'Engagement Metrics'}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
              <XAxis dataKey="name" stroke="#A78BFA" tick={{ fontSize: 11 }} />
              <YAxis stroke="#A78BFA" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#818CF8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="text-[#888888] text-xs uppercase tracking-wide mb-3">Engagement Overview</p>
        <div className="grid grid-cols-3 gap-3">
          {metrics.impressions !== undefined && (
            <div className="bg-[#2a2a2a] rounded-lg p-3 text-center border border-[#444444]">
              <p className="text-indigo-500 text-lg font-bold">{metrics.impressions.toLocaleString()}</p>
              <p className="text-[#888888] text-xs mt-1">Impressions</p>
            </div>
          )}
          {metrics.clicks !== undefined && (
            <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
              <p className="text-emerald-500 text-lg font-bold">{metrics.clicks.toLocaleString()}</p>
              <p className="text-emerald-400 text-xs mt-1">Clicks</p>
            </div>
          )}
          {metrics.ctr !== undefined && (
            <div className="bg-fuchsia-50 rounded-lg p-3 text-center border border-fuchsia-100">
              <p className="text-fuchsia-500 text-lg font-bold">{metrics.ctr.toFixed(2)}%</p>
              <p className="text-fuchsia-400 text-xs mt-1">CTR</p>
            </div>
          )}
          {!hasEngagement && metrics.sent !== undefined && (
            <div className="bg-[#2a2a2a] rounded-lg p-3 text-center border border-[#444444]">
              <p className="text-indigo-500 text-lg font-bold">{metrics.sent.toLocaleString()}</p>
              <p className="text-[#888888] text-xs mt-1">Sent</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
