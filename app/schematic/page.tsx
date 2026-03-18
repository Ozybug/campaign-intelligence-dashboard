"use client";
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CollisionWarning } from '@/types/campaign';
import MiniCalendar from '@/components/MiniCalendar';

const CampaignCalendar = dynamic(() => import('@/components/CampaignCalendar'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
type SchChannel  = 'Email' | 'Push';
type SchFormat   = 'One Time' | 'Event Triggered' | 'Recurring';
type RecInterval = 'daily' | 'weekly' | 'monthly' | 'custom';
type CustomUnit  = 'day' | 'week' | 'month' | 'year';

interface SchematicCampaign {
  id: string;
  title: string;
  channel: SchChannel;
  format: SchFormat;
  startDate: string;      // YYYY-MM-DD
  endDate: string | null; // null = indefinite
  recurring?: {
    interval: RecInterval;
    customValue?: number;
    customUnit?: CustomUnit;
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CHANNEL_COLORS: Record<SchChannel, string> = { Email: '#34D399', Push: '#818CF8' };
const CHANNEL_ICONS:  Record<SchChannel, string> = { Email: 'mail',    Push: 'send_to_mobile' };
const LS_KEY = 'schematic_campaigns_v1';

// ── Helpers ────────────────────────────────────────────────────────────────────
const genId     = () => `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const addDays   = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addMonths = (d: Date, n: number) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };
const addYears  = (d: Date, n: number) => { const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r; };
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

function expandToEvents(c: SchematicCampaign): any[] {
  const color = CHANNEL_COLORS[c.channel];
  const isIndefinite = c.endDate === null;
  const horizon = toDateStr(addYears(new Date(), 1));
  const effectiveEnd = isIndefinite ? horizon : c.endDate!;

  const base = {
    backgroundColor: hexToRgba(color, 0.18),
    borderColor:     color,
    textColor:       color,
    classNames:      ['schematic-event'],
    extendedProps: {
      isSchematic:  true,
      schematicId:  c.id,
      channel:      c.channel,
      format:       c.format,
      icon:         CHANNEL_ICONS[c.channel],
      indefinite:   isIndefinite,
    },
  };

  if (c.format !== 'Recurring') {
    return [{ ...base, id: c.id, title: c.title, start: c.startDate, end: effectiveEnd >= c.startDate ? effectiveEnd : c.startDate }];
  }

  // Expand recurring occurrences (capped at 365)
  const { interval = 'weekly', customValue = 1, customUnit = 'week' } = c.recurring ?? {};
  const events: any[] = [];
  let cur = new Date(c.startDate + 'T00:00:00');
  const endBound = new Date(effectiveEnd + 'T00:00:00');
  let n = 0;

  while (cur <= endBound && n < 365) {
    events.push({ ...base, id: `${c.id}_occ_${n}`, title: c.title, start: toDateStr(cur), end: toDateStr(addDays(cur, 1)) });
    if      (interval === 'daily')   cur = addDays(cur, 1);
    else if (interval === 'weekly')  cur = addDays(cur, 7);
    else if (interval === 'monthly') cur = addMonths(cur, 1);
    else if (customUnit === 'day')   cur = addDays(cur, customValue);
    else if (customUnit === 'week')  cur = addDays(cur, customValue * 7);
    else if (customUnit === 'month') cur = addMonths(cur, customValue);
    else                             cur = addYears(cur, customValue);
    n++;
  }
  return events;
}

// ── Form state type ────────────────────────────────────────────────────────────
interface FormState {
  title: string; channel: SchChannel; format: SchFormat;
  startDate: string; endDate: string;
  interval: RecInterval; customValue: number; customUnit: CustomUnit;
}
const EMPTY: FormState = {
  title: '', channel: 'Email', format: 'One Time',
  startDate: '', endDate: '',
  interval: 'weekly', customValue: 1, customUnit: 'week',
};

// ── Shared form body ───────────────────────────────────────────────────────────
function FormBody({ f, set, onSubmit, onDelete, isEdit }: {
  f: FormState;
  set: (k: keyof FormState, v: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: () => void;
  isEdit: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Row 1: Channel · Title · Format */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Channel */}
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Channel</p>
          <div className="flex gap-1">
            {(['Email', 'Push'] as SchChannel[]).map(ch => (
              <button key={ch} type="button" onClick={() => set('channel', ch)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={f.channel === ch
                  ? { backgroundColor: hexToRgba(CHANNEL_COLORS[ch], 0.22), borderColor: CHANNEL_COLORS[ch], color: CHANNEL_COLORS[ch] }
                  : { backgroundColor: '#161616', borderColor: '#333', color: '#888' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.8rem', lineHeight: 1 }}>{CHANNEL_ICONS[ch]}</span>
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-[180px]">
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Campaign Title</p>
          <input type="text" placeholder="e.g. Summer Sale Blast" value={f.title} onChange={e => set('title', e.target.value)} required
            className="w-full bg-[#161616] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-[#E0E0E0] placeholder-[#555] outline-none focus:border-[#555] transition-colors" />
        </div>

        {/* Format */}
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Format</p>
          <div className="flex gap-1">
            {(['One Time', 'Event Triggered', 'Recurring'] as SchFormat[]).map(fmt => (
              <button key={fmt} type="button" onClick={() => set('format', fmt)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  f.format === fmt ? 'bg-[#1e1e38] text-indigo-300 border-indigo-600' : 'bg-[#161616] text-[#888] border-[#333] hover:text-[#ccc]'
                }`}>
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Recurring options */}
      {f.format === 'Recurring' && (
        <div className="flex flex-wrap gap-2 items-center">
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase">Repeats</p>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly', 'custom'] as RecInterval[]).map(iv => (
              <button key={iv} type="button" onClick={() => set('interval', iv)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                  f.interval === iv ? 'bg-[#1a1a2e] text-indigo-300 border-indigo-600' : 'bg-[#161616] text-[#888] border-[#333] hover:text-[#ccc]'
                }`}>
                {iv}
              </button>
            ))}
          </div>
          {f.interval === 'custom' && (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-[#888] text-xs">every</span>
              <input type="number" min={1} value={f.customValue}
                onChange={e => set('customValue', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 bg-[#161616] border border-[#333] rounded-lg px-2 py-1 text-sm text-[#E0E0E0] outline-none focus:border-[#555] text-center" />
              <select value={f.customUnit} onChange={e => set('customUnit', e.target.value as CustomUnit)}
                className="bg-[#161616] border border-[#333] rounded-lg px-2 py-1 text-xs text-[#E0E0E0] outline-none focus:border-[#555] cursor-pointer">
                {(['day', 'week', 'month', 'year'] as CustomUnit[]).map(u => (
                  <option key={u} value={u}>{u}s</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Row 3: Dates · Submit */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
            Start Date <span className="text-rose-400">*</span>
          </p>
          <MiniCalendar value={f.startDate} onChange={v => { set('startDate', v); if (f.endDate && v > f.endDate) set('endDate', ''); }} placeholder="Pick start date" />
        </div>

        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
            End Date <span className="ml-1 text-[#555] font-normal normal-case">(blank = ∞)</span>
          </p>
          <MiniCalendar value={f.endDate} onChange={v => set('endDate', v)} minDate={f.startDate || undefined} placeholder="Pick end date (opt.)" />
        </div>

        {/* Indefinite indicator */}
        {!f.endDate && f.startDate && (
          <div className="flex items-center gap-1 pb-1.5 text-[#666]">
            <span className="text-xs">→</span>
            <span className="text-xl leading-none">∞</span>
            <span className="text-[10px]">indefinite</span>
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          {isEdit && onDelete && (
            <button type="button" onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800 rounded-lg text-xs font-medium transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', lineHeight: 1 }}>delete</span>
              Delete
            </button>
          )}
          <button type="submit" disabled={!f.title.trim() || !f.startDate}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1 }}>
              {isEdit ? 'save' : 'add'}
            </span>
            {isEdit ? 'Save Changes' : 'Add to Schematic'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SchematicPage() {
  const [collisions, setCollisions] = useState<CollisionWarning[]>([]);
  const [campaigns, setCampaigns]   = useState<SchematicCampaign[]>([]);
  const [form, setForm]             = useState<FormState>({ ...EMPTY });
  const [editId, setEditId]         = useState<string | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCampaigns(JSON.parse(raw));
    } catch {}
  }, []);

  // Live collision data (for the background calendar)
  useEffect(() => {
    fetch('/api/campaigns').then(r => r.json()).then(d => setCollisions(d.collisions || []));
  }, []);

  const persist = (updated: SchematicCampaign[]) => {
    setCampaigns(updated);
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch {}
  };

  const set = (k: keyof FormState, v: any) => setForm(prev => ({ ...prev, [k]: v }));
  const resetForm = () => { setForm({ ...EMPTY }); setEditId(null); };

  const closeModal = () => { setModalOpen(false); resetForm(); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate) return;

    const campaign: SchematicCampaign = {
      id:        editId ?? genId(),
      title:     form.title.trim(),
      channel:   form.channel,
      format:    form.format,
      startDate: form.startDate,
      endDate:   form.endDate || null,
      ...(form.format === 'Recurring' && {
        recurring: {
          interval: form.interval,
          ...(form.interval === 'custom' && { customValue: form.customValue, customUnit: form.customUnit }),
        },
      }),
    };

    persist(editId
      ? campaigns.map(c => c.id === editId ? campaign : c)
      : [...campaigns, campaign]
    );
    resetForm();
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!editId) return;
    persist(campaigns.filter(c => c.id !== editId));
    closeModal();
  };

  // Called when a schematic event chip is clicked on the calendar
  const handleExtraEventClick = (schematicId: string) => {
    const c = campaigns.find(x => x.id === schematicId);
    if (!c) return;
    setForm({
      title: c.title, channel: c.channel, format: c.format,
      startDate: c.startDate, endDate: c.endDate ?? '',
      interval: c.recurring?.interval ?? 'weekly',
      customValue: c.recurring?.customValue ?? 1,
      customUnit:  c.recurring?.customUnit  ?? 'week',
    });
    setEditId(c.id);
    setModalOpen(true);
  };

  const extraEvents = campaigns.flatMap(expandToEvents);

  return (
    <main className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#444444] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-1.5 text-[#888] hover:text-[#ccc] transition-colors text-xs">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem', lineHeight: 1 }}>arrow_back</span>
              Dashboard
            </a>
            <span className="text-[#444]">/</span>
            <h1 className="text-xl font-bold text-[#E0E0E0] flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: '1.2rem', lineHeight: 1 }}>schema</span>
              Schematic
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {campaigns.length > 0 && (
              <span className="text-xs text-[#888]">{campaigns.length} planned campaign{campaigns.length !== 1 ? 's' : ''}</span>
            )}
            <span className="px-3 py-1 bg-[#2a2a2a] text-[#B0B0B0] border border-[#444444] rounded-full text-xs font-medium">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-4">
        {/* ── Form card ──────────────────────────────────────────────────────── */}
        <div className="bg-[#1e1e1e] rounded-xl border border-[#444444] p-4">
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-3">Plan a Campaign</p>
          <FormBody f={form} set={set} onSubmit={handleSubmit} isEdit={false} />
        </div>

        {/* ── Calendar ───────────────────────────────────────────────────────── */}
        <CampaignCalendar
          onSelect={() => {}}
          collisions={collisions}
          hideFilters
          extraEvents={extraEvents}
          onExtraEventClick={handleExtraEventClick}
        />
      </div>

      {/* ── Edit / Delete modal ─────────────────────────────────────────────── */}
      {modalOpen && editId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-[#1e1e1e] border border-[#444] rounded-xl p-5 w-full max-w-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: '1rem', lineHeight: 1 }}>edit</span>
                Edit Campaign
              </h3>
              <button onClick={closeModal} className="text-[#888] hover:text-[#ccc] transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', lineHeight: 1 }}>close</span>
              </button>
            </div>
            <FormBody f={form} set={set} onSubmit={handleSubmit} onDelete={handleDelete} isEdit={true} />
          </div>
        </div>
      )}
    </main>
  );
}
