"use client";

import React from "react";
import type { RouteOptimizationResult } from "@/lib/optimization/routeOptimizer";

export default function RecommendationPanel({ alerts }: { alerts: RouteOptimizationResult[] }) {
  if (!alerts?.length) return null;

  return (
    <div className="space-y-4">
      {alerts.map((a) => (
        <div key={a.supplier.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Supplier</div>
              <h3 className="text-lg font-semibold">{a.supplier.name}</h3>
              <div className="mt-1 text-xs text-slate-500">
                {a.currentRoute.origin} → {a.currentRoute.destination}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge src={a.data_source} />
              <ConfidenceBadge band={a.confidence_band} pct={a.confidence_pct} />
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-700">{a.reason}</p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat label="Emission Savings" value={`${a.emissionSavings.toFixed(2)} tons`} />
            <Stat
              label="Cost Impact"
              value={`${a.costImpact >= 0 ? "+" : "-"}$${Math.abs(a.costImpact).toLocaleString()}`}
            />
            <Stat label="Time Delta" value={`${a.timeDelta >= 0 ? "+" : ""}${a.timeDelta} days`} />
          </div>

          {a.recommendedRoute.traffic ? (
            <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Traffic Signal</div>
                <div className="text-xs text-slate-600">
                  {a.recommendedRoute.traffic.source} • {a.recommendedRoute.traffic.band} •{" "}
                  {Math.round(a.recommendedRoute.traffic.confidence * 100)}% •{" "}
                  {a.recommendedRoute.traffic.decisionMode}
                </div>
              </div>

              <div className="mt-2 text-sm text-slate-700">
                Congestion <b>{a.recommendedRoute.traffic.congestionFactor.toFixed(2)}×</b> • Delay{" "}
                <b>{a.recommendedRoute.traffic.delayMinutes} min</b>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {a.recommendedRoute.traffic.factors.slice(0, 5).map((f, idx) => (
                  <span key={idx} className="rounded-full bg-white px-2 py-1 text-xs text-slate-700 border">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function ConfidenceBadge({ band, pct }: { band: "High" | "Medium" | "Low"; pct: number }) {
  const map: Record<string, string> = {
    High: "bg-green-100 text-green-800 border-green-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${map[band]}`}>
      {band} • {pct}%
    </span>
  );
}

function SourceBadge({ src }: { src: "verified" | "estimated" }) {
  return (
    <span className="rounded-full border bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
      {src === "verified" ? "Verified" : "Estimated"}
    </span>
  );
}
