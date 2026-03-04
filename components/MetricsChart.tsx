"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CampaignMetrics } from '@/types/campaign';

interface Props {
  metrics: CampaignMetrics | null;
  campaignName: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
        <p className="text-gray-300 font-medium mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.fill }}>
            {entry.name}: {entry.name === 'Revenue' ? `$${entry.value.toLocaleString()}` : entry.value.toLocaleString()}
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
      <div className="bg-gray-900 rounded-xl p-6 shadow-xl flex items-center justify-center h-48">
        <p className="text-gray-500 text-sm">Select a campaign to view performance charts</p>
      </div>
    );
  }

  const barData = [
    { name: 'Sessions', value: metrics.sessions, fill: '#3B82F6' },
    { name: 'Users', value: metrics.users, fill: '#10B981' },
    { name: 'Conversions', value: metrics.conversions, fill: '#8B5CF6' },
  ];

  const revenueData = [
    { name: 'Revenue', value: metrics.revenue, fill: '#F59E0B' },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-6 shadow-xl">
      <h3 className="text-lg font-bold text-white mb-1">Performance Chart</h3>
      <p className="text-gray-400 text-sm mb-5 truncate">{campaignName}</p>

      <div className="mb-6">
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Traffic Metrics</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {barData.map((entry, index) => (
                <rect key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Engagement Overview</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-blue-400 text-lg font-bold">{metrics.sessions.toLocaleString()}</p>
            <p className="text-gray-400 text-xs mt-1">Sessions</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-yellow-400 text-lg font-bold">{metrics.bounceRate}%</p>
            <p className="text-gray-400 text-xs mt-1">Bounce Rate</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-purple-400 text-lg font-bold">
              {((metrics.conversions / metrics.sessions) * 100).toFixed(1)}%
            </p>
            <p className="text-gray-400 text-xs mt-1">Conv. Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}