"use client";

import { useEffect, useState } from 'react';

interface StatsData {
  totalCampaigns: number;
  activeCampaigns: number;
  channels: string[];
  collisions: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(res => res.json())
      .then(data => {
        const events = data.events || [];
        const active = events.filter((e: any) => e.extendedProps?.status === 'active').length;
        const channels = [...new Set(events.map((e: any) => e.extendedProps?.channel))];
        setStats({
          totalCampaigns: events.length,
          activeCampaigns: active,
          channels: channels as string[],
          collisions: (data.collisions || []).length,
        });
      });
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: 'Total Campaigns', value: stats.totalCampaigns, icon: '📅', color: 'text-blue-400' },
        { label: 'Active Now', value: stats.activeCampaigns, icon: '🟢', color: 'text-green-400' },
        { label: 'Channels', value: stats.channels.length, icon: '📡', color: 'text-purple-400' },
        {
          label: 'Collisions',
          value: stats.collisions,
          icon: stats.collisions > 0 ? '⚠️' : '✅',
          color: stats.collisions > 0 ? 'text-yellow-400' : 'text-green-400',
        },
      ].map(({ label, value, icon, color }) => (
        <div key={label} className="bg-gray-900 rounded-xl p-4 shadow-xl border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
            <span>{icon}</span>
          </div>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}