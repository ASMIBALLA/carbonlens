"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import RecommendationPanel from "@/components/RecommendationPanel";

type TrafficResp = {
  ok: boolean;
  point: string;
  snapshot: {
    ts: number;
    congestionFactor: number;
    delayMinutes: number;
    currentSpeedKmh: number;
    freeFlowSpeedKmh: number;
    band: "Free" | "Moderate" | "Heavy" | "Severe";
    source: "Simulated" | "Verified";
    confidence: number;
    factors: string[];
  };
};

export default function Dashboard() {
  const trafficPoint = "52.5200,13.4050"; // demo: Berlin
  const [traffic, setTraffic] = useState<TrafficResp | null>(null);
  const [spark, setSpark] = useState<number[]>([]);
  const [loadingRecos, setLoadingRecos] = useState(false);
  const [recoErr, setRecoErr] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Poll traffic (fast)
  useEffect(() => {
    let timer: any;

    const tick = async () => {
      try {
        const res = await fetch(`/api/traffic/demo?point=${encodeURIComponent(trafficPoint)}&base=60`, {
          cache: "no-store",
        });
        const json = (await res.json()) as TrafficResp;
        if (!aliveRef.current) return;

        if (json?.ok) {
          setTraffic(json);
          setSpark((prev) => {
            const next = [...prev, json.snapshot.congestionFactor];
            return next.slice(-40);
          });
        }
      } catch {
        // ignore (demo)
      } finally {
        if (aliveRef.current) timer = setTimeout(tick, 2500);
      }
    };

    tick();
    return () => clearTimeout(timer);
  }, [trafficPoint]);

  // Poll recommendations (slower)
  useEffect(() => {
    let timer: any;

    const tick = async () => {
      setLoadingRecos(true);
      setRecoErr(null);
      try {
        const res = await fetch("/api/optimize/demo", { cache: "no-store" });
        const json = await res.json();
        if (!aliveRef.current) return;

        if (json?.ok) setAlerts(json.results || []);
        else setRecoErr(json?.error || "Optimize API failed");
      } catch (e: any) {
        if (!aliveRef.current) return;
        setRecoErr(e?.message || "Optimize fetch failed");
      } finally {
        if (!aliveRef.current) return;
        setLoadingRecos(false);
        timer = setTimeout(tick, 6000);
      }
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  const trafficUI = useMemo(() => {
    if (!traffic?.ok) return null;

    const s = traffic.snapshot;
    const pct = Math.round(s.confidence * 100);

    const bandPill =
      s.band === "Free"
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : s.band === "Moderate"
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : s.band === "Heavy"
        ? "bg-orange-100 text-orange-800 border-orange-200"
        : "bg-red-100 text-red-800 border-red-200";

    return (
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Real-Time Traffic Signal (Demo Mode)</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">Traffic Telemetry</div>
            <div className="mt-1 text-sm text-slate-600">
              Point: <span className="font-mono">{traffic.point}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {s.source}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${bandPill}`}>
              {s.band}
            </span>
            <span className="rounded-full border bg-slate-100 px-3 py-1 text-xs text-slate-700">
              Confidence: {pct}%
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KPI label="Congestion" value={`${s.congestionFactor.toFixed(2)}×`} sub="Multiplier" />
          <KPI label="Delay" value={`${s.delayMinutes} min`} sub="Estimated" />
          <KPI label="Speed" value={`${s.currentSpeedKmh} km/h`} sub={`Free-flow ${s.freeFlowSpeedKmh} km/h`} />
        </div>

        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Live Signal Trace</div>
            <div className="text-xs text-slate-600">Auto-updates ~2.5s</div>
          </div>
          <div className="mt-3">
            <Sparkline values={spark} />
          </div>
        </div>

        {s.factors?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {s.factors.slice(0, 6).map((f, i) => (
              <span key={i} className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                {f}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }, [traffic, spark]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">CarbonLens — Traffic + Optimization</h1>
        <p className="text-slate-600">
          Live traffic signals adjust route emissions in real-time, then the optimizer recommends the lowest-impact option.
        </p>
      </header>

      {trafficUI}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Autonomous Recommendations</h2>
          <div className="text-xs text-slate-600">
            {loadingRecos ? "Refreshing…" : "Auto-refresh ~6s"}
          </div>
        </div>

        {recoErr ? (
          <div className="rounded-2xl border bg-red-50 p-4 text-sm text-red-800">
            {recoErr}
          </div>
        ) : null}

        <RecommendationPanel alerts={alerts} />
      </section>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 520;
  const h = 120;
  const pad = 10;

  if (!values?.length) {
    return (
      <div className="h-[120px] rounded-xl bg-white border flex items-center justify-center text-xs text-slate-500">
        Waiting for signal…
      </div>
    );
  }

  const min = Math.min(...values, 1.0);
  const max = Math.max(...values, 1.0);
  const span = Math.max(0.0001, max - min);

  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-label="Traffic sparkline">
        <polyline fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="3" points={pts.join(" ")} />
        <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="currentColor" strokeOpacity="0.08" />
      </svg>
    </div>
  );
}
