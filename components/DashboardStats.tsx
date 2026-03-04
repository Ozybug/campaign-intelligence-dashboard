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
      <StatCard title="TOTAL CAMPAIGNS" value={stats.totalCampaigns} icon="📅" accent="violet" />
      <StatCard title="ACTIVE NOW" value={stats.activeCampaigns} icon="🟢" accent="emerald" />
      <StatCard title="CHANNELS" value={stats.channels.length} icon="📡" accent="sky" />
      <StatCard title="COLLISIONS" value={stats.collisions} icon="✅" accent="rose" />
    </div>
  );
}

function StatCard({ title, value, icon, accent }: { title: string; value: number; icon: string; accent: string }) {
  const accentMap: Record<string, { bg: string; border: string; text: string; num: string }> = {
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-500', num: 'text-violet-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-500', num: 'text-emerald-700' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-500', num: 'text-sky-700' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-500', num: 'text-rose-700' },
  };
  const colors = accentMap[accent] || accentMap.violet;
  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`${colors.text} text-xs font-semibold tracking-wider`}>{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${colors.num}`}>{value}</div>
    </div>
  );
}
