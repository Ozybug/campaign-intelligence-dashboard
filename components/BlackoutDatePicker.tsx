"use client";
import { useState, useEffect, useRef } from 'react';

const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HEADS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const todayStr = (() => {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
})();

function displayDate(str: string) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  selected: string[];          // YYYY-MM-DD array of blacked-out dates
  onChange: (dates: string[]) => void;
  minDate?: string;            // YYYY-MM-DD — days before this are disabled
  compact?: boolean;           // icon-only trigger, no chip list
}

export default function BlackoutDatePicker({ selected, onChange, minDate, compact }: Props) {
  const today      = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [open,      setOpen]      = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedSet = new Set(selected);

  // Sync view to minDate when it first becomes available
  useEffect(() => {
    if (minDate && !open) {
      setViewYear(+minDate.slice(0, 4));
      setViewMonth(+minDate.slice(5, 7) - 1);
    }
  }, [minDate]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build day grid
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Mon = 0
  const cells: (number | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const toggleDay = (day: number) => {
    const str = toDateStr(viewYear, viewMonth, day);
    if (minDate && str < minDate) return;
    const next = selectedSet.has(str)
      ? selected.filter(d => d !== str)
      : [...selected, str].sort();
    onChange(next);
  };

  const removeDate = (str: string) => onChange(selected.filter(d => d !== str));
  const clearAll   = () => onChange([]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="Add blackout date"
          className={`flex items-center p-1 rounded-md transition-colors ${
            open ? 'bg-[#2a2a2a] text-[#ccc]' : 'text-[#555] hover:bg-[#222] hover:text-[#999]'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', lineHeight: 1 }}>
            event_busy
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-2 bg-[#161616] border rounded-lg px-3 py-1.5 text-sm transition-colors min-w-[168px] ${
            open ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'
          }`}
        >
          <span
            className="material-symbols-outlined flex-shrink-0"
            style={{ fontSize: '0.9rem', lineHeight: 1, color: selected.length > 0 ? '#f87171' : '#555' }}
          >
            event_busy
          </span>
          <span className={selected.length > 0 ? 'text-rose-400' : 'text-[#555]'}>
            {selected.length > 0
              ? `${selected.length} date${selected.length > 1 ? 's' : ''} blacked out`
              : 'Pick blackout dates'}
          </span>
        </button>
      )}

      {/* Popover calendar */}
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl p-3 w-[224px]">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={prevMonth}
              className="p-1 rounded-md text-[#666] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', lineHeight: 1 }}>chevron_left</span>
            </button>
            <span className="text-xs font-semibold text-[#E0E0E0] tracking-wide">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="p-1 rounded-md text-[#666] hover:text-[#ccc] hover:bg-[#2a2a2a] transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', lineHeight: 1 }}>chevron_right</span>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADS.map(h => (
              <div key={h} className="text-center text-[10px] font-semibold text-[#555] py-0.5">{h}</div>
            ))}
          </div>

          {/* Day cells — click toggles blackout */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const str        = toDateStr(viewYear, viewMonth, day);
              const isSelected = selectedSet.has(str);
              const isToday    = str === todayStr;
              const isDisabled = !!(minDate && str < minDate);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(day)}
                  disabled={isDisabled}
                  className={`h-7 w-full rounded-md text-[11px] font-medium transition-colors ${
                    isSelected
                      ? 'bg-rose-700/80 text-white'
                      : isToday && !isDisabled
                      ? 'text-rose-400 font-bold hover:bg-rose-900/30'
                      : isDisabled
                      ? 'text-[#3a3a3a] cursor-not-allowed'
                      : 'text-[#B0B0B0] hover:bg-rose-900/25 hover:text-rose-300'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear all */}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-2 w-full text-[10px] text-[#555] hover:text-rose-400 transition-colors pt-2 border-t border-[#2a2a2a]"
            >
              Clear all blackout dates
            </button>
          )}
        </div>
      )}

      {/* Selected date chips — hidden in compact mode */}
      {!compact && selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 max-w-[320px]">
          {selected.map(d => (
            <span key={d}
              className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/40 text-rose-400 border border-rose-800/60 text-[11px] rounded-full">
              {displayDate(d)}
              <button type="button" onClick={() => removeDate(d)}
                className="text-rose-600 hover:text-rose-300 transition-colors leading-none">
                <span className="material-symbols-outlined" style={{ fontSize: '0.65rem', lineHeight: 1 }}>close</span>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
