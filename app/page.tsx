"use client";
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import CampaignDetails from '@/components/CampaignDetails';
import MetricsChart from '@/components/MetricsChart';
import DashboardStats from '@/components/DashboardStats';
import DestinationVisitorsTable from '@/components/DestinationVisitorsTable';
import { CalendarEvent, CampaignMetrics, CollisionWarning } from '@/types/campaign';

const CampaignCalendar = dynamic(() => import('@/components/CampaignCalendar'), { ssr: false });

export default function Home() {
  const [selectedCampaign, setSelectedCampaign] = useState<CalendarEvent | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [collisions, setCollisions] = useState<CollisionWarning[]>([]);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(res => res.json())
      .then(data => setCollisions(data.collisions || []));
  }, []);

  useEffect(() => {
    if (!selectedCampaign) return;
    const start = selectedCampaign.start;
    const end = selectedCampaign.end || selectedCampaign.start;
    fetch(`/api/analytics?campaignId=${selectedCampaign.id}&start=${start}&end=${end}`)
      .then(res => res.json())
      .then(data => setMetrics(data));
  }, [selectedCampaign]);

  return (
    <main className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      <div className="bg-[#1a1a1a] border-b border-[#444444] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0]">Campaign Intelligence Dashboard</h1>
            <p className="text-[#B0B0B0] text-sm mt-0.5">MoEngage x Google Analytics 4 - Real-time campaign performance</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#2a2a2a] text-[#B0B0B0] border border-[#444444] rounded-full text-xs font-medium">Live</span>
            <a href="/flows" className="px-3 py-1 bg-[#333333] text-[#E0E0E0] border border-[#444444] rounded-full text-xs font-medium hover:bg-[#444444] transition-colors">🔀 Flows</a>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-6">
        <DashboardStats />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[#E0E0E0] mb-3">Campaign Calendar</h2>
            <CampaignCalendar onSelect={setSelectedCampaign} collisions={collisions} />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#E0E0E0] mb-3">Campaign Details</h2>
              <CampaignDetails campaign={selectedCampaign} />
            </div>
            <MetricsChart metrics={metrics} campaignName={selectedCampaign?.title || ''} />
          </div>
        </div>
        <div className="mt-8"><DestinationVisitorsTable /></div>
        <div className="mt-8 text-center text-[#888888] text-xs">Powered by MoEngage + Google Analytics 4 - Built with Next.js 14 + Vercel</div>
      </div>
    </main>
  );
}
