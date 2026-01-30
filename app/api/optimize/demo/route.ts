import { NextResponse } from "next/server";
import suppliers from "@/lib/sampleData";
import { optimizeAllRoutesWithTraffic } from "@/lib/optimization/routeOptimizer";

export async function GET() {
  try {
    // Demo: a fixed “traffic point” (Berlin)
    const trafficPoint = "52.5200,13.4050";

    const results = await optimizeAllRoutesWithTraffic(suppliers, trafficPoint, 1000);

    return NextResponse.json({
      ok: true,
      trafficPoint,
      count: results.length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
