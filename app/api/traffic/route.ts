import { NextResponse } from "next/server";
import { getTrafficSnapshot } from "@/lib/optimization/trafficAdapter";

export async function POST(req: Request) {
  console.log("🔥 /api/traffic/route HIT");

  const body = await req.json();
  console.log("📦 body:", body);

  // Use getTrafficSnapshot with a point derived from origin/destination
  // Default base duration of 60 minutes for traffic simulation
  const point = body.origin ?? "52.5200,13.4050";
  const data = await getTrafficSnapshot(point, 60);

  return NextResponse.json({ ok: true, traffic: data });
}
