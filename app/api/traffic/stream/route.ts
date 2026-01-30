import { simulateTrafficSnapshot } from "@/lib/traffic/simTraffic";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const point = url.searchParams.get("point") ?? "52.5200,13.4050";
    const baseDuration = Number(url.searchParams.get("baseDurationMin") ?? "60");

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = () => {
                try {
                    const snap = simulateTrafficSnapshot(point, baseDuration);
                    const data = JSON.stringify({ ok: true, snap });
                    // Send named event 'snap'
                    controller.enqueue(encoder.encode(`event: snap\ndata: ${data}\n\n`));
                } catch (e) {
                    controller.error(e);
                }
            };

            // Send immediate first chunk
            send();

            // Send updates every ~1000 ms
            const interval = setInterval(send, 1000);

            // Clean up on close
            req.signal.addEventListener("abort", () => {
                clearInterval(interval);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
