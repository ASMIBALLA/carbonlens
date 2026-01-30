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

export default function RecommendationPanel({ alerts }: { alerts: RouteOptimizationResult[] }) {
  if (!alerts?.length) return null;

  return (
    <div className="space-y-6">
      {/* Carbon Traffic Map */}
      <CarbonTrafficMap />

      {/* Recommendation Cards */}
      <div className="space-y-4">
        {alerts.map((a) => (
          <div 
            key={a.supplier.id} 
            className="rounded-xl border border-primary/20 bg-gradient-to-br from-card to-card/50 backdrop-blur-lg shadow-xl hover:border-primary/40 transition-all duration-300"
          >
            {/* Header Section */}
            <div className="px-6 py-5 border-b border-primary/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-primary/70 uppercase tracking-wide mb-2">Supplier</div>
                  <h3 className="text-xl font-bold text-foreground truncate">{a.supplier.name}</h3>
                  <div className="mt-2 text-sm text-muted-foreground truncate">
                    {a.currentRoute.origin} <span className="text-accent/60 mx-1">→</span> {a.currentRoute.destination}
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-2">
                  <SourceBadge src={a.data_source} />
                  <ConfidenceBadge band={a.confidence_band} pct={a.confidence_pct} />
                </div>
              </div>
            </div>

            {/* Recommendation Message */}
            <div className="px-6 py-5 border-b border-primary/10">
              <p className="text-sm text-foreground/85 leading-relaxed font-medium">{a.reason}</p>
            </div>

            {/* Metrics Grid */}
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-primary/10">
              <Stat label="Emission Savings" value={`${a.emissionSavings.toFixed(2)} tons`} highlight="accent" />
              <Stat
                label="Cost Impact"
                value={`${a.costImpact >= 0 ? "+" : "-"}$${Math.abs(a.costImpact).toLocaleString()}`}
                highlight={a.costImpact < 0 ? "accent" : "primary"}
              />
              <Stat label="Time Delta" value={`${a.timeDelta >= 0 ? "+" : ""}${a.timeDelta} days`} highlight="primary" />
            </div>

            {/* Traffic Signal Section */}
            {a.recommendedRoute.traffic ? (
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-bold text-foreground uppercase tracking-wide">Traffic Signal</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/80 font-medium">
                    <span>{a.recommendedRoute.traffic.source}</span>
                    <span className="text-primary/40">•</span>
                    <span>{a.recommendedRoute.traffic.band}</span>
                    <span className="text-primary/40">•</span>
                    <span>{Math.round(a.recommendedRoute.traffic.confidence * 100)}%</span>
                    <span className="text-primary/40">•</span>
                    <span>{a.recommendedRoute.traffic.decisionMode}</span>
                  </div>
                </div>

                <div className="text-sm text-foreground/85 mb-4 font-medium">
                  Congestion <span className="text-accent font-bold">{a.recommendedRoute.traffic.congestionFactor.toFixed(2)}×</span> • Delay{" "}
                  <span className="text-accent font-bold">{a.recommendedRoute.traffic.delayMinutes} min</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {a.recommendedRoute.traffic.factors.slice(0, 5).map((f, idx) => (
                    <span 
                      key={idx} 
                      className="px-3 py-1.5 rounded-full bg-primary/10 text-xs text-primary/90 border border-primary/20 font-medium hover:bg-primary/15 transition-colors"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
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
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
      isVerified 
        ? "bg-primary/20 text-primary border-primary/40" 
        : "bg-muted/40 text-muted-foreground border-muted-foreground/20"
    }`}>
      {isVerified ? "✓ Verified" : "Estimated"}
    </span>
  );
}
