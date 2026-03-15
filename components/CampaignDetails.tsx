"use client";
import { useEffect, useState } from 'react';
import { CalendarEvent, CampaignMetrics } from '@/types/campaign';
import {
  CHANNELS,
  GROUPS,
  getGroupForChannel,
  isDirectLaunch,
  API_DELIVERY_TYPE_MAP,
} from '@/lib/taxonomy';

interface SegmentFilter {
  name: string;
  operator?: string;
  value?: string | number | boolean;
  category?: string;
  data_type?: string;
  negate?: boolean;
}

interface CampaignInfo {
  targetAudience?: string;
  segmentName?: string;
  includedFilters?: SegmentFilter[];
  excludedFilters?: SegmentFilter[];
}

interface Props {
  campaign: CalendarEvent | null;
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-slate-100 text-[#B0B0B0] border-slate-200',
  scheduled: 'bg-[#2a2a2a] text-[#888888] border-[#444444]',
  paused:    'bg-amber-100 text-amber-600 border-amber-200',
  draft:     'bg-gray-100 text-gray-500 border-[#444444]',
};

// Group label colours (one per group)
const GROUP_COLORS: Record<string, string> = {
  OUTBOUND:       'bg-blue-50 text-blue-700 border-blue-200',
  INBOUND:        'bg-purple-50 text-purple-700 border-purple-200',
  MESSAGING_APPS: 'bg-green-50 text-green-700 border-green-200',
  PERSONALIZATION:'bg-pink-50 text-pink-700 border-pink-200',
  AUDIENCE:       'bg-orange-50 text-orange-700 border-orange-200',
  CONNECTOR:      'bg-slate-100 text-[#B0B0B0] border-slate-200',
};

function MetricCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-[#1e1e1e] rounded-lg p-4 border border-[#444444] shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[#B0B0B0] text-xs uppercase tracking-wide">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function FilterBadge({ filter, isExcluded }: { filter: SegmentFilter; isExcluded?: boolean }) {
  const negative = isExcluded || filter.negate;
  const showNot  = filter.negate === true;
  return (
    <span
