"use client";
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import MiniCalendar from '@/components/MiniCalendar';

const CampaignCalendar = dynamic(() => import('@/components/CampaignCalendar'), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────
type Brand          = 'Zostel Hostel' | 'Zostel Plus' | 'Zostel Homes' | 'Zo Trips' | 'Zo Selections' | 'Experiences';
type OsmTarget      = 'Destination' | 'Property' | 'Homepage';
type RedirectTarget = 'Destination' | 'Property' | 'Homepage' | 'Trip Name' | 'Experience Name';
type OsmStatus      = 'Ideation' | 'Scheduled' | 'Live' | 'Canned';
type OsmPriority    = 'Critical' | 'High' | 'Medium' | 'Normal' | 'Low';
type SortMode       = 'status' | 'priority' | 'date';

interface OnSiteCampaign {
  id: string;
  brand: Brand;
  title: string;
  osmTarget: OsmTarget;
  osmTargetNames: string[];        // chips — only for Destination / Property
  redirectTarget: RedirectTarget;
  redirectTargetNames: string[];   // chips — shown for all redirect targets except Homepage
  priority: OsmPriority;
  status: OsmStatus;
  startDate: string;               // YYYY-MM-DD
  endDate: string | null;          // null = indefinite
}

// ── Constants ──────────────────────────────────────────────────────────────────
const OSM_COLORS: Record<OsmTarget, string> = {
  Destination: '#F59E0B',
  Property:    '#06B6D4',
  Homepage:    '#A78BFA',
};
const OSM_ICONS: Record<OsmTarget, string> = {
  Destination: 'explore',
  Property:    'hotel',
  Homepage:    'home',
};
const STATUS_COLORS: Record<OsmStatus, string> = {
  Ideation:  '#94A3B8',
  Scheduled: '#60A5FA',
  Live:      '#34D399',
  Canned:    '#F87171',
};
const STATUS_CLS: Record<OsmStatus, string> = {
  Ideation:  'bg-slate-950/50 text-slate-400 border-slate-700',
  Scheduled: 'bg-blue-950/50 text-blue-400 border-blue-800',
  Live:      'bg-emerald-950/50 text-emerald-400 border-emerald-800',
  Canned:    'bg-red-950/50 text-red-400 border-red-800',
};
const PRIORITY_COLORS: Record<OsmPriority, string> = {
  Critical: '#EF4444',
  High:     '#F97316',
  Medium:   '#EAB308',
  Normal:   '#94A3B8',
  Low:      '#4B5563',
};
const PRIORITY_CLS: Record<OsmPriority, string> = {
  Critical: 'bg-red-950/50 text-red-400 border-red-800',
  High:     'bg-orange-950/50 text-orange-400 border-orange-800',
  Medium:   'bg-yellow-950/50 text-yellow-500 border-yellow-700',
  Normal:   'bg-slate-900/50 text-slate-400 border-slate-700',
  Low:      'bg-zinc-900/50 text-zinc-500 border-zinc-700',
};
const BRAND_COLORS: Record<Brand, string> = {
  'Zostel Hostel':  '#818CF8',
  'Zostel Plus':    '#C084FC',
  'Zostel Homes':   '#FB923C',
  'Zo Trips':       '#34D399',
  'Zo Selections':  '#F59E0B',
  'Experiences':    '#F472B6',
};
const STATUS_ORDER:   OsmStatus[]   = ['Live', 'Scheduled', 'Ideation', 'Canned'];
const PRIORITY_ORDER: OsmPriority[] = ['Critical', 'High', 'Medium', 'Normal', 'Low'];
const REDIRECT_TARGETS: RedirectTarget[] = ['Destination', 'Property', 'Homepage', 'Trip Name', 'Experience Name'];
const LS_KEY = 'on_site_campaigns_v1';

// ── Helpers ────────────────────────────────────────────────────────────────────
const genId     = () => `ons_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const addDays   = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addYears  = (d: Date, n: number) => { const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r; };
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const formatDate = (str: string) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function expandOnsiteToEvent(c: OnSiteCampaign): any {
  const color        = OSM_COLORS[c.osmTarget];
  const endDate      = c.endDate ?? toDateStr(addYears(new Date(), 1));
  const exclusiveEnd = toDateStr(addDays(new Date(endDate + 'T00:00:00'), 1));

  const isLive      = c.status === 'Live';
  const isScheduled = c.status === 'Scheduled';
  // Live      → solid fill, pill shape, full opacity
  // Scheduled → solid border, pill shape, low opacity fill
  // Ideation  → dashed border, rectangular, standard opacity
  const bgOpacity = isLive ? 1.0 : isScheduled ? 0.10 : 0.18;

  return {
    id:    c.id,
    title: c.title,
    start: c.startDate,
    end:   exclusiveEnd,
    backgroundColor: hexToRgba(color, bgOpacity),
    borderColor:     color,
    textColor:       isLive ? '#FFFFFF' : color,
    classNames: [],   // CampaignCalendar eventClassNames handles class per osmStatus
    extendedProps: {
      isSchematic:    true,           // reuses schematic event rendering in CampaignCalendar
      schematicId:    c.id,
      icon:           OSM_ICONS[c.osmTarget],
      osmTarget:      c.osmTarget,
      osmTargetNames: c.osmTargetNames,
      brand:          c.brand,
      osmStatus:      c.status,
    },
  };
}

// ── Form state ─────────────────────────────────────────────────────────────────
interface FormState {
  brand: Brand | '';
  title: string;
  osmTarget: OsmTarget;
  osmTargetNames: string[];
  osmInput: string;
  redirectTarget: RedirectTarget;
  redirectTargetNames: string[];
  redirectInput: string;
  priority: OsmPriority | '';
  status: OsmStatus | '';
  startDate: string;
  endDate: string;
}
const EMPTY: FormState = {
  brand: '', title: '',
  osmTarget: 'Destination', osmTargetNames: [], osmInput: '',
  redirectTarget: 'Destination', redirectTargetNames: [], redirectInput: '',
  priority: '', status: '',
  startDate: '', endDate: '',
};

// ── Chip input ─────────────────────────────────────────────────────────────────
function ChipInput({ label, names, input, onInput, onAdd, onRemove, required }: {
  label: string; names: string[]; input: string;
  onInput:  (v: string) => void;
  onAdd:    (v: string) => void;
  onRemove: (v: string) => void;
  required?: boolean;
}) {
  const commit = (raw: string) => {
    const v = raw.trim();
    if (v && !names.includes(v)) onAdd(v);
    else onInput('');
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.endsWith(',')) commit(v.slice(0, -1));
    else onInput(v);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(input); }
    if (e.key === 'Backspace' && !input && names.length) onRemove(names[names.length - 1]);
  };
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}{' '}
        <span className="text-[#555] font-normal normal-case tracking-normal">— comma or ↵ to add</span>
      </p>
      <div className="min-h-[34px] flex flex-wrap gap-1.5 items-center bg-[#161616] border border-[#333] rounded-lg px-2 py-1.5 focus-within:border-[#555] transition-colors">
        {names.map(n => (
          <span key={n} className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2a2a] text-[#B0B0B0] text-xs rounded-full border border-[#444]">
            {n}
            <button type="button" onClick={() => onRemove(n)}
              className="text-[#555] hover:text-[#E0E0E0] transition-colors leading-none mt-px">
              <span className="material-symbols-outlined" style={{ fontSize: '0.65rem', lineHeight: 1 }}>close</span>
            </button>
          </span>
        ))}
        <input
          type="text" value={input}
          onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder={names.length === 0 ? `Add ${label.split(' ')[0].toLowerCase()} name…` : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-[#E0E0E0] placeholder-[#555] outline-none"
        />
      </div>
    </div>
  );
}

// ── Form body ──────────────────────────────────────────────────────────────────
function FormBody({ f, set, onSubmit, onDelete, isEdit, saving }: {
  f: FormState;
  set: (k: keyof FormState, v: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: () => void;
  isEdit: boolean;
  saving?: boolean;
}) {
  const addChip    = (v: string) => { set('osmTargetNames', [...f.osmTargetNames, v]); set('osmInput', ''); };
  const removeChip = (v: string) => set('osmTargetNames', f.osmTargetNames.filter(n => n !== v));

  const addRedirectChip    = (v: string) => { set('redirectTargetNames', [...f.redirectTargetNames, v]); set('redirectInput', ''); };
  const removeRedirectChip = (v: string) => set('redirectTargetNames', f.redirectTargetNames.filter(n => n !== v));
  const needsRedirectName  = f.redirectTarget !== 'Homepage';

  return (
    <form onSubmit={onSubmit} className="space-y-3">

      {/* Row 1: Brand · Campaign Title */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Brand <span className="text-rose-400">*</span></p>
          <div className="flex gap-1">
            {(['Zostel Hostel', 'Zostel Plus', 'Zostel Homes', 'Zo Trips', 'Zo Selections', 'Experiences'] as Brand[]).map(b => (
              <button key={b} type="button" onClick={() => set('brand', b)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={f.brand === b
                  ? { backgroundColor: hexToRgba(BRAND_COLORS[b], 0.15), borderColor: BRAND_COLORS[b], color: BRAND_COLORS[b] }
                  : { backgroundColor: '#161616', borderColor: '#333', color: '#888' }}>
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
            Campaign Title <span className="text-rose-400">*</span>
          </p>
          <input type="text" placeholder="e.g. Goa Summer Homepage Banner" value={f.title}
            onChange={e => set('title', e.target.value)} required
            className="w-full bg-[#161616] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-[#E0E0E0] placeholder-[#555] outline-none focus:border-[#555] transition-colors" />
        </div>
      </div>

      {/* Row 2: OSM Target · chip input */}
      <div className="flex flex-wrap gap-3 items-start">
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
            OSM Target <span className="text-rose-400">*</span>
          </p>
          <div className="flex gap-1">
            {(['Destination', 'Property', 'Homepage'] as OsmTarget[]).map(t => {
              const color    = OSM_COLORS[t];
              const isActive = f.osmTarget === t;
              return (
                <button key={t} type="button"
                  onClick={() => {
                    set('osmTarget', t);
                    if (t === 'Homepage') { set('osmTargetNames', []); set('osmInput', ''); }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                  style={isActive
                    ? { backgroundColor: hexToRgba(color, 0.15), borderColor: color, color }
                    : { backgroundColor: '#161616', borderColor: '#333', color: '#888' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.8rem', lineHeight: 1 }}>{OSM_ICONS[t]}</span>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {f.osmTarget !== 'Homepage' && (
          <div className="flex-1 min-w-[240px]">
            <ChipInput
              label={`${f.osmTarget} Name`}
              names={f.osmTargetNames}
              input={f.osmInput}
              onInput={v  => set('osmInput', v)}
              onAdd={addChip}
              onRemove={removeChip}
              required
            />
          </div>
        )}
      </div>

      {/* Row 3: Redirect Target (+ name chips) · Priority · Status */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex flex-wrap gap-3 items-start">
          <div>
            <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Redirect Target <span className="text-rose-400">*</span></p>
            <select value={f.redirectTarget}
              onChange={e => {
                const v = e.target.value as RedirectTarget;
                set('redirectTarget', v);
                if (v === 'Homepage') { set('redirectTargetNames', []); set('redirectInput', ''); }
              }}
              className="bg-[#161616] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-[#E0E0E0] outline-none focus:border-[#555] cursor-pointer transition-colors">
              {REDIRECT_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {needsRedirectName && (
            <div className="flex-1 min-w-[220px]">
              <ChipInput
                label={`${f.redirectTarget} Name`}
                names={f.redirectTargetNames}
                input={f.redirectInput}
                onInput={v  => set('redirectInput', v)}
                onAdd={addRedirectChip}
                onRemove={removeRedirectChip}
                required
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Priority <span className="text-rose-400">*</span></p>
          <div className="flex gap-1">
            {PRIORITY_ORDER.map(p => {
              const isActive = f.priority === p;
              const color    = PRIORITY_COLORS[p];
              return (
                <button key={p} type="button" onClick={() => set('priority', p)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                  style={isActive
                    ? { backgroundColor: hexToRgba(color, 0.15), borderColor: color, color }
                    : { backgroundColor: '#161616', borderColor: '#333', color: '#888' }}>
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">Status <span className="text-rose-400">*</span></p>
          <div className="flex gap-1">
            {(['Ideation', 'Scheduled', 'Live', 'Canned'] as OsmStatus[]).map(s => {
              const isActive = f.status === s;
              const color    = STATUS_COLORS[s];
              return (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                  style={isActive
                    ? { backgroundColor: hexToRgba(color, 0.15), borderColor: color, color }
                    : { backgroundColor: '#161616', borderColor: '#333', color: '#888' }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 4: Dates */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
            Start Date <span className="text-rose-400">*</span>
          </p>
          <MiniCalendar value={f.startDate}
            onChange={v => { set('startDate', v); if (f.endDate && v > f.endDate) set('endDate', ''); }}
            placeholder="Pick start date" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-1.5">
            End Date <span className="ml-1 text-[#555] font-normal normal-case">(blank = ∞)</span>
          </p>
          <MiniCalendar value={f.endDate} onChange={v => set('endDate', v)}
            minDate={f.startDate || undefined} placeholder="Pick end date (opt.)" />
        </div>
        {!f.endDate && f.startDate && (
          <div className="flex items-center gap-1 pb-1.5 text-[#666]">
            <span className="text-xs">→</span>
            <span className="text-xl leading-none">∞</span>
            <span className="text-[10px]">indefinite</span>
          </div>
        )}
      </div>

      {/* Row 5: Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#2a2a2a]">
        {isEdit && onDelete && (
          <button type="button" onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800 rounded-lg text-xs font-medium transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', lineHeight: 1 }}>delete</span>
            Delete
          </button>
        )}
        <button type="submit" disabled={
            saving || !f.brand || !f.title.trim() || !f.startDate || !f.priority || !f.status
            || (f.osmTarget !== 'Homepage' && f.osmTargetNames.length === 0 && !f.osmInput.trim())
            || (f.redirectTarget !== 'Homepage' && f.redirectTargetNames.length === 0 && !f.redirectInput.trim())
          }
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1 }}>
            {saving ? 'hourglass_empty' : isEdit ? 'save' : 'add'}
          </span>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Campaign'}
        </button>
      </div>
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function OnsitePage() {
  const [campaigns, setCampaigns] = useState<OnSiteCampaign[]>([]);
  const [form, setForm]           = useState<FormState>({ ...EMPTY });
  const [editId, setEditId]       = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [calOpen, setCalOpen]     = useState(false);
  const [search, setSearch]       = useState('');
  const [sortMode, setSortMode]   = useState<SortMode>('status');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);

  // ── Fetch campaigns from Google Sheets API ──────────────────────────────────
  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/onsite');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCampaigns(data.campaigns ?? []);
      setApiError(null);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generic API call helper ─────────────────────────────────────────────────
  const apiCall = async (method: string, body: object): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch('/api/onsite', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Request failed (${res.status})`);
      }
      return true;
    } catch (err: any) {
      setApiError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const set        = (k: keyof FormState, v: any) => setForm(prev => ({ ...prev, [k]: v }));
  const resetForm  = () => { setForm({ ...EMPTY }); setEditId(null); };
  const closeModal = () => { setModalOpen(false); resetForm(); };

  const openEdit = (id: string) => {
    const c = campaigns.find(x => x.id === id);
    if (!c) return;
    setForm({
      brand: c.brand, title: c.title,
      osmTarget: c.osmTarget, osmTargetNames: c.osmTargetNames, osmInput: '',
      redirectTarget: c.redirectTarget, redirectTargetNames: c.redirectTargetNames ?? [], redirectInput: '',
      priority: c.priority, status: c.status,
      startDate: c.startDate, endDate: c.endDate ?? '',
    });
    setEditId(c.id);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.title.trim() || !form.startDate || !form.priority || !form.status) return;
    const needsOsmName      = form.osmTarget      !== 'Homepage';
    const needsRedirectName = form.redirectTarget !== 'Homepage';
    if (needsOsmName      && form.osmTargetNames.length === 0      && !form.osmInput.trim())     return;
    if (needsRedirectName && form.redirectTargetNames.length === 0 && !form.redirectInput.trim()) return;

    const finalNames = form.osmTarget === 'Homepage' ? [] :
      form.osmInput.trim()
        ? [...new Set([...form.osmTargetNames, form.osmInput.trim()])]
        : form.osmTargetNames;

    const finalRedirectNames = form.redirectTarget === 'Homepage' ? [] :
      form.redirectInput.trim()
        ? [...new Set([...form.redirectTargetNames, form.redirectInput.trim()])]
        : form.redirectTargetNames;

    const campaign: OnSiteCampaign = {
      id:                  editId ?? genId(),
      brand:               form.brand as Brand,
      title:               form.title.trim(),
      osmTarget:           form.osmTarget,
      osmTargetNames:      finalNames,
      redirectTarget:      form.redirectTarget,
      redirectTargetNames: finalRedirectNames,
      priority:            form.priority as OsmPriority,
      status:              form.status as OsmStatus,
      startDate:           form.startDate,
      endDate:             form.endDate || null,
    };

    const ok = await apiCall(editId ? 'PUT' : 'POST', campaign);
    if (ok) {
      await fetchCampaigns();
      resetForm();
      setModalOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    const ok = await apiCall('DELETE', { id: editId });
    if (ok) { await fetchCampaigns(); closeModal(); }
  };

  // ── Feed ─────────────────────────────────────────────────────────────────────
  const feedCampaigns = [...campaigns]
    .filter(c => !search.trim() || c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === 'status')   return STATUS_ORDER.indexOf(a.status)   - STATUS_ORDER.indexOf(b.status);
      if (sortMode === 'priority') return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      return a.startDate.localeCompare(b.startDate);
    });

  const extraEvents  = campaigns.filter(c => c.status !== 'Canned').map(expandOnsiteToEvent);
  const editCampaign = campaigns.find(c => c.id === editId);
  const liveCnt      = campaigns.filter(c => c.status === 'Live').length;
  const schedCnt     = campaigns.filter(c => c.status === 'Scheduled').length;
  const ideaCnt      = campaigns.filter(c => c.status === 'Ideation').length;

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
              <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '1.2rem', lineHeight: 1 }}>web_asset</span>
              On-Site Litematica
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {liveCnt  > 0 && <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLS.Live}`}>{liveCnt} live</span>}
            {schedCnt > 0 && <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLS.Scheduled}`}>{schedCnt} scheduled</span>}
            {ideaCnt  > 0 && <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLS.Ideation}`}>{ideaCnt} ideation</span>}
            <span className="px-3 py-1 bg-[#2a2a2a] text-[#B0B0B0] border border-[#444444] rounded-full text-xs font-medium ml-1">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-4">

        {/* API error banner */}
        {apiError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300">
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '0.9rem', lineHeight: 1 }}>error</span>
            <span className="flex-1">{apiError}</span>
            <button onClick={() => setApiError(null)} className="text-red-600 hover:text-red-400 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '0.75rem', lineHeight: 1 }}>close</span>
            </button>
          </div>
        )}

        {/* Plan form */}
        <div className="bg-[#1e1e1e] rounded-xl border border-[#444444] p-4">
          <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase mb-3">Plan an On-Site Campaign</p>
          <FormBody f={form} set={set} onSubmit={handleSubmit} isEdit={false} saving={saving} />
        </div>

        {/* Collapsible calendar */}
        <div className="bg-[#1e1e1e] rounded-xl border border-[#444444] overflow-hidden">
          <button
            onClick={() => setCalOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#252525] transition-colors"
          >
            <span className="text-[10px] font-semibold text-[#888] tracking-wider uppercase flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1 }}>calendar_month</span>
              Campaign Calendar
              {campaigns.length > 0 && (
                <span className="text-[#555] font-normal normal-case tracking-normal ml-1">
                  — {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span className="material-symbols-outlined text-[#555]" style={{ fontSize: '1rem', lineHeight: 1 }}>
              {calOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {calOpen && (
            <div className="px-4 pb-4">
              <CampaignCalendar
                onSelect={() => {}}
                collisions={[]}
                hideFilters
                blankCalendar
                extraEvents={extraEvents}
                onExtraEventClick={openEdit}
              />
            </div>
          )}
        </div>

        {/* Campaign feed */}
        <div className="bg-[#1e1e1e] rounded-xl border border-[#444444] p-4">
          {/* Feed toolbar */}
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold text-[#888] tracking-wider uppercase flex-1">Campaign Feed</p>
            {/* Search */}
            <div className="flex items-center gap-1.5 bg-[#161616] border border-[#333] rounded-lg px-2.5 py-1 focus-within:border-[#555] transition-colors">
              <span className="material-symbols-outlined text-[#555]" style={{ fontSize: '0.8rem', lineHeight: 1 }}>search</span>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search title…"
                className="bg-transparent text-xs text-[#E0E0E0] placeholder-[#555] outline-none w-32"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-[#555] hover:text-[#ccc] transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '0.7rem', lineHeight: 1 }}>close</span>
                </button>
              )}
            </div>
            {/* Sort */}
            <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}
              className="bg-[#161616] border border-[#333] rounded-lg px-2.5 py-1 text-xs text-[#888] outline-none cursor-pointer focus:border-[#555] transition-colors">
              <option value="status">Sort: Status</option>
              <option value="priority">Sort: Priority</option>
              <option value="date">Sort: Date</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[#555] text-sm">
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1.1rem', lineHeight: 1 }}>progress_activity</span>
              Loading campaigns from Google Sheets…
            </div>
          ) : feedCampaigns.length === 0 ? (
            <p className="text-[#555] text-sm text-center py-8 italic">
              {campaigns.length === 0
                ? 'No on-site campaigns yet — plan one above.'
                : 'No campaigns match your search.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {feedCampaigns.map(c => {
                const osmColor = OSM_COLORS[c.osmTarget];
                const bColor   = BRAND_COLORS[c.brand];
                return (
                  <button key={c.id} onClick={() => openEdit(c.id)}
                    className="w-full flex items-center gap-3 py-2.5 px-2 text-left hover:bg-[#252525] transition-colors rounded-lg">
                    {/* OSM colour bar */}
                    <div className="w-1 h-9 rounded-full flex-shrink-0" style={{ backgroundColor: osmColor }} />
                    {/* OSM icon */}
                    <span className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: '1rem', lineHeight: 1, color: osmColor }}>
                      {OSM_ICONS[c.osmTarget]}
                    </span>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border flex-shrink-0"
                          style={{
                            backgroundColor: hexToRgba(bColor, 0.1),
                            borderColor:     hexToRgba(bColor, 0.4),
                            color:           bColor,
                          }}>
                          {c.brand}
                        </span>
                        <p className="text-sm font-medium text-[#E0E0E0] truncate">{c.title}</p>
                      </div>
                      <p className="text-[11px] text-[#555]">
                        <span style={{ color: hexToRgba(osmColor, 0.85) }}>{c.osmTarget}</span>
                        {c.osmTargetNames.length > 0 && <span className="text-[#444]">: {c.osmTargetNames.join(', ')}</span>}
                        <span className="mx-1 text-[#333]">·</span>
                        <span>→ {c.redirectTarget}{c.redirectTargetNames?.length > 0 && <span className="text-[#444]">: {c.redirectTargetNames.join(', ')}</span>}</span>
                        <span className="mx-1 text-[#333]">·</span>
                        {formatDate(c.startDate)}{c.endDate ? ` → ${formatDate(c.endDate)}` : ' → ∞'}
                      </p>
                    </div>
                    {/* Priority badge */}
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_CLS[c.priority]}`}>
                      {c.priority}
                    </span>
                    {/* Status badge */}
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CLS[c.status]}`}>
                      {c.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {modalOpen && editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-[#1e1e1e] border border-[#444] rounded-xl p-5 w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#E0E0E0] flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '1rem', lineHeight: 1 }}>edit</span>
                Edit On-Site Campaign
                {editCampaign && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_CLS[editCampaign.status]}`}>
                    {editCampaign.status}
                  </span>
                )}
              </h3>
              <button onClick={closeModal} className="text-[#888] hover:text-[#ccc] transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', lineHeight: 1 }}>close</span>
              </button>
            </div>
            <FormBody f={form} set={set} onSubmit={handleSubmit} onDelete={handleDelete} isEdit={true} saving={saving} />
          </div>
        </div>
      )}
    </main>
  );
}
