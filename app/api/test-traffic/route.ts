export async function GET() {
  const key = process.env.TOMTOM_TRAFFIC_KEY;

  if (!key) {
    return Response.json(
      { ok: false, error: "Missing TOMTOM_TRAFFIC_KEY in .env.local" },
      { status: 500 }
    );
  }

  // Use a known road-ish coordinate (Berlin center works as a basic test)
  const point = "52.5200,13.4050";
  const zoom = 10;

  const url =
    `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/${zoom}/json` +
    `?key=${encodeURIComponent(key)}` +
    `&point=${encodeURIComponent(point)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { cache: "no-store", signal: controller.signal });

    clearTimeout(timeout);

    const text = await res.text();

    // return raw so we see exact provider response
    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.name === "AbortError" ? "Timed out" : (e?.message ?? "Unknown error") },
      { status: 500 }
    );
  }
}
