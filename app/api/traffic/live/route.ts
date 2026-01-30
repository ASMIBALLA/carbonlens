import { simulateTrafficSnapshot } from "@/lib/traffic/simTraffic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const point = url.searchParams.get("point") ?? "52.5200,13.4050";
  const baseDuration = Number(url.searchParams.get("baseDurationMin") ?? "60");

  const mode = (process.env.TRAFFIC_MODE ?? "sim").toLowerCase();

  if (mode !== "sim") {
    // later: call real provider here
  }

  const snap = simulateTrafficSnapshot(point, baseDuration);

  return Response.json({ ok: true, mode, point, snap });
}
