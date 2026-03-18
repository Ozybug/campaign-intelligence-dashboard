"use client";

import { useEffect, useState } from 'react';

interface StatsData {
    totalCampaigns: number;
    activeCampaigns: number;
    channels: string[];
    collisions: number;
}

function MatIcon({ name, className = '' }: { name: string; className?: string }) {
    return (
          <span
                  className={`material-symbols-outlined ${className}`}
                  style={{ fontSize: '1.25rem', lineHeight: 1, verticalAlign: 'middle' }}
                >
            {name}
          </span>
        );
}

export default function DashboardStats() {
    const [stats, setStats] = useState<StatsData | null>(null);
  
    useEffect(() => {
          fetch('/api/campaigns')
                  .then(res => res.json())
                  .then(data => {
                            setStats({
                                        totalCampaigns: data.campaigns?.length || 0,
                                        activeCampaigns: data.campaigns?.filter((c: any) => c.status === 'ACTIVE').length || 0,
                                        channels: [...new Set(data.campaigns?.map((c: any) => c.channel) || [])],
                                        collisions: data.collisions?.length || 0,
                            });
                  });
    }, []);
  
    const items = [
      {
              label: 'Total Campaigns',
              value: stats?.totalCampaigns ?? '—',
              icon: 'calendar_month',
              cardClass: 'bg-[#1e1e1e] border border-[#444444]',
              labelClass: 'text-[#888888]',
              valueClass: 'text-[#E0E0E0]',
              iconClass: 'text-[#888888]',
      },
      {
              label: 'Active Now',
              value: stats?.activeCampaigns ?? '—',
              icon: 'radio_button_checked',
              cardClass: 'bg-[#1e1e1e] border border-[#444444]',
              labelClass: 'text-[#888888]',
              valueClass: 'text-[#E0E0E0]',
              iconClass: 'text-emerald-400',
      },
      {
              label: 'Channels',
              value: stats?.channels.length ?? '—',
              icon: 'hub',
              cardClass: 'bg-[#1e1e1e] border border-[#444444]',
              labelClass: 'text-[#888888]',
              valueClass: 'text-[#E0E0E0]',
              iconClass: 'text-[#888888]',
      },
        ];
  
    return (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {items.map((item) => (
                    <div key={item.label} className={`${item.cardClass} rounded-xl p-4 shadow-sm`}>
                              <div className="flex items-center justify-between mb-2">
                                          <span className={`${item.labelClass} text-xs font-semibold tracking-wider`}>{item.label}</span>
                                          <MatIcon name={item.icon} className={item.iconClass} />
                              </div>
                              <div className={`text-3xl font-bold ${item.valueClass}`}>{item.value}</div>
                    </div>
                  ))}
          </div>
        );
}
