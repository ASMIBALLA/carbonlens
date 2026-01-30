"use client";

import React, { useState, useEffect } from "react";
import TrafficViz from "@/components/TrafficViz";
import RecommendationPanel from "@/components/RecommendationPanel";
import dynamic from "next/dynamic";

const PLACES_CHENNAI = [
  { id: "chennai-port", label: "Chennai Port", lat: 13.0844, lon: 80.2899, type: "port" },
  { id: "ennore-port", label: "Ennore Port", lat: 13.2667, lon: 80.3333, type: "port" },
  { id: "sriperumbudur", label: "Sriperumbudur Ind. Area", lat: 12.9702, lon: 79.9537, type: "hub" },
  { id: "oragadam", label: "Oragadam Ind. Corridor", lat: 12.8354, lon: 79.9537, type: "hub" },
  { id: "guindy", label: "Guindy Ind. Estate", lat: 13.0167, lon: 80.2167, type: "warehouse" },
  { id: "ambattur", label: "Ambattur Ind. Estate", lat: 13.0975, lon: 80.1611, type: "warehouse" },
  { id: "airport-cargo", label: "Chennai Airport Cargo", lat: 12.9862, lon: 80.1636, type: "hub" },
];

const CHENNAI_CARGO_HIGHWAYS = [
  {
    id: "nh-48",
    name: "NH-48 (Bangalore Highway)",
    segments: [{
      id: "nh-48-full",
      path: [
        [12.9702, 79.9537], [12.9850, 80.0100], [13.0020, 80.0800], [13.0300, 80.1500], [13.0500, 80.2500]
      ] as [number, number][],
      band: "Free",
      multiplier: 1.02,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  },
  {
    id: "chennai-bypass",
    name: "Chennai Bypass Road",
    segments: [{
      id: "bypass-full",
      path: [
        [12.8900, 80.1500], [12.9500, 80.1500], [13.0100, 80.1550], [13.0800, 80.1700], [13.1500, 80.1800]
      ] as [number, number][],
      band: "Moderate",
      multiplier: 1.18,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  },
  {
    id: "gst-road",
    name: "NH-45 (GST Road)",
    segments: [{
      id: "gst-full",
      path: [
        [13.0100, 80.2100], [12.9500, 80.1500], [12.9000, 80.1000], [12.8500, 80.0500], [12.7500, 79.9800]
      ] as [number, number][],
      band: "Heavy",
      multiplier: 1.35,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  },
  {
    id: "gnt-road",
    name: "NH-16 (GNT Road)",
    segments: [{
      id: "gnt-full",
      path: [
        [13.0844, 80.2899], [13.1500, 80.2800], [13.2500, 80.2500], [13.3500, 80.2000], [13.5000, 80.1500]
      ] as [number, number][],
      band: "Free",
      multiplier: 1.05,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  },
  {
    id: "ennore-port-rd",
    name: "Ennore Port Connectivity",
    segments: [{
      id: "ennore-full",
      path: [
        [13.2667, 80.3333], [13.2000, 80.3100], [13.1500, 80.2899]
      ] as [number, number][],
      band: "Moderate",
      multiplier: 1.2,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  },
  {
    id: "tpp-road",
    name: "TPP Road (Port Express)",
    segments: [{
      id: "tpp-full",
      path: [
        [13.1500, 80.2899], [13.2000, 80.2500], [13.3000, 80.2200], [13.4000, 80.1800]
      ] as [number, number][],
      band: "Heavy",
      multiplier: 1.45,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  },
  {
    id: "outer-ring-2",
    name: "Outer Ring Road (Phase 2)",
    segments: [{
      id: "orr-2",
      path: [
        [13.2500, 80.3200], [13.3000, 80.2000], [13.2000, 80.0500], [13.0500, 79.9800]
      ] as [number, number][],
      band: "Free",
      multiplier: 1.03,
      confidence: 1,
      baseEmissions: 0,
      adjustedEmissions: 0,
      deltaEmissions: 0
    }]
  }
];

export default function Page() {
  // State for real-time alerts
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection State (Defaults: Chennai Port -> Guindy)
  const [selectedSource, setSelectedSource] = useState(PLACES_CHENNAI[0]);
  const [selectedDestination, setSelectedDestination] = useState(PLACES_CHENNAI[4]);

  useEffect(() => {
    async function fetchLogistics() {
      if (!selectedSource || !selectedDestination) return;

      try {
        setLoading(true);
        // Demo: Hamburg (53.5511,9.9937) -> Berlin (52.5200,13.4050)
        const res = await fetch("/api/logistics/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: `${selectedSource.lat},${selectedSource.lon}`,
            destination: `${selectedDestination.lat},${selectedDestination.lon}`,
            supplierName: `Logistics: ${selectedSource.label} → ${selectedDestination.label}`
          })
        });

        const json = await res.json();
        if (json.outcome === "success" && json.result) {
          // Enhancing result with readable names for UI
          json.result.currentRoute.origin = selectedSource.label;
          json.result.currentRoute.destination = selectedDestination.label;
          json.result.recommendedRoute.origin = selectedSource.label;
          json.result.recommendedRoute.destination = selectedDestination.label;

          setAlerts([json.result]);
        }
      } catch (e) {
        console.error("Failed to fetch logistics:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLogistics();
  }, [selectedSource, selectedDestination]);

  return (
    <main style={{
      minHeight: "100vh",
      padding: "28px",
      background:
        "radial-gradient(900px 420px at 12% 10%, rgba(99,102,241,0.28), transparent 55%)," +
        "radial-gradient(700px 380px at 80% 8%, rgba(168,85,247,0.20), transparent 55%)," +
        "linear-gradient(180deg, rgba(2,6,23,1), rgba(15,23,42,1))",
      color: "white"
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>CarbonLens</div>
            <div style={{ marginTop: 6, opacity: 0.75 }}>
              Real-time traffic signal → emission multiplier → route recommendation
            </div>
          </div>
          <div style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            opacity: 0.9,
            fontSize: 12
          }}>
            Telemetry
          </div>
        </div>

        {/* Location Selection Controls */}
        <div className="mt-8 p-6 rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Source Selection */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Origin Point</label>
              <div className="flex flex-wrap gap-2">
                {PLACES_CHENNAI.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedSource(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedSource.id === p.id
                      ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Destination Point</label>
              <div className="flex flex-wrap gap-2">
                {PLACES_CHENNAI.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedDestination(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${selectedDestination.id === p.id
                      ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.4)]"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <TrafficViz
            point={`${selectedDestination.lat},${selectedDestination.lon}`}
            baseDurationMin={60}
            title={`Live Traffic @ ${selectedDestination.label}`}
            pollMs={5000}
          />
        </div>

        {/* NEW: Recommendations with Map */}
        <div style={{ marginTop: 32 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>
              Route Optimization Recommendations
            </h2>
            {loading && <span className="text-sm text-emerald-400 animate-pulse">Fetching real-time TomTom data...</span>}
          </div>

          <RecommendationPanel
            alerts={alerts}
            markers={PLACES_CHENNAI}
            networkRoutes={CHENNAI_CARGO_HIGHWAYS}
          />
        </div>
      </div>
    </main>
  );
}