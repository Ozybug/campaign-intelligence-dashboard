"use client";

import { useState, useEffect, useRef } from 'react';
import { DestinationVisitorRow } from '@/lib/metabase';

type SortKey = 'destination' | 'destination_unique_visitors' | 'property_unique_visitors' | 'delta_pct_past7days';
type View = 'destinations' | 'properties';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (d: Date) => d.toISOString().split('T')[0];

function defaultRange() {
  const today = new Date();
  const end   = fmt(today);
  const start = fmt(new Date(today.getTime() - 6 * 86400000));
  return { start, end };
}

function labelForRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end   + 'T00:00:00');
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', opts)} (${days}d)`;
}

// ─── DeltaBar ────────────────────────────────────────────────────────────────
function DeltaBar({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-[#888888]">—</span>;
  }
  const pct   = Math.min(Math.abs(value), 300);
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <span className={`text-xs font-medium w-14 text-right ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPos ? '+' : ''}{value.toFixed(0)}%
      </span>
      <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ width: `${(pct / 300) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── DateRangePicker ─────────────────────────────────────────────────────────
interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const [open, setOpen]         = useState(false);
  const [picking, setPicking]   = useState<'start' | 'end'>('start');
  const [draft, setDraft]       = useState({ start, end });
  const [viewDate, setViewDate] = useState(() => new Date(start + 'T00:00:00'));
  const ref                     = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const totalDays = daysInMonth(y, m);

  function handleDayClick(day: number) {
    const clicked = fmt(new Date(y, m, day));
    if (picking === 'start') {
      setDraft({ start: clicked, end: clicked });
      setPicking('end');
    } else {
      const [s, e] = clicked < draft.start
        ? [clicked, draft.start]
        : [draft.start, clicked];
      setDraft({ start: s, end: e });
      setPicking('start');
      onChange(s, e);
      setOpen(false);
    }
  }

  function prevMonth() {
    setViewDate(new Date(y, m - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(y, m + 1, 1));
  }

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayNames   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const inRange = (day: number) => {
    const d = fmt(new Date(y, m, day));
    return d >= draft.start && d <= draft.end;
  };
  const isStart = (day: number) => fmt(new Date(y, m, day)) === draft.start;
  const isEnd   = (day: number) => fmt(new Date(y, m, day)) === draft.end;

  // Quick presets
  function applyPreset(days: number) {
    const today = new Date();
    const e = fmt(today);
    const s = fmt(new Date(today.getTime() - (days - 1) * 86400000));
    setDraft({ start: s, end: e });
    onChange(s, e);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => { setDraft({ start, end }); setViewDate(new Date(start + 'T00:00:00')); setOpen(o => !o); }}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#444444] bg-[#2a2a2a] text-[#888888] hover:bg-[#2a2a2a] transition-colors font-medium"
      >
        <svg className="w-3.5 h-3.5 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/>
          <line x1="3" y1="9" x2="21" y2="9" strokeWidth="2"/>
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
        </svg>
        {labelForRange(start, end)}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-9 z-50 bg-[#1e1e1e] border border-[#444444] rounded-xl shadow-xl p-4 w-72">
          {/* Quick presets */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => applyPreset(d)}
                className="text-xs px-2.5 py-1 rounded-full border border-[#444444] text-[#888888] hover:bg-[#2a2a2a] transition-colors"
              >
                Last {d}d
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-[#2a2a2a] text-[#888888]">‹</button>
            <span className="text-xs font-semibold text-[#E0E0E0]">
              {monthNames[m]} {y}
            </span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-[#2a2a2a] text-[#888888]">›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center text-[10px] text-[#888888] font-medium py-0.5">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
              const inR  = inRange(day);
              const isS  = isStart(day);
              const isE  = isEnd(day);
              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={[
                    'text-xs py-1 rounded text-center transition-colors w-full',
                    isS || isE
                      ? 'bg-[#444444] text-white font-semibold'
                      : inR
                      ? 'bg-[#2a2a2a] text-[#E0E0E0]'
                      : 'text-[#B0B0B0] hover:bg-[#2a2a2a]',
                  ].join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Step hint */}
          <p className="text-[10px] text-[#888888] mt-2 text-center">
            {picking === 'start' ? 'Click to set start date' : 'Click to set end date'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Table ──────────────────────────────────────────────────────────────
export default function DestinationVisitorsTable() {
  const def = defaultRange();
  const [rows, setRows]         = useState<DestinationVisitorRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [view, setView]         = useState<View>('destinations');
  const [sortKey, setSortKey]   = useState<SortKey>('destination_unique_visitors');
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch]     = useState('');
  const [dateStart, setDateStart] = useState(def.start);
  const [dateEnd,   setDateEnd]   = useState(def.end);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/destination-visitors?start=${dateStart}&end=${dateEnd}`)
      .then(res => res.json())
      .then(data => {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load data');
        setLoading(false);
      });
  }, [dateStart, dateEnd]);

  const days = Math.round(
    (new Date(dateEnd + 'T00:00:00').getTime() - new Date(dateStart + 'T00:00:00').getTime()) / 86400000
  ) + 1;

  const filtered = rows
    .filter(r => view === 'destinations' ? r.property === null : r.property !== null)
    .filter(r => {
      const q = search.toLowerCase();
      return r.destination.toLowerCase().includes(q) || (r.property || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      if (typeof aVal === 'string')
        return sortDesc ? bVal.toString().localeCompare(aVal.toString()) : aVal.toString().localeCompare(bVal.toString());
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-[#888888] ml-1">↕</span>;
    return <span className="text-[#888888] ml-1">{sortDesc ? '↓' : '↑'}</span>;
  }

  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-[#444444] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#444444] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#E0E0E0]">Destination &amp; Property Visitors</h2>
          <p className="text-xs text-[#888888] mt-0.5">
            {days}d: {labelForRange(dateStart, dateEnd)} vs prev {days}d · {rows.length} total rows
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range picker */}
          <DateRangePicker
            start={dateStart}
            end={dateEnd}
            onChange={(s, e) => { setDateStart(s); setDateEnd(e); }}
          />
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-[#444444] bg-[#2a2a2a] text-[#E0E0E0] placeholder-[#888888] focus:outline-none focus:ring-2 focus:ring-[#444444] w-40"
          />
          {/* Destinations / Properties toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[#444444] text-xs font-medium">
            <button
              onClick={() => setView('destinations')}
              className={`px-3 py-1.5 ${view === 'destinations' ? 'bg-[#444444] text-white' : 'bg-[#1e1e1e] text-[#888888] hover:bg-[#2a2a2a]'}`}
            >Destinations</button>
            <button
              onClick={() => setView('properties')}
              className={`px-3 py-1.5 ${view === 'properties' ? 'bg-[#444444] text-white' : 'bg-[#1e1e1e] text-[#888888] hover:bg-[#2a2a2a]'}`}
            >Properties</button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading && <div className="p-8 text-center text-[#888888] text-sm">Loading visitor data…</div>}
      {error   && <div className="p-8 text-center text-red-400 text-sm">{error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#2a2a2a] text-[#888888] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-[#888888]" onClick={() => toggleSort('destination')}>
                  Destination <SortIcon col="destination" />
                </th>
                {view === 'properties' && <th className="px-4 py-3 text-left">Property</th>}
                <th
                  className="px-4 py-3 text-right cursor-pointer hover:text-[#888888]"
                  onClick={() => toggleSort(view === 'destinations' ? 'destination_unique_visitors' : 'property_unique_visitors')}
                >
                  Unique Visitors <SortIcon col={view === 'destinations' ? 'destination_unique_visitors' : 'property_unique_visitors'} />
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-[#888888]" onClick={() => toggleSort('delta_pct_past7days')}>
                  WoW Change <SortIcon col="delta_pct_past7days" />
                </th>
                {view === 'properties' && <th className="px-4 py-3 text-right">Instagram</th>}
                {view === 'properties' && <th className="px-4 py-3 text-right">Meta Ads</th>}
                {view === 'properties' && <th className="px-4 py-3 text-right">Center</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333333]">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-[#2a2a2a]/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-[#E0E0E0]">{row.destination}</td>
                  {view === 'properties' && <td className="px-4 py-2.5 text-[#B0B0B0]">{row.property}</td>}
                  <td className="px-4 py-2.5 text-right font-mono text-[#E0E0E0]">
                    {(view === 'destinations' ? row.destination_unique_visitors : row.property_unique_visitors)?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-2.5"><DeltaBar value={row.delta_pct_past7days} /></td>
                  {view === 'properties' && <td className="px-4 py-2.5 text-right text-[#B0B0B0]">{row.instagram_users ?? '—'}</td>}
                  {view === 'properties' && <td className="px-4 py-2.5 text-right text-[#B0B0B0]">{row.meta_ads_users ?? '—'}</td>}
                  {view === 'properties' && <td className="px-4 py-2.5 text-right text-[#B0B0B0]">{row.center_users ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-8 text-center text-[#888888] text-sm">No results found</div>}
        </div>
      )}
    </div>
  );
}
