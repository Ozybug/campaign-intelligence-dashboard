"use client";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEffect, useRef, useState } from 'react';
import { CalendarEvent, CollisionWarning, Channel } from '@/types/campaign';
import { CHANNEL_LEGEND, GROUPS, getChannelsForGroup } from '@/lib/taxonomy';

interface StatsData { total: number; active: number; channels: number }

interface Props {
  onSelect: (event: CalendarEvent) => void;
  collisions: CollisionWarning[];
  hideFilters?: boolean;
  extraEvents?: any[];
  onExtraEventClick?: (schematicId: string) => void;
  /** When true, skips the /api/campaigns fetch — calendar shows only extraEvents */
  blankCalendar?: boolean;
}

// Channels excluded from the filter UI (not relevant for current campaigns)
const EXCLUDED_CHANNELS = new Set<string>(['MMS', 'WhatsApp', 'Web', 'Facebook', 'Google Ads', 'Custom']);

const STAT_ITEMS = [
  { key: 'total',    label: 'Total Campaigns', icon: 'calendar_month',      iconClass: 'text-[#888888]'   },
  { key: 'active',   label: 'Active Now',       icon: 'radio_button_checked', iconClass: 'text-emerald-400' },
  { key: 'channels', label: 'Channels',          icon: 'hub',                  iconClass: 'text-[#888888]'   },
] as const;

