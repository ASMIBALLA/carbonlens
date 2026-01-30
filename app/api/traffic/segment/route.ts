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

const MODE = process.env.TRAFFIC_MODE ?? "sim";

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

  const hotspots = Array.isArray(body?.hotspots) ? body.hotspots : [];
  if (!hotspots.length) {
    return NextResponse.json(
      { ok: false, error: { status: 400, body: "Body must include { hotspots: [...] }" } },
      { status: 400 }
    );
  }

  /* =========================
     ✅ SIM MODE (EARLY RETURN)
     ========================= */
  if (MODE === "sim") {
    return NextResponse.json({
      ok: true,
      results: hotspots.map((h: any) => ({
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
    });
  }

  /* =========================
     🔒 LIVE MODE (TomTom)
     ========================= */
  const key = process.env.TOMTOM_API_KEY;

  if (!key) {
    return NextResponse.json(
      { ok: false, error: { status: 500, body: "Missing TOMTOM_API_KEY" } },
      { status: 500 }
    );
  }

  const tomtomKey: string = key;

  async function fetchFlow(h: Hotspot): Promise<HotspotResult> {
    // FIX: Use 'flowSegmentData' endpoint instead of 'incidentDetails'.
    // This provides speed/travel time and avoids 403 errors from restricted/incorrect endpoints.
    // Format: flowSegmentData/absolute/{zoom}/json?point=lat,lon
    const url =
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
      `?key=${encodeURIComponent(tomtomKey)}` +
      `&point=${encodeURIComponent(`${h.lat},${h.lon}`)}`;

    try {
      const res = await fetch(url, { cache: "no-store", headers: { "Accept": "application/json" } });
      const json = await res.json();

      if (!res.ok) {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { status: res.status, body: JSON.stringify(json).slice(0, 500) },
        };
      }

      const data = json.flowSegmentData;

      if (!data) {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { status: 404, body: "No flow data found for location" },
        };
      }

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
    } catch (e: any) {
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: false,
        error: { status: 500, body: e.message || "Flow fetch failed" },
      };
    }
  }

  const results: HotspotResult[] = await Promise.all(hotspots.map(fetchFlow));

  return NextResponse.json({
    ok: true,
    results,
    fetchedAt: new Date().toISOString(),
  });
}
