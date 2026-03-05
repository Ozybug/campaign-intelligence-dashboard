'use client';

import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GA4Summary {
  activeUsers: number;
  sessions: number;
  conversions: number;
  revenue: number;
  bounceRate: number;
  avgSessionDuration: number;
  pageViews: number;
  newUsers: number;
}

interface TopPage {
  page: string;
  views: number;
  users: number;
}

interface TopSource {
  source: string;
  sessions: number;
  users: number;
}

interface GA4Data {
  propertyId: string;
  dateRange: string;
  fetchedAt: string;
  summary: GA4Summary;
  topPages: TopPage[];
  topSources: TopSource[];
}

interface GA4Error {
  error: string;
  detail?: string;
  missing?: Record<string, boolean>;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-emerald-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-emerald-700">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtRevenue(v: number) {
  return v === 0 ? '—' : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GA4TestPage() {
  const [data, setData] = useState<GA4Data | null>(null);
  const [err, setErr] = useState<GA4Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState('');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/ga4-test');
      const json = await res.json();
      if (!res.ok || json.error) {
        setErr(json);
        setData(null);
      } else {
        setData(json);
        setFetchedAt(new Date(json.fetchedAt).toLocaleString());
      }
    } catch (e) {
      setErr({ error: 'Network error', detail: String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const s = data?.summary;

  return (
    <main className="min-h-screen bg-emerald-50 text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-emerald-100 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">
              GA4 Integration Test
            </h1>
            <p className="text-emerald-500 text-sm mt-0.5">
              Direct Google Analytics 4 Data API — last 30 days
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-xs text-slate-400">
                Fetched at {fetchedAt}
              </span>
            )}
            <button
              onClick={load}
              className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-full hover:bg-emerald-700 transition-colors"
            >
              ↻ Refresh
            </button>
            <a
              href="/"
              className="px-4 py-1.5 bg-violet-100 text-violet-700 text-sm font-medium rounded-full hover:bg-violet-200 transition-colors"
            >
              ← Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-8">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-64 text-emerald-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mr-3" />
            <span className="text-lg">Calling GA4 Data API…</span>
          </div>
        )}

        {/* Error */}
        {!loading && err && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-red-700 font-bold text-lg mb-2">⚠ GA4 Error</h2>
            <p className="text-red-600 font-medium">{err.error}</p>
            {err.detail && (
              <pre className="mt-3 text-xs bg-red-100 rounded p-3 overflow-auto text-red-700 whitespace-pre-wrap">
                {err.detail}
              </pre>
            )}
            {err.missing && (
              <div className="mt-4 space-y-1">
                <p className="text-sm font-semibold text-red-700">Missing env vars:</p>
                {Object.entries(err.missing).map(([k, missing]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className={missing ? 'text-red-500' : 'text-emerald-600'}>
                      {missing ? '✗' : '✓'}
                    </span>
                    <code className="font-mono">{k}</code>
                    <span className={missing ? 'text-red-400' : 'text-emerald-400'}>
                      {missing ? '— not set' : '— configured'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {!loading && data && s && (
          <>
            {/* Property info banner */}
            <div className="bg-emerald-100 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-3">
              <span className="text-emerald-700 text-lg">✅</span>
              <div>
                <span className="font-semibold text-emerald-800">
                  GA4 API connected
                </span>
                <span className="text-emerald-600 text-sm ml-2">
                  Property ID: {data.propertyId} · {data.dateRange}
                </span>
              </div>
            </div>

            {/* Summary metrics grid */}
            <section>
              <h2 className="text-base font-semibold text-emerald-800 uppercase tracking-wide mb-4">
                📊 Site-wide Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Active Users" value={s.activeUsers.toLocaleString()} icon="👥" />
                <MetricCard label="New Users" value={s.newUsers.toLocaleString()} icon="🆕" />
                <MetricCard label="Sessions" value={s.sessions.toLocaleString()} icon="🔄" />
                <MetricCard label="Page Views" value={s.pageViews.toLocaleString()} icon="👁" />
                <MetricCard label="Conversions" value={s.conversions.toLocaleString()} icon="🎯" />
                <MetricCard
                  label="Revenue"
                  value={fmtRevenue(s.revenue)}
                  icon="💰"
                />
                <MetricCard
                  label="Bounce Rate"
                  value={`${(s.bounceRate * 100).toFixed(1)}%`}
                  icon="↩"
                  sub="lower is better"
                />
                <MetricCard
                  label="Avg Session"
                  value={fmtDuration(s.avgSessionDuration)}
                  icon="⏱"
                />
              </div>
            </section>

            {/* Top pages + sources side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Top Pages */}
              <section className="bg-white rounded-xl p-5 border border-emerald-100 shadow-sm">
                <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-4">
                  📄 Top Pages (last 30 days)
                </h2>
                {data.topPages.length === 0 ? (
                  <p className="text-slate-400 text-sm">No data</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Page</th>
                        <th className="text-right pb-2 font-medium">Views</th>
                        <th className="text-right pb-2 font-medium">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-emerald-50">
                          <td className="py-2 text-slate-700 font-mono text-xs truncate max-w-[180px]">
                            {p.page}
                          </td>
                          <td className="py-2 text-right text-emerald-700 font-semibold">
                            {p.views.toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            {p.users.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Top Sources */}
              <section className="bg-white rounded-xl p-5 border border-emerald-100 shadow-sm">
                <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide mb-4">
                  🌐 Top Traffic Sources (last 30 days)
                </h2>
                {data.topSources.length === 0 ? (
                  <p className="text-slate-400 text-sm">No data</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Source</th>
                        <th className="text-right pb-2 font-medium">Sessions</th>
                        <th className="text-right pb-2 font-medium">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSources.map((src, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-emerald-50">
                          <td className="py-2 text-slate-700 capitalize">{src.source}</td>
                          <td className="py-2 text-right text-emerald-700 font-semibold">
                            {src.sessions.toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-slate-500">
                            {src.users.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>

            {/* Raw JSON debug panel */}
            <section>
              <details className="bg-slate-900 rounded-xl overflow-hidden">
                <summary className="px-5 py-3 text-slate-300 text-sm font-mono cursor-pointer hover:text-white">
                  🔍 Raw API Response (JSON)
                </summary>
                <pre className="px-5 pb-5 text-xs text-emerald-400 overflow-auto max-h-80 whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            </section>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-slate-300 text-xs pb-4">
          GA4 Test Page · Property {data?.propertyId ?? '—'} · Powered by @google-analytics/data
        </div>
      </div>
    </main>
  );
}
