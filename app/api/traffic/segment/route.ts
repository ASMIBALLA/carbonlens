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
  const rawKey = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  const key = rawKey?.replace(/^["']|["']$/g, "").trim();

  if (!key) {
    console.error(`[CarbonLens] Missing TOMTOM_API_KEY environment variable for LIVE mode.`);
    return NextResponse.json(
      { ok: false, error: { status: 500, body: "Server configuration error: Missing API Key" } },
      { status: 500 }
    );
  }

  async function fetchFlow(h: Hotspot): Promise<HotspotResult> {
    // TomTom Traffic Flow - Flow Segment Data
    // Stats: currentSpeed, freeFlowSpeed, currentTravelTime, freeFlowTravelTime, confidence
    // Endpoint: /traffic/services/4/flowSegmentData/absolute/{zoom}/json
    const baseUrl = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";

    // IMPORTANT: 'point' parameter should be "lat,lon". 
    // We do NOT encodeURIComponent the comma to ensure the API parses it correctly 
    // and to align with known working patterns for this endpoint.
    const url = `${baseUrl}?key=${encodeURIComponent(key!)}&point=${h.lat},${h.lon}`;

    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) {
        // Detailed debug logging as requested
        console.error(`[TomTom API Error] Status: ${res.status} for ${h.name} (${h.id})`);
        console.error(`Endpoint: ${baseUrl}`);
        if (text) console.error(`Response Body: ${text.slice(0, 500)}`);

        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { code: "TOMTOM_ERROR", status: res.status, body: text.slice(0, 500) } as any,
        };
      }

      const data = json?.flowSegmentData;

      if (!data) {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { status: 404, body: "No flowSegmentData in response" },
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
      console.error(`[TomTom API Exception] ${h.name}:`, e);
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: false,
        error: { status: 500, body: e.message || "Fetch failed" },
      };
    }
  }

  const results = await Promise.all(hotspots.map(fetchFlow));

  return NextResponse.json({
    ok: true,
    results,
    fetchedAt: new Date().toISOString(),
  });
}
