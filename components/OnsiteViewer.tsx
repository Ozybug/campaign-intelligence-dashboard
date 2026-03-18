"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// Must be NEXT_PUBLIC_ so it is included in the client bundle.
// Set this to your MoEngage App ID in .env.local:
//   NEXT_PUBLIC_MOENGAGE_APP_ID=YOUR_APP_ID
const MOE_APP_ID = process.env.NEXT_PUBLIC_MOENGAGE_APP_ID || '';

// Derived from MOENGAGE_BASE_URL (api-03 -> DC_3).
// Change if your account uses a different data centre.
const MOE_CLUSTER = 'DC_3';

// All stub methods the MoEngage SDK exposes before the real script loads.
const MOE_METHODS = [
  'track_event', 'add_unique_user_attribute', 'add_user_attribute',
  'add_user_to_group', 'remove_user_attribute', 'remove_user_from_group',
  'destroy_session', 'add_first_name', 'add_last_name', 'add_email',
  'add_mobile', 'add_user_name', 'add_gender', 'add_birthday',
  'moe_events', 'call_web_push', 'track', 'location_type_attribute',
];

type SdkState = 'idle' | 'loading' | 'ready' | 'error';
type LogLevel = 'info' | 'warn' | 'error';
interface LogEntry { time: string; level: LogLevel; msg: string; }

// ---------------------------------------------------------------------------

