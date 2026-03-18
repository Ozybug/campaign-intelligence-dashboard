"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Config — set NEXT_PUBLIC_MOENGAGE_APP_ID in .env.local
// ---------------------------------------------------------------------------
const MOE_APP_ID  = process.env.NEXT_PUBLIC_MOENGAGE_APP_ID || '';
const MOE_CLUSTER = 'DC_3'; // matches MOENGAGE_BASE_URL = api-03.moengage.com
const TEST_USER_ID = '6929831c5c49df1a62b12f5e';

// Polling: check every 200 ms for up to 5 s for the real SDK to replace stub.
const POLL_INTERVAL_MS  = 200;
const POLL_MAX_ATTEMPTS = 25;

// Full list of stub methods — must include add_unique_user_id.
const MOE_STUB_METHODS = [
  'track_event', 'add_unique_user_attribute', 'add_user_attribute',
  'add_user_to_group', 'remove_user_attribute', 'remove_user_from_group',
  'destroy_session', 'add_first_name', 'add_last_name', 'add_email',
  'add_mobile', 'add_user_name', 'add_gender', 'add_birthday',
  'moe_events', 'call_web_push', 'track', 'location_type_attribute',
  'add_unique_user_id',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Phase drives the sequential init flow:
//   idle -> loading -> polling -> ready -> identified -> done
//                                                     -> error (any phase)
type Phase    = 'idle' | 'loading' | 'polling' | 'ready' | 'identified' | 'done' | 'error';
type LogLevel = 'info' | 'warn' | 'error';
interface LogEntry { time: string; level: LogLevel; msg: string; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMoeReal(): boolean {
  if (typeof window === 'undefined') return false;
  const moe = (window as any).Moengage;
  if (!moe || typeof moe.track_event !== 'function') return false;
  // MoEngage SDK modifies the stub array IN-PLACE — it never replaces window.Moengage
  // with a non-array object. The reliable signal that the real SDK is live is the
  // presence of 'landingPages', a method only the real SDK adds (not in our stub).
  return 'landingPages' in moe;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnsiteViewer() {
  const [phase, setPhase]               = useState<Phase>('idle');
  const [sdkExists, setSdkExists]       = useState(false);
  const [sdkIsReal, setSdkIsReal]       = useState(false);
  const [userIdentified, setUserIdentified] = useState(false);
  const [eventsFired, setEventsFired]   = useState<string[]>([]);
  const [logs, setLogs]                 = useState<LogEntry[]>([]);
  const [customEventName, setCustomEventName] = useState('Manual Debug Event');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Logging ───────────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, level: LogLevel = 'info') => {
    const entry: LogEntry = { time: new Date().toLocaleTimeString(), level, msg };
    if (level === 'error') console.error(`[OSM Debug] ${msg}`);
    else if (level === 'warn') console.warn(`[OSM Debug] ${msg}`);
    else console.log(`[OSM Debug] ${msg}`);
    setLogs(prev => [...prev, entry]);
  }, []);

  // ── Cleanup poll on unmount ───────────────────────────────────────────────
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Step 1: SDK init (idle -> loading) ────────────────────────────────────
  useEffect(() => {
    if (!MOE_APP_ID) {
      addLog(
        'NEXT_PUBLIC_MOENGAGE_APP_ID is not set — cannot initialise SDK. ' +
        'Add it to .env.local and restart.',
        'warn',
      );
      setPhase('error');
      return;
    }

    const w = window as any;

    // Hot-reload fast-path: real SDK already present from a previous page load.
    // The user ID + events were pre-queued and processed by the SDK on that load.
    if (isMoeReal()) {
      addLog('[OK] window.Moengage already present (hot-reload). Pre-queued calls were processed on last init.');
      setSdkExists(true);
      setSdkIsReal(true);
      setUserIdentified(true);
      setEventsFired(['Page View', 'OSM Debug View']);
      setPhase('done');
      return;
    }

    addLog(`[INIT] Starting MoEngage SDK — app_id=${MOE_APP_ID}, cluster=${MOE_CLUSTER}`);
    setPhase('loading');

    // Build stub queue (mirrors the official snippet).
    const stub: any = (w.Moengage = w.Moengage || []);
    stub.invoked = 0;
    stub.methods = MOE_STUB_METHODS;
    stub.factory = (method: string) =>
      (...args: any[]) => { stub.push([method, ...args]); return stub; };

    if (!stub.initialized) {
      stub.initialized = true;
      for (const m of MOE_STUB_METHODS) stub[m] = stub.factory(m);

      stub['sortableData'] = {
        app_id:     MOE_APP_ID,
        cluster:    MOE_CLUSTER,
        debug_logs: 1,          // enables MoEngage's own verbose console output
        swPath:     '/serviceworker.js',
        enableSPA:  true,       // required for Next.js SPA routing
      };

      // ── CRITICAL: pre-queue BEFORE injecting the CDN script ─────────────
      // MoEngage SDK reads + processes the stub array exactly ONCE, at init.
      // Pushing via stub methods AFTER the SDK loads is silently ignored —
      // the SDK has already drained the queue and push() is native (not intercepted).
      // Solution: queue user identification and page-view events here so the
      // SDK sees them as soon as it executes.
      stub.add_unique_user_id(TEST_USER_ID);
      stub.track_event('Page View', {
        page:    '/onsite',
        title:   'On-site Campaign Preview',
        source:  'campaign-intelligence-dashboard',
        user_id: TEST_USER_ID,
      });
      stub.track_event('OSM Debug View', {
        triggered_by: 'dashboard_button',
        user_id:      TEST_USER_ID,
        timestamp:    new Date().toISOString(),
      });

      addLog(`[INIT] Pre-queued: add_unique_user_id("${TEST_USER_ID}") + Page View + OSM Debug View — injecting CDN script…`);
      setSdkExists(true);

      const script   = document.createElement('script');
      script.id      = 'moengage-web-sdk';
      script.async   = true;
      script.src     =
        `https://cdn.moengage.com/webpush/moe_webSdk.min.latest.js` +
        `?q=${Math.ceil(Date.now() / 86400000) * 86400000}`;

      script.onload = () => {
        addLog('[INIT] CDN script loaded. Polling for real SDK to replace stub…');
        setPhase('polling');
      };
      script.onerror = () => {
        addLog('[ERROR] Failed to load MoEngage CDN script. Check network.', 'error');
        setPhase('error');
      };

      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(script, first);
    }
  }, [addLog]);

  // ── Step 2: Poll until real SDK replaces stub (polling -> ready) ──────────
  useEffect(() => {
    if (phase !== 'polling') return;

    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts++;
      if (isMoeReal()) {
        clearInterval(pollRef.current!);
        addLog(
          `[OK] Real SDK detected after ${attempts} poll(s) ` +
          `(~${attempts * POLL_INTERVAL_MS}ms). window.Moengage is now a real object.`,
        );
        setSdkIsReal(true);
        setPhase('ready');
      } else if (attempts >= POLL_MAX_ATTEMPTS) {
        clearInterval(pollRef.current!);
        addLog(
          `[WARN] SDK still a stub after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS}ms. ` +
          `OSM campaigns may not display. ` +
          `Check DevTools → Network for the moe_webSdk request.`,
          'warn',
        );
        setPhase('error');
      }
    }, POLL_INTERVAL_MS);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, addLog]);

  // ── Step 3: Mark user identified (ready -> identified) ───────────────────
  // add_unique_user_id was pre-queued in Step 1 and processed by the SDK on init.
  // Do NOT call it again here — the stub factory only pushes to a queue the SDK
  // has already drained; the call would be silently discarded.
  useEffect(() => {
    if (phase !== 'ready') return;
    addLog(`[OK] SDK ready — user "${TEST_USER_ID}" was pre-queued and identified by SDK on init`);
    setUserIdentified(true);
    setPhase('identified');
  }, [phase, addLog]);

  // ── Step 4: Mark events fired (identified -> done) ────────────────────────
  // Page View + OSM Debug View were pre-queued in Step 1 and sent by the SDK on init.
  // Do NOT re-fire here — stub track_event after init pushes to an already-drained
  // queue and the calls never reach sdk-03.moengage.com.
  useEffect(() => {
    if (phase !== 'identified') return;
    addLog('[OK] Pre-queued events (Page View, OSM Debug View) processed by SDK on init — watching for OSM campaigns in DOM…');
    setEventsFired(['Page View', 'OSM Debug View']);
    setPhase('done');
  }, [phase, addLog]);

  // ── Manual event trigger ──────────────────────────────────────────────────
  // NOTE: Firing events after the SDK has initialised pushes to the stub queue
  // but the SDK only drains the queue once on init (push() is never intercepted).
  // These events won't reach sdk-03.moengage.com from this page.
  // To re-trigger OSM campaign evaluation, reload the page — the pre-queued
  // calls in Step 1 will be processed fresh by the SDK on every clean page load.
  const fireManualEvent = () => {
    if (!isMoeReal()) {
      addLog(`[WARN] Cannot fire event — SDK not ready (phase: ${phase})`, 'warn');
      return;
    }
    const name = customEventName.trim() || 'Manual Debug Event';
    const moe  = (window as any).Moengage;
    try {
      moe.track_event(name, { manual: true, user_id: TEST_USER_ID, ts: Date.now() });
      addLog(`[NOTE] track_event("${name}") queued — to reach MoEngage servers, reload the page (SDK processes queue only on init)`);
      setEventsFired(prev => [...prev, name]);
    } catch (e: any) {
      addLog(`[ERROR] track_event("${name}") threw: ${e.message}`, 'error');
    }
  };

  // ── Derived UI values ─────────────────────────────────────────────────────

  // Flow steps use explicit boolean flags — NOT phaseOrder — so that jumping to
  // 'error' from any early phase does not incorrectly mark later steps as done.
  const flowSteps: [Phase, string, boolean][] = [
    ['loading',    'Stub + script inject', sdkExists],
    ['polling',    'Poll for real SDK',    sdkIsReal],
    ['ready',      'SDK ready',            userIdentified],
    ['identified', 'User identified',      eventsFired.length > 0],
    ['done',       'Events fired',         phase === 'done'],
  ];

  const phaseBadge: Record<Phase, string> = {
    idle:       'bg-[#2a2a2a]  text-[#888888]  border-[#444444]',
    loading:    'bg-amber-950  text-amber-400  border-amber-800',
    polling:    'bg-amber-950  text-amber-400  border-amber-800',
    ready:      'bg-sky-950    text-sky-400    border-sky-800',
    identified: 'bg-sky-950    text-sky-400    border-sky-800',
    done:       'bg-emerald-950 text-emerald-400 border-emerald-800',
    error:      'bg-rose-950   text-rose-400   border-rose-800',
  };

  const phaseLabel: Record<Phase, string> = {
    idle:       'idle',
    loading:    'loading…',
    polling:    'polling…',
    ready:      'SDK ready',
    identified: 'user set',
    done:       'done',
    error:      'error',
  };

  const canFireManual = phase === 'identified' || phase === 'done';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#121212] text-[#E0E0E0]">

      {/* ── Header ────────────────────────────────────────────────────────── */}
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
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${phaseBadge[phase]}`}>
            {phaseLabel[phase]}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* ── Status cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatusCard label="window.Moengage"  value={sdkExists ? 'Present'  : 'Not found'}         ok={sdkExists} />
          <StatusCard label="SDK type"         value={sdkIsReal ? 'Real SDK' : 'Stub / loading'}     ok={sdkIsReal} />
          <StatusCard label="User ID"          value={userIdentified ? TEST_USER_ID : 'Not set'}     ok={userIdentified} />
          <StatusCard label="App ID"           value={MOE_APP_ID ? `...${MOE_APP_ID.slice(-6)}` : 'Not set'} ok={!!MOE_APP_ID} />
          <StatusCard label="Events fired"     value={String(eventsFired.length)}                    ok={eventsFired.length > 0} />
        </div>

        {/* ── Missing app ID warning ────────────────────────────────────────── */}
        {!MOE_APP_ID && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl p-4 text-sm text-amber-300">
            <strong className="block mb-1">NEXT_PUBLIC_MOENGAGE_APP_ID is not set</strong>
            Add this to <code className="text-amber-200">.env.local</code> and restart:
            <pre className="mt-2 bg-[#111] rounded p-3 text-xs font-mono overflow-x-auto">
              NEXT_PUBLIC_MOENGAGE_APP_ID=your_moengage_app_id_here
            </pre>
          </div>
        )}

        {/* ── Init flow progress ────────────────────────────────────────────── */}
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
          <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
            Initialisation flow
          </h2>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {flowSteps.map(([p, label, isDone], i, arr) => {
              const isCurrent = phase === p;
              return (
                <span key={p} className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full border font-medium ${
                    isDone    ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                    isCurrent ? 'bg-sky-950 text-sky-400 border-sky-800' :
                    phase === 'error' && p === 'loading' && !sdkExists
                              ? 'bg-rose-950 text-rose-400 border-rose-800' :
                                'bg-[#2a2a2a] text-[#555555] border-[#333333]'
                  }`}>
                    {isDone ? '✓ ' : ''}{label}
                  </span>
                  {i < arr.length - 1 && <span className="text-[#444444]">&rarr;</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Network hints ─────────────────────────────────────────────────── */}
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
          <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
            Network &amp; SDK hints
          </h2>
          <ul className="text-xs text-[#B0B0B0] space-y-1.5 list-disc list-inside">
            <li>DevTools &rarr; Network — filter <code className="text-violet-400">moengage</code> to watch SDK load and event POSTs</li>
            <li>DevTools &rarr; Console — <code className="text-violet-400">[OSM Debug]</code> entries + MoEngage verbose logs (<code className="text-violet-400">debug_logs: 1</code>)</li>
            <li>SDK sends events to <code className="text-violet-400">https://sdk-03.moengage.com</code> (DC_3)</li>
            <li>OSM campaigns are injected into <code className="text-violet-400">&lt;body&gt;</code> by the SDK after event evaluation</li>
            <li>If stuck in &quot;polling&quot;, check Network for a failed <code className="text-violet-400">moe_webSdk</code> request</li>
          </ul>
        </div>

        {/* ── Manual trigger ────────────────────────────────────────────────── */}
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
          <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-2">
            Manual event trigger
          </h2>
          <p className="text-xs text-[#888888] mb-3">
            Fires a custom <code className="text-violet-400">track_event</code> call with user ID attached.
            Use to force OSM campaign re-evaluation after SDK is fully loaded.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={customEventName}
              onChange={e => setCustomEventName(e.target.value)}
              placeholder="Event name"
              className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-[#444444] rounded-lg text-sm text-[#E0E0E0] placeholder-[#555555] focus:outline-none focus:border-violet-600"
            />
            <button
              onClick={fireManualEvent}
              disabled={!canFireManual}
              className="px-4 py-2 bg-violet-800 hover:bg-violet-700 disabled:bg-[#2a2a2a] disabled:text-[#555555] text-white text-sm rounded-lg transition-colors font-medium whitespace-nowrap"
            >
              Fire Event
            </button>
          </div>
          {!canFireManual && phase !== 'error' && (
            <p className="text-xs text-[#666666] mt-2">
              Waiting for SDK init and user identification to complete&hellip;
            </p>
          )}
        </div>

        {/* ── Events fired list ─────────────────────────────────────────────── */}
        {eventsFired.length > 0 && (
          <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#444444]">
            <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-2">
              Events fired this session
            </h2>
            <div className="flex flex-wrap gap-2">
              {eventsFired.map((ev, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {ev}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Debug log ─────────────────────────────────────────────────────── */}
        <div className="bg-[#0d0d0d] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <div className="px-4 py-2 border-b border-[#2a2a2a] flex items-center justify-between bg-[#111111]">
            <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Debug log</h2>
            <span className="text-xs text-[#555555]">{logs.length} entries</span>
          </div>
          <div className="p-4 font-mono text-xs space-y-1 max-h-80 overflow-y-auto">
            {logs.length === 0 && <p className="text-[#555555]">Initialising&hellip;</p>}
            {logs.map((l, i) => (
              <div key={i} className={
                l.level === 'error' ? 'text-rose-400' :
                l.level === 'warn'  ? 'text-amber-400' :
                                      'text-emerald-400'
              }>
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function phaseOrder(p: Phase): number {
  // 'error' is -1 so it never marks any flow step as "done" via ordering.
  // Flow completion is driven by boolean state flags (flowSteps), not this fn.
  return { idle: 0, loading: 1, polling: 2, ready: 3, identified: 4, done: 5, error: -1 }[p] ?? 0;
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="bg-[#1e1e1e] rounded-xl p-3 border border-[#444444]">
      <p className="text-[#888888] text-xs uppercase tracking-wide mb-1 truncate">{label}</p>
      <p className={`text-xs font-semibold truncate ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
        {value}
      </p>
    </div>
  );
}
