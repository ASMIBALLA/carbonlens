import { NextResponse } from "next/server";

type Hotspot = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  hint?: string;
};

type HotspotFlow = {
  currentSpeedKmph?: number;
  freeFlowSpeedKmph?: number;
  currentTravelTimeSec?: number;
  freeFlowTravelTimeSec?: number;
  confidence?: number;
  roadClosure?: boolean;
};

type HotspotResult =
  | {
    id: string;
    name: string;
    lat: number;
    lon: number;
    lon_unused?: never;
    ok: true;
    flow: HotspotFlow;
    fetchedAt: string;
  }
  | {
    id: string;
    name: string;
    lat: number;
    lon: number;
    ok: false;
    error: { status: number; body: string };
  };

export async function POST(req: Request) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { status: 400, body: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const hotspots: Hotspot[] = Array.isArray(body?.hotspots) ? body.hotspots : [];
  if (!hotspots.length) {
    return NextResponse.json(
      { ok: false, error: { status: 400, body: "Body must include { hotspots: [...] }" } },
      { status: 400 }
    );
  }

  /* =========================
     🚦 TRAFFIC RESOLVER
     ========================= */
  const MODE = (process.env.TRAFFIC_MODE || "sim").toLowerCase();

  /* =========================
     ✅ SIM MODE (DEFAULT)
     ========================= */
  if (MODE !== "tomtom") {
    // Return deterministic simulation data matching localhost behavior
    return NextResponse.json({
      ok: true,
      results: hotspots.map((h) => ({
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: true,
        flow: {
          currentSpeedKmph: Math.round(18 + Math.random() * 15),
          freeFlowSpeedKmph: 45,
          confidence: 0.85,
          roadClosure: false,
        },
        fetchedAt: new Date().toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
      source: "simulation"
    });
  }

  /* =========================
     🔒 LIVE MODE (TomTom - OPT-IN ONLY)
     ========================= */
  const rawKey = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  const key = rawKey?.replace(/^["']|["']$/g, "").trim();

  // If mode is TomTom but key missing, fallback gracefully to Sim logic setup
  if (!key) {
    console.warn(`[CarbonLens] TRAFFIC_MODE=tomtom but NO KEY found. Falling back to simulation.`);
    return NextResponse.json({
      ok: true,
      results: hotspots.map((h) => ({
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: true,
        flow: {
          currentSpeedKmph: Math.round(18 + Math.random() * 15),
          freeFlowSpeedKmph: 45,
          confidence: 0.85,
          roadClosure: false,
        },
        fetchedAt: new Date().toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
      source: "simulation_fallback"
    });
  }

  // Helper to fetch flow for one hotspot
  async function fetchFlow(h: Hotspot): Promise<HotspotResult> {
    const baseUrl = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";
    const url = `${baseUrl}?key=${encodeURIComponent(key!)}&point=${h.lat},${h.lon}`;

    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Accept": "application/json",
          "Referer": "https://carbonlens.onrender.com",
          "Origin": "https://carbonlens.onrender.com"
        }
      });

      if (!res.ok) {
        // Return minimal error, avoiding spam
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { status: res.status, body: "External Provider Unavailable" }
        };
      }

      const json = await res.json();
      const data = json?.flowSegmentData;

      if (!data) throw new Error("No data");

      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: true,
        flow: {
          currentSpeedKmph: data.currentSpeed,
          freeFlowSpeedKmph: data.freeFlowSpeed,
          currentTravelTimeSec: data.currentTravelTime,
          freeFlowTravelTimeSec: data.freeFlowTravelTime,
          confidence: data.confidence,
          roadClosure: data.roadClosure ?? false,
        },
        fetchedAt: new Date().toISOString(),
      };

    } catch (e) {
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: false,
        error: { status: 500, body: "Fetch failed" }
      };
    }
  }

  // Execute all fetches parallely
  const results = await Promise.all(hotspots.map(fetchFlow));

  return NextResponse.json({
    ok: true,
    results,
    fetchedAt: new Date().toISOString(),
    source: "tomtom"
  });
}
