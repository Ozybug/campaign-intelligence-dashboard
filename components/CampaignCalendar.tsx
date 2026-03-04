"use client";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef, useState } from 'react';
import { CalendarEvent, CollisionWarning } from '@/types/campaign';

interface Props {
  onSelect: (event: CalendarEvent) => void;
  collisions: CollisionWarning[];
}

const CHANNEL_LEGEND = [
  { channel: 'Push', color: '#818CF8' },
  { channel: 'Email', color: '#34D399' },
  { channel: 'WhatsApp', color: '#6EE7B7' },
  { channel: 'SMS', color: '#FCD34D' },
  { channel: 'In-App', color: '#C084FC' },
  { channel: 'Web', color: '#F9A8D4' },
];

export default function CampaignCalendar({ onSelect, collisions }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredEvents = activeFilter
    ? events.filter((e: any) => {
        const channel = e.extendedProps?.channel || '';
        return channel.toLowerCase() === activeFilter.toLowerCase();
      })
    : events;

  const handleLegendClick = (channel: string) => {
    setActiveFilter(prev => prev === channel ? null : channel);
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-violet-100">
      {/* Legend / Channel Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        {CHANNEL_LEGEND.map(({ channel, color }) => {
          const isActive = activeFilter === channel;
          const isDimmed = activeFilter !== null && !isActive;
          return (
            <button
              key={channel}
              onClick={() => handleLegendClick(channel)}
              className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-full border transition-all cursor-pointer select-none ${isActive ? 'border-slate-400 bg-slate-100 text-slate-800 font-semibold shadow-sm' : isDimmed ? 'border-transparent text-slate-300 opacity-50' : 'border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-200'}`}
              title={isActive ? 'Clear filter' : `Show only ${channel}`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color, opacity: isDimmed ? 0.4 : 1 }}
              />
              {channel}
              {isActive && (
                <span className="ml-1 text-xs text-slate-500 font-bold">x</span>
              )}
            </button>
          );
        })}
        {activeFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-violet-500 hover:text-violet-700 underline ml-1 self-center"
          >
            Show all
          </button>
        )}
      </div>

      {/* Collision warnings */}
      {collisions.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-600 font-semibold text-sm mb-1">
            {collisions.length} Campaign Collision{collisions.length > 1 ? 's' : ''} Detected
          </p>
          {collisions.slice(0, 3).map((col, i) => (
            <p key={i} className="text-amber-500 text-xs">
              {col.campaigns.map((c) => c.name).join(' & ')} overlap from {col.overlapStart} to {col.overlapEnd}
            </p>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-violet-400">
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
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek',
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
