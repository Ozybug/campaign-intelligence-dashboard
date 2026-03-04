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
      <div className="bg-white border border-violet-100 rounded-lg p-3 text-sm shadow-md">
        <p className="text-violet-700 font-medium mb-1">{label}</p>
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
      <div className="bg-white rounded-xl p-6 shadow-sm border border-violet-100 flex items-center justify-center h-48">
        <p className="text-violet-300 text-sm">Select a campaign to view performance charts</p>
      </div>
    );
  }

  const barData = [
    { name: 'Sessions', value: metrics.sessions, fill: '#818CF8' },
    { name: 'Users', value: metrics.users, fill: '#34D399' },
    { name: 'Conversions', value: metrics.conversions, fill: '#C084FC' },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-violet-100">
      <h3 className="text-lg font-bold text-violet-800 mb-1">Performance Chart</h3>
      <p className="text-violet-400 text-sm mb-5 truncate">{campaignName}</p>

      <div className="mb-6">
        <p className="text-violet-400 text-xs uppercase tracking-wide mb-3">Traffic Metrics</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE9FE" />
            <XAxis dataKey="name" stroke="#A78BFA" tick={{ fontSize: 11 }} />
            <YAxis stroke="#A78BFA" tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}
              fill="#818CF8"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-violet-400 text-xs uppercase tracking-wide mb-3">Engagement Overview</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-violet-50 rounded-lg p-3 text-center border border-violet-100">
            <p className="text-indigo-500 text-lg font-bold">{metrics.sessions.toLocaleString()}</p>
            <p className="text-violet-400 text-xs mt-1">Sessions</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
            <p className="text-amber-500 text-lg font-bold">{metrics.bounceRate}%</p>
            <p className="text-amber-400 text-xs mt-1">Bounce Rate</p>
          </div>
          <div className="bg-fuchsia-50 rounded-lg p-3 text-center border border-fuchsia-100">
            <p className="text-fuchsia-500 text-lg font-bold">
              {((metrics.conversions / metrics.sessions) * 100).toFixed(1)}%
            </p>
            <p className="text-fuchsia-400 text-xs mt-1">Conv. Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
