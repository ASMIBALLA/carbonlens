"use client";

import React from "react";
import type { RouteOptimizationResult } from "@/lib/optimization/routeOptimizer";
import dynamic from "next/dynamic";

// Import the map dynamically (Leaflet doesn't work with SSR)
const CarbonTrafficMap = dynamic(() => import("./CarbonTrafficMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center">
      <div className="text-slate-400">Loading map...</div>
    </div>
  ),
});

export default function RecommendationPanel({ alerts, markers, networkRoutes }: { alerts: RouteOptimizationResult[], markers?: any[], networkRoutes?: any[] }) {
  if (!alerts?.length) return null;

  // Convert API alerts to map-friendly format
  const activeAlert = alerts[0];

  return (
    <div className="space-y-6">
      {/* Carbon Traffic Map - Wired to live alert route path */}
      {alerts[0] ? (
        <CarbonTrafficMap
          markers={markers}
          incidents={alerts[0].incidents}
          networkRoutes={networkRoutes}
          routes={[
            // Primary Route
            {
              id: "live-optimized",
              name: "Recommended",
              kind: "primary",
              segments: [{
                id: "seg-live",
                path: alerts[0].recommendedRoute.path || [],
                band: (alerts[0].recommendedRoute.traffic?.band || "Moderate") as any,
                multiplier: alerts[0].recommendedRoute.traffic?.congestionFactor || 1,
                confidence: alerts[0].recommendedRoute.traffic?.confidence || 0.9,
                baseEmissions: 10,
                adjustedEmissions: alerts[0].recommendedRoute.adjustedEmission || 10,
                deltaEmissions: 0
              }]
            },
            // Alternative Routes
            ...(alerts[0].alternativeRoutes?.map((alt: any, idx: number) => ({
              id: `alt-${idx}`,
              name: `Alt Route ${idx + 1}`,
              kind: "alt" as const,
              segments: [{
                id: `seg-alt-${idx}`,
                path: alt.path || [],
                band: "Moderate" as any,
                multiplier: 1.1,
                confidence: 0.8,
                baseEmissions: 10,
                adjustedEmissions: alt.adjustedEmission || 12,
                deltaEmissions: 2
              }]
            })) || [])
          ]}
          activeRouteId="live-optimized"
        />
      ) : (
        <CarbonTrafficMap />
      )}

      <div className="space-y-6">
        {alerts.map((a) => (
          <div
            key={a.supplier.id}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-2xl transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_50px_-15px_rgba(16,185,129,0.15)] hover:-translate-y-1"
          >
            {/* Subtle top glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

            {/* Header Section */}
            <div className="relative z-10 px-8 py-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Recommendation
                    </span>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Supplier Sequence
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-white tracking-tight mb-1 group-hover:text-emerald-300 transition-colors">
                    {a.supplier.name}
                  </h3>

                  <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                    <span className="text-slate-300">{a.currentRoute.origin}</span>
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-slate-300">{a.currentRoute.destination}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <SourceBadge src={a.data_source} />
                    <ConfidenceBadge band={a.confidence_band} pct={a.confidence_pct} />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="p-8">
              {/* Recommendation Callout */}
              <div className="relative rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 p-5 mb-8">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40">
                  <svg className="w-3.5 h-3.5 text-slate-900 font-bold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-emerald-300 font-semibold text-sm mb-1 uppercase tracking-wide opacity-80">Opportunity</h4>
                <p className="text-slate-200 text-lg leading-relaxed font-medium">
                  {a.reason}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-5 transition-all hover:bg-white/10 hover:scale-[1.02]">
                  <div className="text-xs font-semibold text-emerald-400/80 uppercase tracking-widest mb-2">Emission Savings</div>
                  <div className="text-3xl font-bold text-emerald-400 tracking-tight">
                    {a.emissionSavings.toFixed(0)} <span className="text-lg font-medium opacity-60">tons</span>
                  </div>
                  <div className="mt-2 text-xs text-emerald-400/50 font-medium">
                    Est. {Math.round(a.emissionSavings * 0.8)} trees equivalent
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/5 p-5 transition-all hover:bg-white/10 hover:scale-[1.02]">
                  <div className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Time Impact</div>
                  <div className="text-3xl font-bold text-blue-400 tracking-tight">
                    +{a.timeDelta} <span className="text-lg font-medium opacity-60">days</span>
                  </div>
                  <div className="mt-2 text-xs text-blue-400/50 font-medium">
                    Acceptable delay threshold
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/5 p-5 transition-all hover:bg-white/10 hover:scale-[1.02]">
                  <div className="text-xs font-semibold text-purple-400/80 uppercase tracking-widest mb-2">Cost Impact</div>
                  <div className="text-3xl font-bold text-purple-400 tracking-tight">
                    +${a.costImpact.toLocaleString()}
                  </div>
                  <div className="mt-2 text-xs text-purple-400/50 font-medium">
                    ROI positive in long-term
                  </div>
                </div>
              </div>

              {/* Traffic Analysis */}
              {a.recommendedRoute.traffic ? (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50 animate-pulse"></span>
                      <span className="text-sm font-bold text-slate-200 tracking-wide">TRAFFIC ANALYSIS</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Confidence</div>
                        <div className="text-sm font-bold text-emerald-400">{Math.round(a.recommendedRoute.traffic.confidence * 100)}%</div>
                      </div>
                      <div className="h-6 w-px bg-slate-700"></div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-slate-500 font-bold">Source</div>
                        <div className="text-sm font-bold text-blue-400">{a.recommendedRoute.traffic.source}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300 font-medium mb-4">
                    <div>
                      Congestion Factor: <span className="text-white font-bold text-base">{a.recommendedRoute.traffic.congestionFactor.toFixed(2)}×</span>
                    </div>
                    <div>
                      Est. Delay: <span className="text-white font-bold text-base">{a.recommendedRoute.traffic.delayMinutes} min</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      {a.recommendedRoute.traffic.band}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {a.recommendedRoute.traffic.factors.map((f, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-400 font-medium hover:text-slate-200 hover:border-slate-600 transition-colors cursor-default"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = "primary" }: { label: string; value: string; highlight?: "accent" | "primary" }) {
  const highlightClass = highlight === "accent" ? "text-accent" : "text-primary";
  const bgClass = highlight === "accent" ? "bg-accent/5 border-accent/15" : "bg-primary/5 border-primary/15";

  return (
    <div className={`${bgClass} rounded-lg p-4 border transition-all hover:bg-opacity-20`}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-lg font-bold ${highlightClass}`}>{value}</div>
    </div>
  );
}

function ConfidenceBadge({ band, pct }: { band: "High" | "Medium" | "Low"; pct: number }) {
  const styles = {
    High: "bg-accent/20 text-accent border-accent/40 font-semibold",
    Medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 font-semibold",
    Low: "bg-destructive/20 text-destructive border-destructive/40 font-semibold",
  };

  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs ${styles[band]}`}>
      {band} • {pct}%
    </span>
  );
}

function SourceBadge({ src }: { src: "verified" | "estimated" }) {
  const isVerified = src === "verified";
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${isVerified
      ? "bg-primary/20 text-primary border-primary/40"
      : "bg-muted/40 text-foreground border-muted-foreground/20"
      }`}>
      {isVerified ? "✓ Verified" : "Estimated"}
    </span>
  );
}
