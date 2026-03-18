"use client";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import CampaignDetails from '@/components/CampaignDetails';
import MetricsChart from '@/components/MetricsChart';
import DestinationVisitorsTable from '@/components/DestinationVisitorsTable';
import { CalendarEvent, CampaignMetrics, CollisionWarning } from '@/types/campaign';

const CampaignCalendar = dynamic(() => import('@/components/CampaignCalendar'), { ssr: false });

// ── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCSV(val: unknown): string {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const CSV_HEADERS = [
  'type', 'id', 'brand', 'title',
  'channel', 'format', 'mode', 'stage',
  'startDate', 'endDate',
  'blackoutDates', 'messageTitle', 'subtitle', 'messageBody',
  'recurringInterval', 'recurringCustomValue', 'recurringCustomUnit',
  'osmTarget', 'osmTargetNames', 'redirectTarget', 'redirectTargetNames',
  'priority', 'status',
];

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [selectedCampaign, setSelectedCampaign] = useState<CalendarEvent | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [collisions, setCollisions] = useState<CollisionWarning[]>([]);
  const [restoreMsg, setRestoreMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/campaigns')
      .then(res => res.json())
      .then(data => setCollisions(data.collisions || []));
  }, []);

  useEffect(() => {
    if (!selectedCampaign) return;
    const start = selectedCampaign.start;
    const end = selectedCampaign.end || selectedCampaign.start;
    fetch(`/api/analytics?campaignId=${selectedCampaign.id}&start=${start}&end=${end}`)
      .then(res => res.json())
      .then(data => setMetrics(data));
  }, [selectedCampaign]);

  // Auto-clear restore message after 4 s
  useEffect(() => {
    if (!restoreMsg) return;
    const t = setTimeout(() => setRestoreMsg(null), 4000);
    return () => clearTimeout(t);
  }, [restoreMsg]);

  // ── Backup ────────────────────────────────────────────────────────────────

  function downloadCSV() {
    const schematic: any[] = JSON.parse(localStorage.getItem('schematic_campaigns_v1') || '[]');
    const onsite: any[]    = JSON.parse(localStorage.getItem('on_site_campaigns_v1')   || '[]');

    if (schematic.length === 0 && onsite.length === 0) {
      setRestoreMsg({ ok: false, text: 'Nothing to backup — no Schematic or On-Site campaigns found.' });
      return;
    }

    const rows = [
      ...schematic.map((c: any) => [
        'schematic', c.id, c.brand, c.title,
        c.channel, c.format, c.mode, c.stage,
        c.startDate, c.endDate || '',
        JSON.stringify(c.blackoutDates || []),
        c.messageTitle || '', c.subtitle || '', c.messageBody || '',
        c.recurring?.interval || '', c.recurring?.customValue ?? '', c.recurring?.customUnit || '',
        '', '', '', '', '', '',
      ]),
      ...onsite.map((c: any) => [
        'onsite', c.id, c.brand, c.title,
        '', '', '', '',
        c.startDate, c.endDate || '',
        '', '', '', '', '', '', '',
        c.osmTarget, JSON.stringify(c.osmTargetNames || []),
        c.redirectTarget, JSON.stringify(c.redirectTargetNames || []),
        c.priority, c.status,
      ]),
    ];

    const csv = [
      CSV_HEADERS.join(','),
      ...rows.map(r => r.map(escapeCSV).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `campaign-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRestoreMsg({ ok: true, text: `Backed up ${schematic.length} Schematic + ${onsite.length} On-Site campaigns.` });
  }

  // ── Restore ───────────────────────────────────────────────────────────────

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so same file can be re-uploaded

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text  = (ev.target?.result as string).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.split('\n').filter(l => l.trim());
        const headers = parseCSVLine(lines[0]);

        const rows = lines.slice(1).map(l => {
          const vals = parseCSVLine(l);
          return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
        });

        const schematic = rows
          .filter(r => r.type === 'schematic')
          .map(r => ({
            id:        r.id,
            brand:     r.brand,
            title:     r.title,
            channel:   r.channel,
            format:    r.format,
            mode:      r.mode,
            stage:     r.stage,
            startDate: r.startDate,
            endDate:   r.endDate || null,
            ...(r.blackoutDates ? { blackoutDates: JSON.parse(r.blackoutDates) } : {}),
            ...(r.messageTitle  ? { messageTitle:  r.messageTitle }  : {}),
            ...(r.subtitle      ? { subtitle:      r.subtitle }      : {}),
            ...(r.messageBody   ? { messageBody:   r.messageBody }   : {}),
            ...(r.recurringInterval ? {
              recurring: {
                interval:    r.recurringInterval,
                ...(r.recurringCustomValue ? { customValue: Number(r.recurringCustomValue) } : {}),
                ...(r.recurringCustomUnit  ? { customUnit:  r.recurringCustomUnit }           : {}),
              },
            } : {}),
          }));

        const onsite = rows
          .filter(r => r.type === 'onsite')
          .map(r => ({
            id:                 r.id,
            brand:              r.brand,
            title:              r.title,
            osmTarget:          r.osmTarget,
            osmTargetNames:     r.osmTargetNames    ? JSON.parse(r.osmTargetNames)    : [],
            redirectTarget:     r.redirectTarget,
            redirectTargetNames: r.redirectTargetNames ? JSON.parse(r.redirectTargetNames) : [],
            priority:           r.priority,
            status:             r.status,
            startDate:          r.startDate,
            endDate:            r.endDate || null,
          }));

        if (schematic.length === 0 && onsite.length === 0) {
          setRestoreMsg({ ok: false, text: 'No valid campaign rows found in the CSV.' });
          return;
        }

        localStorage.setItem('schematic_campaigns_v1', JSON.stringify(schematic));
        localStorage.setItem('on_site_campaigns_v1',   JSON.stringify(onsite));
        setRestoreMsg({ ok: true, text: `Restored ${schematic.length} Schematic + ${onsite.length} On-Site campaigns. Reloading…` });
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        setRestoreMsg({ ok: false, text: 'Failed to parse CSV — please check the file format.' });
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  return (
    <main className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      <div className="bg-[#1a1a1a] border-b border-[#444444] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#E0E0E0]">Campaign Intelligence Dashboard</h1>
            <p className="text-[#B0B0B0] text-sm mt-0.5">MoEngage x Google Analytics 4 - Real-time campaign performance</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#2a2a2a] text-[#B0B0B0] border border-[#444444] rounded-full text-xs font-medium">Live</span>
            {/* 🔀 Flows — hidden for now, kept for future use
            <a href="/flows" className="px-3 py-1 bg-[#333333] text-[#E0E0E0] border border-[#444444] rounded-full text-xs font-medium hover:bg-[#444444] transition-colors">🔀 Flows</a>
            */}
            <a
              href="/schematic"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a2e] text-indigo-300 border border-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-900/40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1, verticalAlign: 'middle' }}>schema</span>
              Schematic
            </a>
            <a
              href="/onsite"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#1e150a] text-amber-400 border border-amber-800 rounded-full text-xs font-medium hover:bg-amber-900/40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1, verticalAlign: 'middle' }}>web_asset</span>
              On-Site Litematica
            </a>

            {/* Divider */}
            <span className="w-px h-5 bg-[#444444]" />

            {/* Backup */}
            <button
              onClick={downloadCSV}
              title="Download all Schematic & On-Site campaigns as CSV"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#0d1f0d] text-emerald-400 border border-emerald-800 rounded-full text-xs font-medium hover:bg-emerald-900/40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1, verticalAlign: 'middle' }}>download</span>
              Backup
            </button>

            {/* Restore */}
            <input ref={uploadRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => uploadRef.current?.click()}
              title="Import a backup CSV to restore campaigns"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#0d0d1f] text-sky-400 border border-sky-800 rounded-full text-xs font-medium hover:bg-sky-900/40 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', lineHeight: 1, verticalAlign: 'middle' }}>upload</span>
              Restore
            </button>
          </div>
        </div>

        {/* Restore / backup status message */}
        {restoreMsg && (
          <div className="max-w-7xl mx-auto mt-2">
            <p className={`text-xs px-3 py-1.5 rounded-md inline-block ${
              restoreMsg.ok
                ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800'
                : 'bg-red-900/30 text-red-300 border border-red-800'
            }`}>
              {restoreMsg.text}
            </p>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <h2 className="text-lg font-semibold text-[#E0E0E0] mb-3">Campaign Calendar</h2>
            <CampaignCalendar onSelect={setSelectedCampaign} collisions={collisions} />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#E0E0E0] mb-3">Campaign Details</h2>
              <CampaignDetails campaign={selectedCampaign} />
            </div>
            <MetricsChart metrics={metrics} campaignName={selectedCampaign?.title || ''} />
          </div>
        </div>
        <div className="mt-8"><DestinationVisitorsTable /></div>
        <div className="mt-8 text-center text-[#888888] text-xs">Powered by MoEngage + Google Analytics 4 - Built with Next.js 14 + Vercel</div>
      </div>
    </main>
  );
}
