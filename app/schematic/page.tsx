"use client";
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CalendarEvent, CollisionWarning } from '@/types/campaign';

const CampaignCalendar = dynamic(() => import('@/components/CampaignCalendar'), { ssr: false });

export default function SchematicPage() {
  const [collisions, setCollisions] = useState<CollisionWarning[]>([]);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(res => res.json())
      .then(data => setCollisions(data.collisions || []));
  }, []);

  // onSelect is required by CampaignCalendar — no-op here for now
  const handleSelect = (_event: CalendarEvent) => {};

  return (
    <main className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#444444] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-1.5 text-[#888888] hover:text-[#cccccc] transition-colors text-xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', lineHeight: 1 }}>arrow_back</span>
              Dashboard
            </a>
            <span className="text-[#444444]">/</span>
            <div>
              <h1 className="text-xl font-bold text-[#E0E0E0] flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: '1.2rem', lineHeight: 1 }}>schema</span>
                Schematic
              </h1>
            </div>
          </div>
          <span className="px-3 py-1 bg-[#2a2a2a] text-[#B0B0B0] border border-[#444444] rounded-full text-xs font-medium">Live</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-7xl mx-auto p-6">
        <CampaignCalendar onSelect={handleSelect} collisions={collisions} hideFilters />
      </div>
    </main>
  );
}
