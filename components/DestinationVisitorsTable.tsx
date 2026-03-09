"use client";

import { useState, useEffect } from 'react';
import { DestinationVisitorRow } from '@/lib/metabase';

type SortKey = 'destination' | 'destination_unique_visitors' | 'property_unique_visitors' | 'delta_pct_past7days';
type View = 'destinations' | 'properties';

function DeltaBar({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="text-xs text-violet-300">—</span>;
  }
  const pct = Math.min(Math.abs(value), 300);
  const isPos = value >= 0;
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <span className={`text-xs font-medium w-14 text-right ${isPos ? 'text-emerald-600' : 'text-red-500'}`}>
        {isPos ? '+' : ''}{value.toFixed(0)}%
      </span>
      <div className="flex-1 h-1.5 bg-violet-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPos ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ width: `${(pct / 300) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function DestinationVisitorsTable() {
  const [rows, setRows] = useState<DestinationVisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('destinations');
  const [sortKey, setSortKey] = useState<SortKey>('destination_unique_visitors');
  const [sortDesc, setSortDesc] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/destination-visitors')
      .then(res => res.json())
      .then(data => { setRows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Failed to load data'); setLoading(false); });
  }, []);

  const filtered = rows
    .filter(r => view === 'destinations' ? r.property === null : r.property !== null)
    .filter(r => {
      const q = search.toLowerCase();
      return r.destination.toLowerCase().includes(q) || (r.property || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      if (typeof aVal === 'string') return sortDesc ? bVal.toString().localeCompare(aVal.toString()) : aVal.toString().localeCompare(bVal.toString());
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(d => !d);
    else { setSortKey(key); setSortDesc(true); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-violet-300 ml-1">↕</span>;
    return <span className="text-violet-600 ml-1">{sortDesc ? '↓' : '↑'}</span>;
  }

  return (
    <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-violet-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-violet-900">Destination &amp; Property Visitors</h2>
          <p className="text-xs text-violet-400 mt-0.5">Last 7 days vs previous 7 days · {rows.length} total rows</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-slate-700 placeholder-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-300 w-40"
          />
          <div className="flex rounded-lg overflow-hidden border border-violet-200 text-xs font-medium">
            <button onClick={() => setView('destinations')} className={`px-3 py-1.5 ${view === 'destinations' ? 'bg-violet-600 text-white' : 'bg-white text-violet-500 hover:bg-violet-50'}`}>Destinations</button>
            <button onClick={() => setView('properties')} className={`px-3 py-1.5 ${view === 'properties' ? 'bg-violet-600 text-white' : 'bg-white text-violet-500 hover:bg-violet-50'}`}>Properties</button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading && <div className="p-8 text-center text-violet-400 text-sm">Loading visitor data…</div>}
      {error && <div className="p-8 text-center text-red-400 text-sm">{error}</div>}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-violet-50 text-violet-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-violet-700" onClick={() => toggleSort('destination')}>
                  Destination <SortIcon col="destination" />
                </th>
                {view === 'properties' && <th className="px-4 py-3 text-left">Property</th>}
                <th className="px-4 py-3 text-right cursor-pointer hover:text-violet-700" onClick={() => toggleSort(view === 'destinations' ? 'destination_unique_visitors' : 'property_unique_visitors')}>
                  Unique Visitors <SortIcon col={view === 'destinations' ? 'destination_unique_visitors' : 'property_unique_visitors'} />
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-violet-700" onClick={() => toggleSort('delta_pct_past7days')}>
                  WoW Change <SortIcon col="delta_pct_past7days" />
                </th>
                {view === 'properties' && <th className="px-4 py-3 text-right">Instagram</th>}
                {view === 'properties' && <th className="px-4 py-3 text-right">Meta Ads</th>}
                {view === 'properties' && <th className="px-4 py-3 text-right">Center</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-violet-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{row.destination}</td>
                  {view === 'properties' && <td className="px-4 py-2.5 text-slate-500">{row.property}</td>}
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                    {(view === 'destinations' ? row.destination_unique_visitors : row.property_unique_visitors)?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-2.5"><DeltaBar value={row.delta_pct_past7days} /></td>
                  {view === 'properties' && <td className="px-4 py-2.5 text-right text-slate-500">{row.instagram_users ?? '—'}</td>}
                  {view === 'properties' && <td className="px-4 py-2.5 text-right text-slate-500">{row.meta_ads_users ?? '—'}</td>}
                  {view === 'properties' && <td className="px-4 py-2.5 text-right text-slate-500">{row.center_users ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="p-8 text-center text-violet-300 text-sm">No results found</div>}
        </div>
      )}
    </div>
  );
}
