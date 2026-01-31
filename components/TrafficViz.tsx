"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Snap = {
  ts: number;
  congestionFactor: number;
  delayMinutes: number;
  band: "Free" | "Moderate" | "Heavy" | "Severe";
  currentSpeedKmh: number;
  freeFlowSpeedKmh: number;
  source: "Simulated" | "Verified";
  confidence: number;
  factors: string[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function bandMeta(b: Snap["band"]) {
  switch (b) {
    case "Free":
      return { label: "Free Flow", tone: "emerald", glow: "rgba(16,185,129,0.35)" };
    case "Moderate":
      return { label: "Moderate", tone: "amber", glow: "rgba(245,158,11,0.35)" };
    case "Heavy":
      return { label: "Heavy", tone: "orange", glow: "rgba(249,115,22,0.35)" };
    case "Severe":
    default:
      return { label: "Severe", tone: "rose", glow: "rgba(244,63,94,0.35)" };
  }
}

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 3) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

// tiny SVG sparkline (no deps)
function Sparkline({ values }: { values: number[] }) {
  const w = 210, h = 54, pad = 8;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.0001, max - min);

  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return { x, y };
  });

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const area = `${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <defs>
        <linearGradient id="sparkStroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgba(99,102,241,1)" />
          <stop offset="1" stopColor="rgba(168,85,247,1)" />
        </linearGradient>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(99,102,241,0.25)" />
          <stop offset="1" stopColor="rgba(168,85,247,0.02)" />
        </linearGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path d={area} fill="url(#sparkFill)" />
      <path d={d} fill="none" stroke="url(#sparkStroke)" strokeWidth="2.6" filter="url(#softGlow)" opacity="0.95" />
    </svg>
  );
}

function Meter({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = clamp(value / max, 0, 1);
  return (
    <div className="traf-meter">
      <div className="traf-meterTop">
        <div className="traf-meterLabel">{label}</div>
        <div className="traf-meterVal">
          {Math.round(value)}
          {suffix ?? ""}
        </div>
      </div>
      <div className="traf-meterBar">
        <div className="traf-meterFill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export default function TrafficViz({
  point,
  baseDurationMin = 60,
  pollMs = 2000,
  title = "Live Traffic Signal",
}: {
  point: string;
  baseDurationMin?: number;
  pollMs?: number;
  title?: string;
}) {
  const [history, setHistory] = useState<Snap[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Animated display value for smooth transitions
  const [displayCongestion, setDisplayCongestion] = useState(1.0);

  const latest = history[history.length - 1];
  const startedRef = useRef(false);

  // Animation frame loop for smooth interpolation
  useEffect(() => {
    let handle = 0;
    const update = () => {
      if (latest) {
        setDisplayCongestion(prev => {
          const diff = latest.congestionFactor - prev;
          if (Math.abs(diff) < 0.005) return latest.congestionFactor;
          return prev + diff * 0.08; // smooth lerp
        });
      }
      handle = requestAnimationFrame(update);
    };
    handle = requestAnimationFrame(update);
    return () => cancelAnimationFrame(handle);
  }, [latest]);

  useEffect(() => {
    // “clock” so "time ago" updates even if values similar
    const id = setInterval(() => setNowTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Primary SSE Connection
  useEffect(() => {
    if (isPollingFallback) return;

    const url = `/api/traffic/stream?point=${encodeURIComponent(point)}&baseDurationMin=${baseDurationMin}`;
    const es = new EventSource(url);
    startedRef.current = true;

    es.onopen = () => {
      // connected ok
    };

    // Listen for named 'snap' events
    es.addEventListener("snap", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.snap) {
          setHistory((prev) => [...prev, data.snap].slice(-28));
        }
      } catch (err) {
        console.error("Stream parse error", err);
      }
    });

    es.onerror = (err) => {
      console.warn("Traffic SSE failed, switching to polling fallback", err);
      es.close();
      setIsPollingFallback(true);
    };

    return () => {
      es.close();
      startedRef.current = false;
    };
  }, [point, baseDurationMin, isPollingFallback]);

  // Fallback Polling (if SSE fails)
  useEffect(() => {
    if (!isPollingFallback) return;

    startedRef.current = true;
    const fetchSnap = async () => {
      try {
        const res = await fetch(`/api/traffic/live?point=${encodeURIComponent(point)}&baseDurationMin=${baseDurationMin}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.snap) {
          setHistory((prev) => [...prev, data.snap].slice(-28));
        }
      } catch (e) {
        console.error("Polling fetch error", e);
      }
    };

    fetchSnap();
    const id = setInterval(fetchSnap, pollMs);
    return () => clearInterval(id);
  }, [isPollingFallback, point, baseDurationMin, pollMs]);

  // Reset history when point/config changes
  useEffect(() => {
    setHistory([]);
    setIsPollingFallback(false);
  }, [point, baseDurationMin]);

  const series = useMemo(() => {
    const vals = history.map((h) => h.congestionFactor);
    return vals.length ? vals : [1.08, 1.12, 1.10, 1.18, 1.14, 1.16];
  }, [history]);

  const meta = latest ? bandMeta(latest.band) : bandMeta("Moderate");

  // “real-time feel”: animate slight shimmer until first data arrives
  const connecting = !startedRef.current || !latest;

  const modeLabel = latest?.source === "Verified" ? "Verified" : "Simulated";
  const modeSub = latest?.source === "Verified" ? "Real provider" : "telemetry";

  const confPct = latest ? Math.round(latest.confidence * 100) : 0;

  return (
    <div className="traf-wrap" style={{ ["--trafGlow" as any]: meta.glow }}>
      <div className={`traf-card ${connecting ? "traf-cardLoading" : ""}`}>
        <div className="traf-head">
          <div>
            <div className="traf-title">{title}</div>
            <div className="traf-sub">
              <span className="traf-dotWrap">
                <span className="traf-dot" />
                <span className="traf-live">LIVE</span>
              </span>
              <span className="traf-sep">•</span>
              <span className="traf-muted">Point: {point}</span>
              <span className="traf-sep">•</span>
              <span className="traf-muted">Updated {latest && isMounted ? timeAgo(latest.ts) : "…"}</span>
            </div>
          </div>

          <div className="traf-badges">
            <span className="traf-pill traf-pillMode">
              {modeLabel}
              <span className="traf-pillSub">{modeSub}</span>
            </span>
            <span className={`traf-pill traf-pillBand traf-tone-${meta.tone}`}>
              {meta.label}
              <span className="traf-pillSub">{latest ? `${latest.congestionFactor.toFixed(2)}x congestion` : "…"}</span>
            </span>
          </div>
        </div>

        <div className="traf-grid">
          <div className="traf-hero">
            <div className="traf-heroTop">
              <div className="traf-big">
                {latest ? displayCongestion.toFixed(2) : "—"}x
              </div>
              <div className="traf-bigSub">Congestion multiplier</div>
            </div>

            <div className="traf-spark">
              <Sparkline values={series} />
            </div>

            <div className="traf-miniRow">
              <div className="traf-mini">
                <div className="traf-miniLabel">Delay</div>
                <div className="traf-miniVal">{latest ? `${latest.delayMinutes} min` : "—"}</div>
              </div>
              <div className="traf-mini">
                <div className="traf-miniLabel">Speed</div>
                <div className="traf-miniVal">{latest ? `${latest.currentSpeedKmh} km/h` : "—"}</div>
              </div>
              <div className="traf-mini">
                <div className="traf-miniLabel">Free Flow</div>
                <div className="traf-miniVal">{latest ? `${latest.freeFlowSpeedKmh} km/h` : "—"}</div>
              </div>
            </div>
          </div>

          <div className="traf-side">
            <div className="traf-sideCard">
              <div className="traf-sideTitle">Signal Breakdown</div>
              <div className="traf-sideSub">Telemetry summary used for route decisions</div>

              <Meter label="Traffic confidence" value={confPct} max={100} suffix="%" />
              <Meter
                label="Speed utilization"
                value={latest ? latest.currentSpeedKmh : 0}
                max={latest ? latest.freeFlowSpeedKmh || 100 : 100}
                suffix=" km/h"
              />
              <Meter label="Delay pressure" value={latest ? latest.delayMinutes : 0} max={Math.max(10, baseDurationMin)} suffix=" min" />

              <div className="traf-factors">
                {(latest?.factors?.length ? latest.factors : ["Connecting to signal…"]).slice(0, 4).map((f, idx) => (
                  <div key={idx} className="traf-chip">
                    {f}
                  </div>
                ))}
              </div>

              <div className="traf-foot">
                <div className="traf-footLeft">
                  <span className="traf-footDot" />
                  <span>Stream: {isPollingFallback ? `${Math.round(pollMs / 1000)}s poll` : "SSE Active"}</span>
                </div>
                <div className="traf-footRight">
                  <span className="traf-muted">Mode:</span> <b>{typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_TRAFFIC_MODE ?? "live") : "live"}</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        {connecting ? <div className="traf-shimmer" /> : null}
      </div>

      <style jsx>{`
        .traf-wrap {
          --bg: rgba(255, 255, 255, 0.06);
          --bg2: rgba(255, 255, 255, 0.04);
          --stroke: rgba(255, 255, 255, 0.12);
          --stroke2: rgba(255, 255, 255, 0.18);
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.62);
          --shadow: 0 18px 60px rgba(0,0,0,0.35);
          --radius: 22px;
        }

        .traf-card {
          position: relative;
          border-radius: var(--radius);
          border: 1px solid var(--stroke);
          background:
            radial-gradient(700px 240px at 14% 12%, rgba(99,102,241,0.22), transparent 60%),
            radial-gradient(560px 240px at 92% 10%, rgba(168,85,247,0.18), transparent 60%),
            linear-gradient(180deg, var(--bg), var(--bg2));
          box-shadow: var(--shadow);
          overflow: hidden;
          color: var(--text);
          backdrop-filter: blur(16px);
        }

        .traf-card:before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: var(--radius);
          pointer-events: none;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(0,0,0,0.2);
        }

        .traf-cardLoading {
          filter: saturate(1.05);
        }

        .traf-head {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 18px 12px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .traf-title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .traf-sub {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          font-size: 12px;
          color: var(--muted);
          flex-wrap: wrap;
        }

        .traf-dotWrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.20);
        }

        .traf-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(34,197,94,1);
          box-shadow: 0 0 0 0 rgba(34,197,94,0.55);
          animation: pulse 1.35s ease-out infinite;
        }

        .traf-live {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.7px;
          color: rgba(255,255,255,0.88);
        }

        .traf-sep {
          opacity: 0.5;
        }

        .traf-muted {
          color: var(--muted);
        }

        .traf-badges {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .traf-pill {
          display: inline-flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 10px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.18);
          min-width: 150px;
        }

        .traf-pillSub {
          font-size: 11px;
          color: rgba(255,255,255,0.68);
        }

        .traf-pillMode {
          min-width: 170px;
        }

        .traf-pillBand {
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.06) inset;
        }

        .traf-tone-emerald { box-shadow: 0 0 0 1px rgba(16,185,129,0.16) inset, 0 0 0 1px rgba(255,255,255,0.06); }
        .traf-tone-amber   { box-shadow: 0 0 0 1px rgba(245,158,11,0.16) inset, 0 0 0 1px rgba(255,255,255,0.06); }
        .traf-tone-orange  { box-shadow: 0 0 0 1px rgba(249,115,22,0.16) inset, 0 0 0 1px rgba(255,255,255,0.06); }
        .traf-tone-rose    { box-shadow: 0 0 0 1px rgba(244,63,94,0.16) inset, 0 0 0 1px rgba(255,255,255,0.06); }

        .traf-grid {
          display: grid;
          grid-template-columns: 1.35fr 0.95fr;
          gap: 14px;
          padding: 14px 18px 18px 18px;
        }

        .traf-hero {
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.14);
          padding: 14px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.05) inset;
          position: relative;
        }

        .traf-hero:after {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 18px;
          pointer-events: none;
          box-shadow: 0 0 55px var(--trafGlow);
          opacity: 0.30;
        }

        .traf-heroTop {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .traf-big {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -0.6px;
          line-height: 1;
          transition: transform 220ms ease;
        }

        .traf-bigSub {
          font-size: 12px;
          color: rgba(255,255,255,0.65);
          margin-top: 6px;
        }

        .traf-spark {
          margin-top: 10px;
          display: flex;
          justify-content: flex-end;
          color: rgba(255,255,255,0.86);
        }

        .traf-miniRow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 10px;
        }

        .traf-mini {
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          padding: 10px;
        }

        .traf-miniLabel {
          font-size: 11px;
          color: rgba(255,255,255,0.62);
        }

        .traf-miniVal {
          font-size: 16px;
          font-weight: 700;
          margin-top: 6px;
          transition: all 240ms ease;
        }

        .traf-sideCard {
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.14);
          padding: 14px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.05) inset;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .traf-sideTitle {
          font-size: 13px;
          font-weight: 800;
        }

        .traf-sideSub {
          margin-top: 6px;
          font-size: 12px;
          color: rgba(255,255,255,0.62);
        }

        .traf-meter {
          margin-top: 12px;
        }

        .traf-meterTop {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }

        .traf-meterLabel {
          font-size: 11px;
          color: rgba(255,255,255,0.62);
        }

        .traf-meterVal {
          font-size: 12px;
          font-weight: 800;
        }

        .traf-meterBar {
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          overflow: hidden;
          margin-top: 8px;
        }

        .traf-meterFill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(99,102,241,0.95), rgba(168,85,247,0.95));
          box-shadow: 0 0 18px rgba(99,102,241,0.35);
          transition: width 420ms ease;
        }

        .traf-factors {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .traf-chip {
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.78);
        }

        .traf-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 11px;
          color: rgba(255,255,255,0.62);
        }

        .traf-footLeft {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .traf-footDot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(99,102,241,1);
          box-shadow: 0 0 14px rgba(99,102,241,0.55);
        }

        .traf-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.06) 35%, transparent 70%);
          transform: translateX(-40%);
          animation: shimmer 1.2s linear infinite;
          pointer-events: none;
          opacity: 0.55;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
          70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }

        @keyframes shimmer {
          0% { transform: translateX(-40%); }
          100% { transform: translateX(40%); }
        }

        @media (max-width: 980px) {
          .traf-grid { grid-template-columns: 1fr; }
          .traf-badges { justify-content: flex-start; }
          .traf-pill { min-width: unset; width: 100%; }
        }
      `}</style>
    </div>
  );
}