export default function OnsiteViewer() {
  const [sdkState, setSdkState]       = useState<SdkState>('idle');
  const [sdkIsReal, setSdkIsReal]     = useState(false);   // stub -> real SDK
  const [sdkExists, setSdkExists]     = useState(false);   // window.Moengage present
  const [eventsFired, setEventsFired] = useState<string[]>([]);
  const [logs, setLogs]               = useState<LogEntry[]>([]);

  // ── Logging helper ─────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, level: LogLevel = 'info') => {
    const entry: LogEntry = { time: new Date().toLocaleTimeString(), level, msg };
    if (level === 'error') console.error(`[OSM Debug] ${msg}`);
    else if (level === 'warn') console.warn(`[OSM Debug] ${msg}`);
    else console.log(`[OSM Debug] ${msg}`);
    setLogs(prev => [...prev, entry]);
  }, []);

  // ── SDK initialisation ────────────────────────────────────────────────────
  // Replicates the standard MoEngage web-snippet entirely in useEffect so
  // window is never accessed during SSR.
  useEffect(() => {
    if (!MOE_APP_ID) {
      addLog(
        'NEXT_PUBLIC_MOENGAGE_APP_ID is not set. ' +
        'Add it to .env.local and restart the dev server.',
        'warn',
      );
      setSdkState('error');
      return;
    }

    const w = window as any;

    // If the real SDK is already present (e.g. hot-reload), skip re-init.
    if (w.Moengage && !Array.isArray(w.Moengage)) {
      addLog('window.Moengage already present (real SDK). Skipping re-init.');
      setSdkExists(true);
      setSdkIsReal(true);
      setSdkState('ready');
      return;
    }

    addLog(`Starting MoEngage SDK init — app_id=${MOE_APP_ID}, cluster=${MOE_CLUSTER}`);
    setSdkState('loading');

    // 1. Set up the stub queue (mirrors the minified snippet logic).
    const stub: any = (w.Moengage = w.Moengage || []);
    stub.invoked     = 0;
    stub.methods     = MOE_METHODS;
    stub.factory     = (method: string) =>
      (...args: any[]) => { stub.push([method, ...args]); return stub; };

    if (!stub.initialized) {
      stub.initialized = true;
      for (const m of MOE_METHODS) stub[m] = stub.factory(m);

      // 2. Configure before the script runs (must be set on the stub).
      stub['sortableData'] = {
        app_id:    MOE_APP_ID,
        cluster:   MOE_CLUSTER,
        debug_logs: 1,          // enables verbose MoEngage console output
        swPath:    '/serviceworker.js',
        enableSPA: true,         // important for Next.js SPA navigation
      };

      addLog('Stub created and sortableData configured. Injecting SDK script…');

      // 3. Inject the CDN script.
      // Cache-busted by day (same strategy as the official snippet).
      const script      = document.createElement('script');
      script.id         = 'moengage-web-sdk';
      script.async      = true;
      script.src        =
        `https://cdn.moengage.com/webpush/moe_webSdk.min.latest.js` +
        `?q=${Math.ceil(Date.now() / 86400000) * 86400000}`;

      script.onload = () => {
        const isReal = typeof w.Moengage?.track_event === 'function' &&
                       !Array.isArray(w.Moengage);
        addLog(
          `SDK script loaded. window.Moengage is ${
            isReal ? 'real SDK object' : 'still a stub (SDK may still be booting)'
          }`,
        );
        setSdkExists(true);
        setSdkIsReal(isReal);
        setSdkState('ready');
      };

      script.onerror = () => {
        addLog('Failed to load MoEngage SDK from CDN. Check network connectivity.', 'error');
        setSdkState('error');
      };

      // Insert before the first existing script tag (mirrors the snippet).
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript?.parentNode?.insertBefore(script, firstScript);
    }
  }, [addLog]);

  // ── Fire events once SDK is ready ─────────────────────────────────────────
  useEffect(() => {
    if (sdkState !== 'ready') return;

    const w   = window as any;
    const moe = w.Moengage;

    if (!moe || typeof moe.track_event !== 'function') {
      addLog(
        'window.Moengage.track_event is not callable yet. ' +
        'The real SDK may still be replacing the stub. Try the manual button.',
        'warn',
      );
      return;
    }

    const fire = (name: string, props: Record<string, unknown>) => {
      try {
        moe.track_event(name, props);
        addLog(`Fired: track_event("${name}", ${JSON.stringify(props)})`);
        setEventsFired(prev => [...prev, name]);
      } catch (e: any) {
        addLog(`Error firing track_event("${name}"): ${e.message}`, 'error');
      }
    };

    // Page-view event — triggers OSM campaign evaluation.
    fire('Page View', {
      page:   '/onsite',
      title:  'On-site Campaign Preview',
      source: 'campaign-intelligence-dashboard',
    });

    // Custom debug event — useful for campaign trigger rules in MoEngage.
    fire('OSM Debug View', {
      triggered_by: 'dashboard_button',
      timestamp:    new Date().toISOString(),
    });
  }, [sdkState, addLog]);

  // ── Manual trigger ────────────────────────────────────────────────────────
  const fireManualEvent = () => {
    const moe = (window as any).Moengage;
    if (!moe || typeof moe.track_event !== 'function') {
      addLog('window.Moengage.track_event not ready', 'warn');
      return;
    }
    const name = 'Manual Debug Event';
    moe.track_event(name, { manual: true, ts: Date.now() });
    addLog(`Fired: track_event("${name}", { manual: true })`);
    setEventsFired(prev => [...prev, name]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const sdkBadgeClass =
    sdkState === 'ready'   ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
    sdkState === 'loading' ? 'bg-amber-950  text-amber-400  border-amber-800'  :
    sdkState === 'error'   ? 'bg-rose-950   text-rose-400   border-rose-800'   :
                             'bg-[#2a2a2a]  text-[#888888]  border-[#444444]';

  return (
    <main className="min-h-screen bg-[#121212] text-[#E0E0E0]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#1a1a1a] border-b border-[#444444] px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-[#888888] hover:text-[#E0E0E0] text-xs mb-1 inline-block transition-colors"
            >
              &larr; Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-[#E0E0E0]">On-site Campaign Preview</h1>
            <p className="text-[#B0B0B0] text-sm mt-0.5">
              MoEngage Web SDK &mdash; OSM event trigger &amp; debug panel
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sdkBadgeClass}`}>
            SDK: {sdkState}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* ── Status cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard label="window.Moengage" value={sdkExists ? 'Exists' : 'Not found'} ok={sdkExists} />
          <StatusCard label="SDK type"        value={sdkIsReal ? 'Real SDK' : 'Stub / loading'} ok={sdkIsReal} />
          <StatusCard
            label="App ID"
            value={MOE_APP_ID ? `...${MOE_APP_ID.slice(-6)}` : 'Not set'}
            ok={!!MOE_APP_ID}
          />
          <StatusCard label="Events fired" value={String(eventsFired.length)} ok={eventsFired.length > 0} />
        </div>

        {/* ── No app ID warning ──────────────────────────────────────────── */}
        {!MOE_APP_ID && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-sm text-amber-300">
            <strong className="block mb-1">NEXT_PUBLIC_MOENGAGE_APP_ID is not set</strong>
            Add the following to <code className="text-amber-200">.env.local</code> and restart the
            dev server:
            <pre className="mt-2 bg-[#1a1a1a] rounded p-3 text-xs font-mono overflow-x-auto">
              NEXT_PUBLIC_MOENGAGE_APP_ID=your_moengage_app_id_here
            </pre>
          </div>
        )}

        {/* ── Network hints ──────────────────────────────────────────────── */}
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
          <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
            Network &amp; SDK hints
          </h2>
          <ul className="text-xs text-[#B0B0B0] space-y-1.5 list-disc list-inside">
            <li>
              DevTools &rarr; Network, filter by{' '}
              <code className="text-violet-400">moengage</code> to watch SDK load + event
              POSTs
            </li>
            <li>
              DevTools &rarr; Console for{' '}
              <code className="text-violet-400">[OSM Debug]</code> entries and MoEngage&apos;s
              own verbose logs (<code className="text-violet-400">debug_logs: 1</code>)
            </li>
            <li>
              MoEngage SDK sends events to{' '}
              <code className="text-violet-400">https://sdk-03.moengage.com</code> (DC_3 &mdash;
              adjust <code className="text-violet-400">MOE_CLUSTER</code> if your account is on
              a different DC)
            </li>
            <li>
              On-site campaigns are <strong>injected into the DOM by the SDK</strong> &mdash;
              after firing events, check for new elements added to{' '}
              <code className="text-violet-400">&lt;body&gt;</code>
            </li>
            <li>
              If SDK type shows &quot;Stub&quot;, the CDN script is still booting. Wait a
              moment then click <em>Fire Manual Debug Event</em>.
            </li>
          </ul>
        </div>

        {/* ── Manual trigger ─────────────────────────────────────────────── */}
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
          <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-2">
            Manual event trigger
          </h2>
          <p className="text-xs text-[#888888] mb-3">
            Fires a <code className="text-violet-400">track_event</code> call directly.
            MoEngage evaluates OSM campaign rules on each event — use this to force a
            re-evaluation after the SDK has fully loaded.
          </p>
          <button
            onClick={fireManualEvent}
            disabled={sdkState !== 'ready'}
            className="px-4 py-2 bg-violet-800 hover:bg-violet-700 disabled:bg-[#2a2a2a] disabled:text-[#555555] text-white text-sm rounded-lg transition-colors font-medium"
          >
            Fire Manual Debug Event
          </button>
        </div>

        {/* ── Events fired ───────────────────────────────────────────────── */}
        {eventsFired.length > 0 && (
          <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
            <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-2">
              Events fired this session
            </h2>
            <div className="flex flex-wrap gap-2">
              {eventsFired.map((ev, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800"
                >
                  {ev}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Debug log console ──────────────────────────────────────────── */}
        <div className="bg-[#0d0d0d] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <div className="px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between bg-[#111111]">
            <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
              Debug log
            </h2>
            <span className="text-xs text-[#555555]">{logs.length} entries</span>
          </div>
          <div className="p-4 font-mono text-xs space-y-1 max-h-72 overflow-y-auto">
            {logs.length === 0 && (
              <p className="text-[#555555]">Initialising&hellip;</p>
            )}
            {logs.map((l, i) => (
              <div
                key={i}
                className={
                  l.level === 'error' ? 'text-rose-400'   :
                  l.level === 'warn'  ? 'text-amber-400'  :
                                        'text-emerald-400'
                }
              >
                <span className="text-[#444444] mr-2 select-none">{l.time}</span>
                {l.msg}
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}

// ── StatusCard sub-component ────────────────────────────────────────────────
function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
      <p className="text-[#888888] text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-semibold ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
        {value}
      </p>
    </div>
  );
}
