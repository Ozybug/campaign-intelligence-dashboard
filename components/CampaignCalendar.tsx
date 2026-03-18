"use client";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef, useState } from 'react';
import { CalendarEvent, CollisionWarning, Channel } from '@/types/campaign';
import { CHANNEL_LEGEND, GROUPS, getChannelsForGroup } from '@/lib/taxonomy';

interface Props {
  onSelect: (event: CalendarEvent) => void;
  collisions: CollisionWarning[];
}

export default function CampaignCalendar({ onSelect, collisions }: Props) {
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((res) => res.json())
      .then((data) => { setEvents(data.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── Filter logic ────────────────────────────────────────────────────────────
  // If a specific channel is chosen → filter to that channel only.
  // If only a group is chosen → filter to all channels in that group.
  // If neither → show all events.

  const filteredEvents = (() => {
    if (activeChannel) {
      return events.filter(
        (e: any) => (e.extendedProps?.channel || '').toLowerCase() === activeChannel.toLowerCase()
      );
    }
    if (activeGroup) {
      const groupChannels = getChannelsForGroup(activeGroup as any).map(c => c.id.toLowerCase());
      return events.filter(
        (e: any) => groupChannels.includes((e.extendedProps?.channel || '').toLowerCase())
      );
    }
    return events;
  })();

  // ── Interaction handlers ─────────────────────────────────────────────────────

  const handleGroupClick = (groupId: string) => {
    if (activeGroup === groupId) {
      // Deselect group → clear everything
      setActiveGroup(null);
      setActiveChannel(null);
    } else {
      setActiveGroup(groupId);
      setActiveChannel(null); // cascade reset
    }
  };

  const handleChannelClick = (channel: Channel) => {
    if (activeChannel === channel) {
      setActiveChannel(null);
    } else {
      setActiveChannel(channel);
      // Also set the group so the group badge lights up
      const entry = CHANNEL_LEGEND.find(l => l.channel === channel);
      if (entry) {
        const group = GROUPS.find(g => g.channels.includes(channel));
        if (group) setActiveGroup(group.id);
      }
    }
  };

  const clearAll = () => { setActiveGroup(null); setActiveChannel(null); };

  const hasActiveFilter = activeGroup !== null || activeChannel !== null;

  // ── Channels to show in the legend section (driven by group selection) ───────
  const legendChannels = activeGroup
    ? getChannelsForGroup(activeGroup as any)
    : CHANNEL_LEGEND.map(l => ({ id: l.channel, color: l.color, icon: l.icon }));

  return (
    <div className="bg-[#1e1e1e] rounded-xl p-4 shadow-sm border border-[#444444]">

      {/* ── Group filter bar ─────────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">Group</p>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map(({ id, label }) => {
            const isActive  = activeGroup === id;
            const isDimmed  = activeGroup !== null && !isActive;
            return (
              <button
                key={id}
                onClick={() => handleGroupClick(id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#444444] text-white border-[#444444] shadow-sm'
                    : isDimmed
                    ? 'border-slate-200 text-[#888888] opacity-50'
                    : 'border-[#444444] text-[#888888] hover:bg-[#2a2a2a]'
                }`}
                title={isActive ? 'Clear group filter' : `Filter by ${label}`}
              >
                {label}
                {isActive && <span className="ml-1 opacity-70">×</span>}
              </button>
            );
          })}
          {hasActiveFilter && (
            <button
              onClick={clearAll}
              className="text-xs text-[#888888] hover:text-[#888888] underline self-center ml-1"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      {/* ── Channel legend / channel filter ──────────────────────────────── */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
          {activeGroup ? 'Channels in group' : 'All channels'}
        </p>
        <div className="flex flex-wrap gap-2">
          {legendChannels.map(({ id: channel, color, icon }) => {
            const isActive = activeChannel === channel;
            const isDimmed = activeChannel !== null && !isActive;
            return (
              <button
                key={channel}
                onClick={() => handleChannelClick(channel as Channel)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'border-slate-400 bg-[#2a2a2a] text-slate-800 font-semibold shadow-sm'
                    : isDimmed
                    ? 'border-transparent text-[#888888] opacity-50'
                    : 'border-transparent text-[#B0B0B0] hover:bg-[#2a2a2a] hover:border-slate-200'
                }`}
                title={isActive ? 'Clear channel filter' : `Show only ${channel}`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color, opacity: isDimmed ? 0.4 : 1 }}
                />
                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', lineHeight: 1, verticalAlign: 'middle' }}>{icon}</span>
                <span>{channel}</span>
                {isActive && <span className="ml-0.5 text-[#B0B0B0] font-bold text-xs">×</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Collision warnings ────────────────────────────────────────────── */}
      {collisions.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-600 font-semibold text-sm mb-1">
            {collisions.length} Campaign Collision{collisions.length > 1 ? 's' : ''} Detected
          </p>
          {collisions.slice(0, 3).map((col, i) => (
            <p key={i} className="text-amber-500 text-xs">
              {col.campaigns.map((c) => c.name).join(' & ')} overlap from{' '}
              {col.overlapStart} to {col.overlapEnd}
            </p>
          ))}
        </div>
      )}

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#888888]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mr-3" />
          Loading campaigns...
        </div>
      ) : (
        <div className="calendar-container">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,dayGridWeek',
            }}
            events={filteredEvents as any}
            eventClick={(info) => {
              const event = events.find((e) => e.id === info.event.id);
              if (event) onSelect(event);
            }}
            eventDisplay="block"
            height="auto"
            eventClassNames="cursor-pointer hover:opacity-90 transition-opacity"
          />
        </div>
      )}
    </div>
  );
}