// Local YYYY-MM-DD string from a Date (avoids UTC-shift from toISOString)
const toLocalDateStr = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatDisplayDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function CampaignCalendar({ onSelect, collisions, hideFilters = false, extraEvents = [], onExtraEventClick, blankCalendar = false }: Props) {
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [stats, setStats]             = useState<StatsData | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [dateRange, setDateRange]     = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [schTooltip, setSchTooltip]   = useState<{
    x: number; y: number; channel: string;
    messageTitle: string; subtitle?: string; messageBody?: string;
  } | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    if (blankCalendar) { setLoading(false); return; }
    fetch('/api/campaigns')
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events || []);
        const campaigns = data.campaigns || [];
        setAllCampaigns(campaigns);
        setStats({
          total:    campaigns.length,
          active:   campaigns.filter((c: any) => c.status === 'ACTIVE').length,
          channels: new Set(campaigns.map((c: any) => c.channel)).size,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [blankCalendar]);

  // -- Filter logic ------------------------------------------------------------
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

  // -- Interaction handlers ----------------------------------------------------
  const handleGroupClick = (groupId: string) => {
    if (activeGroup === groupId) {
      setActiveGroup(null);
      setActiveChannel(null);
    } else {
      setActiveGroup(groupId);
      setActiveChannel(null);
    }
  };

  const handleChannelClick = (channel: Channel) => {
    if (activeChannel === channel) {
      setActiveChannel(null);
    } else {
      setActiveChannel(channel);
      const group = GROUPS.find(g => g.channels.includes(channel));
      if (group) setActiveGroup(group.id);
    }
  };

  const clearAll = () => { setActiveGroup(null); setActiveChannel(null); };
  const hasActiveFilter = activeGroup !== null || activeChannel !== null;

  // -- Date-range click logic --------------------------------------------------
  const handleDateClick = (info: { dateStr: string }) => {
    const clicked = info.dateStr; // YYYY-MM-DD
    setDateRange(prev => {
      if (!prev.start || prev.end) {
        // Idle or complete range → start fresh
        return { start: clicked, end: null };
      }
      // Have start, no end yet
      if (clicked === prev.start) return { start: null, end: null }; // deselect
      if (clicked < prev.start) return { start: clicked, end: prev.start }; // swap
      return { start: prev.start, end: clicked };
    });
  };

  const clearDateRange = () => setDateRange({ start: null, end: null });
  const hasDateRange = dateRange.start !== null;

  // -- Visible groups (only those with at least one non-excluded channel) ------
  const visibleGroups = GROUPS
    .map(g => ({ ...g, channels: g.channels.filter(c => !EXCLUDED_CHANNELS.has(c)) }))
    .filter(g => g.channels.length > 0);

  // -- Display stats: total reflects active channel/group + date range filters --
  const filteredTotal = (() => {
    if (!allCampaigns.length) return stats?.total ?? null;
    let base = allCampaigns;
    // Channel / group filter
    if (activeChannel) {
      base = base.filter(c => c.channel?.toLowerCase() === activeChannel.toLowerCase());
    } else if (activeGroup) {
      const groupChannels = getChannelsForGroup(activeGroup as any).map(c => c.id.toLowerCase());
      base = base.filter(c => groupChannels.includes(c.channel?.toLowerCase()));
    }
    // Date range filter (only when both ends are set)
    if (dateRange.start && dateRange.end) {
      base = base.filter(c => {
        const cStart = (c.startDate || '').slice(0, 10);
        const cEnd   = (c.endDate || c.startDate || '').slice(0, 10);
        // Overlap: campaign overlaps range if it starts before rangeEnd AND ends after rangeStart
        return cStart <= dateRange.end! && cEnd >= dateRange.start!;
      });
    }
    return base.length;
  })();
  const displayStats = stats ? { ...stats, total: filteredTotal ?? stats.total } : null;

  // -- Channels to show in the legend box (driven by group selection) ----------
  const legendChannels = activeGroup
    ? getChannelsForGroup(activeGroup as any)
        .filter(c => !EXCLUDED_CHANNELS.has(c.id))
    : CHANNEL_LEGEND
        .filter(l => !EXCLUDED_CHANNELS.has(l.channel))
        .map(l => ({ id: l.channel, color: l.color, icon: l.icon }));

  // -- Schematic stacking props (defined outside JSX to avoid SWC parser issues) --
  const schematicStackingProps = hideFilters ? {
    eventOrder: (a: any, b: any) =>
      (a.extendedProps?.isSchematic ? 0 : 1) - (b.extendedProps?.isSchematic ? 0 : 1),
    dayMaxEvents: 5,
  } : {};

  return (
    <div className="bg-[#1e1e1e] rounded-xl p-4 shadow-sm border border-[#444444]">

      {/* -- Filter panel: Groups + Channels + Stats --------------------------- */}
      {!hideFilters && <div className="mb-4 flex gap-3 items-stretch">

        {/* Groups box */}
        <div className="flex-shrink-0 w-28">
          <p className="text-xs font-semibold text-[#888888] tracking-wider mb-1.5">Group</p>
          <div
            className="bg-[#161616] border border-[#333333] rounded-lg overflow-y-auto h-full"
            style={{ maxHeight: 148 }}
          >
            {visibleGroups.map(({ id, label }) => {
              const isActive = activeGroup === id;
              return (
                <button
                  key={id}
                  onClick={() => handleGroupClick(id)}
                  className={`w-full flex items-center px-3 py-1.5 text-xs text-left transition-colors cursor-pointer select-none ${
                    isActive
                      ? 'bg-[#3a3a3a] text-white font-semibold'
                      : 'text-[#888888] hover:bg-[#2a2a2a] hover:text-[#cccccc]'
                  }`}
                  title={isActive ? 'Clear group filter' : `Filter by ${label}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channels box */}
        <div className="flex-shrink-0 w-36">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-[#888888] tracking-wider">
              {activeGroup ? 'Channels' : 'All Channels'}
            </p>
            {hasActiveFilter && (
              <button
                onClick={clearAll}
                className="text-xs text-[#888888] hover:text-[#cccccc] underline"
              >
                Show all
              </button>
            )}
          </div>
          <div
            className="bg-[#161616] border border-[#333333] rounded-lg overflow-y-auto"
            style={{ maxHeight: 148 }}
          >
            {legendChannels.map(({ id: channel, color, icon }) => {
              const isActive = activeChannel === channel;
              const isDimmed = activeChannel !== null && !isActive;
              return (
                <button
                  key={channel}
                  onClick={() => handleChannelClick(channel as Channel)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors cursor-pointer select-none ${
                    isActive
                      ? 'bg-[#3a3a3a] text-white font-semibold'
                      : isDimmed
                      ? 'text-[#555555]'
                      : 'text-[#B0B0B0] hover:bg-[#2a2a2a] hover:text-[#e0e0e0]'
                  }`}
                  title={isActive ? 'Clear channel filter' : `Show only ${channel}`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color, opacity: isDimmed ? 0.4 : 1 }}
                  />
                  <span
                    className="material-symbols-outlined flex-shrink-0"
                    style={{ fontSize: '0.85rem', lineHeight: 1, verticalAlign: 'middle' }}
                  >
                    {icon}
                  </span>
                  <span>{channel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats — fills remaining space; pt-[22px] aligns top with list boxes, flex-1 tracks column height */}
        <div className="flex-1 min-w-0 flex flex-col pt-[22px]">
          <div className="flex-1 flex flex-col gap-2">
            {STAT_ITEMS.map(({ key, label, icon, iconClass }) => (
              <div
                key={key}
                className="bg-[#161616] border border-[#333333] rounded-lg px-3 py-1.5 flex flex-row items-center justify-between flex-1"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined ${iconClass} flex-shrink-0`}
                    style={{ fontSize: '1rem', lineHeight: 1 }}
                  >
                    {icon}
                  </span>
                  <span className="text-[10px] font-semibold text-[#888888] tracking-wider uppercase">{label}</span>
                </div>
                <span className="text-xl font-bold text-[#E0E0E0]">
                  {displayStats ? displayStats[key] : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>}

      {/* -- Date range indicator -------------------------------------------- */}
      {hasDateRange && (
        <div className="mb-3 flex items-center gap-2 px-1 py-1.5 bg-[#1a1030] border border-[#3d2d6e] rounded-lg">
          <span
            className="material-symbols-outlined text-violet-400 flex-shrink-0"
            style={{ fontSize: '0.85rem', lineHeight: 1 }}
          >
            date_range
          </span>
          {dateRange.end ? (
            <span className="text-xs text-[#B0B0B0]">
              <span className="text-violet-300 font-semibold">{formatDisplayDate(dateRange.start!)}</span>
              <span className="text-[#555555] mx-1.5">→</span>
              <span className="text-violet-300 font-semibold">{formatDisplayDate(dateRange.end)}</span>
            </span>
          ) : (
            <span className="text-xs text-[#888888] italic">
              From <span className="text-violet-300 not-italic font-semibold">{formatDisplayDate(dateRange.start!)}</span>
              <span className="ml-1.5 text-[#555555]">— click an end date</span>
            </span>
          )}
          <button
            onClick={clearDateRange}
            className="ml-auto flex items-center text-[#555555] hover:text-[#cccccc] transition-colors"
            title="Clear date filter"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', lineHeight: 1 }}>close</span>
          </button>
        </div>
      )}

      {/* -- Collision warnings ---------------------------------------------- */}
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

      {/* -- Calendar -------------------------------------------------------- */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#888888]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mr-3" />
          Loading campaigns...
        </div>
      ) : (
        <div className={`calendar-container${dateRange.start && !dateRange.end ? ' selecting-end' : ''}${hideFilters ? ' events-dim' : ''}`}>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,dayGridWeek',
            }}
            buttonText={{ today: 'Today', month: 'Month', week: 'Week' }}
            events={[...filteredEvents, ...extraEvents] as any}
            dateClick={handleDateClick}
            dayCellClassNames={(arg) => {
              const dateStr = toLocalDateStr(arg.date);
              const classes: string[] = [];
              const { start, end } = dateRange;
              if (start && !end) {
                if (dateStr === start) classes.push('date-range-start-only');
              } else if (start && end) {
                if (dateStr === start)                     classes.push('date-range-start');
                else if (dateStr === end)                  classes.push('date-range-end');
                else if (dateStr > start && dateStr < end) classes.push('date-range-in');
              }
              return classes;
            }}
            eventClassNames={(arg) => {
              const classes = ['cursor-pointer', 'transition-opacity'];
              if (arg.event.extendedProps?.isSchematic) classes.push('schematic-event');
              return classes;
            }}
            eventContent={(arg) => {
              // ── Schematic planned event ──
              if (arg.event.extendedProps?.isSchematic) {
                const { icon, indefinite, format } = arg.event.extendedProps;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%', padding: '0 3px', overflow: 'hidden' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.7rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {arg.event.title}
                    </span>
                    {indefinite && <span style={{ fontSize: '0.8rem', lineHeight: 1, flexShrink: 0, opacity: 0.8 }}>∞</span>}
                    {format === 'Recurring' && (
                      <span className="material-symbols-outlined" style={{ fontSize: '0.6rem', lineHeight: 1, flexShrink: 0, opacity: 0.7 }}>repeat</span>
                    )}
                  </div>
                );
              }
              // ── Live MoEngage event ──
              const channel = arg.event.extendedProps?.channel || '';
              const entry = CHANNEL_LEGEND.find(l => l.channel === channel);
              const icon = entry?.icon || 'campaign';
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  <span className="event-emoji material-symbols-outlined">{icon}</span>
                  <span className="event-title-text">{arg.event.title}</span>
                </div>
              );
            }}
            eventMouseEnter={(info) => {
              const ep = info.event.extendedProps;
              if (ep?.isSchematic && ep?.messageTitle) {
                const rect = info.el.getBoundingClientRect();
                setSchTooltip({
                  x: rect.left,
                  y: rect.top,
                  channel:      ep.channel || '',
                  messageTitle: ep.messageTitle,
                  subtitle:     ep.subtitle,
                  messageBody:  ep.messageBody,
                });
              }
            }}
            eventMouseLeave={() => setSchTooltip(null)}
            eventClick={(info) => {
              setSchTooltip(null);
              if (info.event.extendedProps?.isSchematic) {
                onExtraEventClick?.(info.event.extendedProps.schematicId);
                return;
              }
              const event = events.find((e) => e.id === info.event.id);
              if (event) onSelect(event);
            }}
            eventDisplay="block"
            height="auto"
            {...schematicStackingProps}
          />
        </div>
      )}

      {/* -- Schematic event tooltip (fixed-position to escape FC overflow:hidden) -- */}
      {schTooltip && (
        <div
          style={{
            position: 'fixed',
            left:      schTooltip.x,
            top:       schTooltip.y - 8,
            transform: 'translateY(-100%)',
            zIndex:    9999,
            pointerEvents: 'none',
          }}
          className="bg-[#1a1a2e] border border-[#3d2d6e] rounded-lg px-3 py-2 text-xs max-w-[260px] shadow-2xl"
        >
          {/* Label row */}
          <p className="text-[9px] font-semibold text-[#555] tracking-wider uppercase mb-0.5">
            {schTooltip.channel === 'Email' ? 'Subject Line' : 'Message Title'}
          </p>
          <p className="font-semibold text-indigo-200 leading-snug mb-1">{schTooltip.messageTitle}</p>
          {/* Push: subtitle */}
          {schTooltip.channel !== 'Email' && schTooltip.subtitle && (
            <p className="text-[#888] leading-snug mb-0.5">{schTooltip.subtitle}</p>
          )}
          {/* Push: body | Email: agenda */}
          {schTooltip.messageBody && (
            <>
              <p className="text-[9px] font-semibold text-[#555] tracking-wider uppercase mb-0.5 mt-1">
                {schTooltip.channel === 'Email' ? 'Agenda' : 'Body'}
              </p>
              <p className="text-[#B0B0B0] leading-relaxed">{schTooltip.messageBody}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
