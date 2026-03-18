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
  value: string;           // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  minDate?: string;        // YYYY-MM-DD — days before this are disabled
  placeholder?: string;
}

export default function MiniCalendar({ value, onChange, minDate, placeholder = 'Select date' }: Props) {
  const initYear  = value ? +value.slice(0, 4) : new Date().getFullYear();
  const initMonth = value ? +value.slice(5, 7) - 1 : new Date().getMonth();

  const [viewYear,  setViewYear]  = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [open,      setOpen]      = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep view in sync when value is set externally
  useEffect(() => {
    if (value) {
      setViewYear(+value.slice(0, 4));
      setViewMonth(+value.slice(5, 7) - 1);
    }
  }, [value]);

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
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
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

  const pickDay = (day: number) => {
    const str = toDateStr(viewYear, viewMonth, day);
    if (minDate && str < minDate) return;
    onChange(str);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 bg-[#161616] border rounded-lg px-3 py-1.5 text-sm transition-colors min-w-[168px] ${
          open ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'
        }`}
      >
        <span
          className="material-symbols-outlined flex-shrink-0"
          style={{ fontSize: '0.9rem', lineHeight: 1, color: value ? '#a78bfa' : '#555' }}
        >
          calendar_today
        </span>
        <span className={value ? 'text-[#E0E0E0]' : 'text-[#555]'}>
          {value ? displayDate(value) : placeholder}
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl shadow-2xl p-3 w-[224px]">
          {/* Header: prev / Month Year / next */}
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

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const str        = toDateStr(viewYear, viewMonth, day);
              const isSelected = str === value;
              const isToday    = str === todayStr;
              const isDisabled = !!(minDate && str < minDate);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(day)}
                  disabled={isDisabled}
                  className={`h-7 w-full rounded-md text-[11px] font-medium transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : isToday && !isDisabled
                      ? 'text-indigo-400 font-bold hover:bg-[#2a2a2a]'
                      : isDisabled
                      ? 'text-[#3a3a3a] cursor-not-allowed'
                      : 'text-[#B0B0B0] hover:bg-[#2a2a2a] hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="mt-2 w-full text-[10px] text-[#555] hover:text-[#999] transition-colors pt-2 border-t border-[#2a2a2a]"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
