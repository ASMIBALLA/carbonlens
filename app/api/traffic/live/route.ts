import { simulateTrafficSnapshot } from "@/lib/traffic/simTraffic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const point = url.searchParams.get("point") ?? "52.5200,13.4050";
  const baseDuration = Number(url.searchParams.get("baseDurationMin") ?? "60");
  const intervalMs = Number(url.searchParams.get("intervalMs") ?? "1000");

  const safeInterval = Math.max(400, Math.min(5000, intervalMs));
  const mode = (process.env.TRAFFIC_MODE ?? "sim").toLowerCase();

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // hello event
      send("hello", { ok: true, mode, point, intervalMs: safeInterval });

      const id = setInterval(() => {
        if (closed) return;

        // reuse your existing logic
        const snap = simulateTrafficSnapshot(point, baseDuration);

        send("snap", { ok: true, mode, point, snap });
      }, safeInterval);

      // keep-alive ping (prevents proxy timeout)
      const pingId = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15000);

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(id);
        clearInterval(pingId);
        try { controller.close(); } catch {}
      };

      // @ts-ignore
      req.signal?.addEventListener?.("abort", abort);
    },

    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
