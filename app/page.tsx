"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import CampaignDetails from '@/components/CampaignDetails';
import MetricsChart from '@/components/MetricsChart';
import DashboardStats from '@/components/DashboardStats';
import { CalendarEvent, CampaignMetrics, CollisionWarning } from '@/types/campaign';

// Dynamically import FullCalendar (client-only)
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
        <main className="min-h-screen bg-violet-50 text-slate-800">
          {/* Header */}
              <div className="bg-white border-b border-violet-100 px-6 py-4 shadow-sm">
                      <div className="max-w-7xl mx-auto flex items-center justify-between">
                                <div>
                                            <h1 className="text-2xl font-bold text-violet-900">
                                                          Campaign Intelligence Dashboard
                                            </h1>h1>
                                            <p className="text-violet-400 text-sm mt-0.5">
                                                          MoEngage x Google Analytics 4 - Real-time campaign performance
                                            </p>p>
                                </div>div>
                                <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-violet-100 text-violet-600 border border-violet-200 rounded-full text-xs font-medium">
                                                          Live
                                            </span>span>
                                </div>div>
                      </div>div>
              </div>div>
        
          {/* Content */}
              <div className="max-w-7xl mx-auto p-6">
                {/* Stats Row */}
                      <DashboardStats />
              
                {/* Main Layout */}
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Calendar - takes 2/3 */}
                                <div className="xl:col-span-2">
                                            <h2 className="text-lg font-semibold text-violet-800 mb-3">Campaign Calendar</h2>h2>
                                            <CampaignCalendar onSelect={setSelectedCampaign} collisions={collisions} />
                                </div>div>
                      
                        {/* Right panel - Campaign details + chart */}
                                <div className="flex flex-col gap-4">
                                            <div>
                                                          <h2 className="text-lg font-semibold text-violet-800 mb-3">Campaign Details</h2>h2>
                                                          <CampaignDetails campaign={selectedCampaign} />
                                            </div>div>
                                            <MetricsChart
                                                            metrics={metrics}
                                                            campaignName={selectedCampaign?.title || ''}
                                                          />
                                </div>div>
                      </div>div>
              
                {/* Footer */}
                      <div className="mt-8 text-center text-violet-300 text-xs">
                                Powered by MoEngage + Google Analytics 4 - Built with Next.js 14 + Vercel
                      </div>div>
              </div>div>
        </main>main>
      );
}</main>
