import { NextResponse } from "next/server";
import { getTrafficSnapshot } from "@/lib/traffic/trafficAdapter";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const point = url.searchParams.get("point") || "52.5200,13.4050";
    const base = Number(url.searchParams.get("base")) || 60;

    const snap = await getTrafficSnapshot(point, base);

    return NextResponse.json({ ok: true, point, snapshot: snap });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
