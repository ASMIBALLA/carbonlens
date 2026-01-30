import { NextResponse } from "next/server";

type Hotspot = { id: string; name: string; lat: number; lon: number; hint?: string };

type HotspotFlow = {
  currentSpeedKmph?: number;
  freeFlowSpeedKmph?: number;
  currentTravelTimeSec?: number;
  freeFlowTravelTimeSec?: number;
  confidence?: number;
  roadClosure?: boolean;
};

type HotspotResult =
  | { id: string; name: string; lat: number; lon: number; ok: true; flow: HotspotFlow; fetchedAt: string }
  | { id: string; name: string; lat: number; lon: number; ok: false; error: { status: number; body: string } };

export async function POST(req: Request) {
  const key = process.env.TOMTOM_API_KEY;

  if (!key) {
    return NextResponse.json(
      { ok: false, error: { status: 500, body: "Missing TOMTOM_API_KEY (server env)" } },
      { status: 500 }
    );
  }

  let body: any = null;
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

  // TomTom Flow Segment Data endpoint
  // We’ll query by point for each hotspot
  async function fetchFlow(h: Hotspot): Promise<HotspotResult> {
    const url =
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json` +
      `?point=${encodeURIComponent(`${h.lat},${h.lon}`)}` +
      `&unit=KMPH` +
      `&key=${encodeURIComponent(key)}`;

    try {
      const res = await fetch(url, {
        // keep it simple; no caching
        cache: "no-store",
        headers: { "Accept": "application/json" },
      });

      const text = await res.text();

      if (!res.ok) {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { status: res.status, body: text?.slice(0, 500) || "TomTom error" },
        };
      }

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        return {
          id: h.id,
          name: h.name,
          lat: h.lat,
          lon: h.lon,
          ok: false,
          error: { status: 502, body: "TomTom returned non-JSON response" },
        };
      }

      const f = json?.flowSegmentData;

      const flow: HotspotFlow = {
        currentSpeedKmph: typeof f?.currentSpeed === "number" ? f.currentSpeed : undefined,
        freeFlowSpeedKmph: typeof f?.freeFlowSpeed === "number" ? f.freeFlowSpeed : undefined,
        currentTravelTimeSec: typeof f?.currentTravelTime === "number" ? f.currentTravelTime : undefined,
        freeFlowTravelTimeSec: typeof f?.freeFlowTravelTime === "number" ? f.freeFlowTravelTime : undefined,
        confidence: typeof f?.confidence === "number" ? f.confidence : undefined,
        roadClosure: typeof f?.roadClosure === "boolean" ? f.roadClosure : undefined,
      };

      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: true,
        flow,
        fetchedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      return {
        id: h.id,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        ok: false,
        error: { status: 500, body: e?.message || "Fetch failed" },
      };
    }
  }

  // Parallelize for speed
  const results: HotspotResult[] = await Promise.all(hotspots.map(fetchFlow));

  return NextResponse.json({
    ok: true,
    results,
    fetchedAt: new Date().toISOString(),
  });
}
