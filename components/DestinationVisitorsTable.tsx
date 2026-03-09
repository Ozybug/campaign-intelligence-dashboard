"use client";

import { useState, useEffect } from 'react';
import { DestinationVisitorRow } from '@/lib/metabase';

function DeltaBar({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value));
  const isPositive = clamped >= 0;
  const width = Math.abs(clamped);
  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className={`text-xs font-medium w-14 text-right ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
        {isPositive ? '+' : ''}{value.toFixed(0)}%
      </span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function DestinationVisitorsTable() {
  const [rows, setRows] = useState<DestinationVisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'destination' | 'property'>('destination');

  useEffect(() => {
    fetch('/api/destination-visitors')
      .then(res => res.json())
      .then(data => { setRows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = rows
    .filter(r => view === 'destination' ? r.property === null : r.property !== null)
    .filter(r => {
      const q = search.toLowerCase();
      return r.destination.toLowerCase().includes(q) || (r.property || '').toLowerCase().includes(q);
    });

  return (
    <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-violet-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-violet-900">Destination &amp; Property Visitors</h2>
          <p className="text-violet-400 text-xs mt-0.5">Last 7 days vs previous 7 days · {rows.length} rows</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-violet-200 text-xs">
            <button
              onClick={() => setView('destination')}
              className={`px-3 py-1.5 font-medium transition-colors ${view === 'destination' ? 'bg-violet-600 text-white' : 'text-violet-500 hover:bg-violet-50'}`}
            >
              Destination
            </button>
            <button
              onClick={() => setView('property')}
              className={`px-3 py-1.5 font-medium transition-colors ${view === 'property' ? 'bg-violet-600 text-white' : 'text-violet-500 hover:bg-violet-50'}`}
            >
              Property
            </button>
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-violet-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 w-36"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-violet-300 text-sm">Loading visitor data...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-violet-300 text-sm">No results found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-violet-50 text-violet-500 text-xs font-medium">
                <th className="text-left px-5 py-3">Destination</th>
                {view === 'property' && <th className="text-left px-4 py-3">Property</th>}
                <th className="text-left px-4 py-3 min-w-[160px]">WoW Delta</th>
                <th className="text-right px-4 py-3">Unique Visitors</th>
                <th className="text-right px-4 py-3">Instagram</th>
                <th className="text-right px-4 py-3">Meta Ads</th>
                <th className="text-right px-4 py-3">Center</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-violet-50/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-700">{row.destination}</td>
                  {view === 'property' && (
                    <td className="px-4 py-3 text-slate-500 text-xs">{row.property}</td>
                  )}
                  <td className="px-4 py-3">
                    <DeltaBar value={row.delta_pct_past7days} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {(view === 'destination' ? row.destination_unique_visitors : row.property_unique_visitors)?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{row.instagram_users?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{row.meta_ads_users?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{row.center_users?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
