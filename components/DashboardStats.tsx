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
        const campaigns = data.campaigns || [];
        // Count active by status (case-insensitive)
        const active = campaigns.filter((c: any) => 
          c.status?.toLowerCase() === 'active'
        ).length;
        const channels = [...new Set(campaigns.map((c: any) => c.channel))].filter(Boolean);
        setStats({
          totalCampaigns: campaigns.length,
          activeCampaigns: active,
          channels: channels as string[],
          collisions: (data.collisions || []).length,
        });
      });
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard title="TOTAL CAMPAIGNS" value={stats.totalCampaigns} icon="📅" />
      <StatCard title="ACTIVE NOW" value={stats.activeCampaigns} icon="🟢" />
      <StatCard title="CHANNELS" value={stats.channels.length} icon="📡" />
      <StatCard title="COLLISIONS" value={stats.collisions} icon="✅" />
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-xs font-semibold tracking-wider">{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
    </div>
  );
}
