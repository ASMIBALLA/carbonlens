import { TrafficSnapshot, TrafficBand } from "./types";

interface TomTomFlowResponse {
    flowSegmentData: {
        frc: string;
        currentSpeed: number;
        freeFlowSpeed: number;
        currentTravelTime: number;
        freeFlowTravelTime: number;
        confidence: number;
        roadClosure: boolean;
    };
}

function pickBand(cf: number): TrafficBand {
    if (cf < 1.12) return "Free";
    if (cf < 1.35) return "Moderate";
    if (cf < 1.65) return "Heavy";
    return "Severe";
}

export async function fetchTomTomTraffic(point: string, baseDurationMin: number): Promise<TrafficSnapshot> {
    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || process.env.TOMTOM_API_KEY;

    if (!apiKey) {
        throw new Error("Missing TOMTOM_API_KEY");
    }

    // TomTom Flow Segment API (Absolute)
    // https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key={key}&point={point}
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${apiKey}&point=${point}&unit=KMPH`;

    try {
        const res = await fetch(url, { next: { revalidate: 30 } }); // Cache for 30s to save quota
        if (!res.ok) {
            // Fallback to error/mock if verify fails (or throw to trigger existing fallback in route?)
            // Let's throw so the adapter can decide or the route handles it.
            throw new Error(`TomTom API error: ${res.statusText}`);
        }

        const data = await res.json() as TomTomFlowResponse;
        const flow = data.flowSegmentData;

        // Safety checks
        const currentSpeed = flow.currentSpeed ?? 60;
        const freeFlowSpeed = flow.freeFlowSpeed ?? 60;

        // Calculate congestion factor
        // If current is 0 (stopped), use a high factor cap
        const safeSpeed = Math.max(1, currentSpeed);
        let congestionFactor = freeFlowSpeed / safeSpeed;

        // Clamp to reasonable UI range (1.0 to ~3.0 usually)
        congestionFactor = Math.max(1.0, Math.min(3.5, congestionFactor));

        const band = pickBand(congestionFactor);

        // Calculate delay
        // TomTom gives travel times in seconds
        const delaySeconds = Math.max(0, flow.currentTravelTime - flow.freeFlowTravelTime);
        const delayMinutes = Math.round(delaySeconds / 60);

        const factors: string[] = [];
        if (flow.roadClosure) factors.push("Road closure detected");
        if (congestionFactor > 1.5) factors.push("Significantly slower than free-flow");
        if (flow.confidence < 0.6) factors.push("Low data confidence");

        return {
            ts: Date.now(),
            congestionFactor,
            delayMinutes,
            currentSpeedKmh: currentSpeed,
            freeFlowSpeedKmh: freeFlowSpeed,
            band,
            source: "Verified",
            confidence: flow.confidence ?? 0.8,
            factors,
        };

    } catch (err) {
        console.error("TomTom fetch failed:", err);
        throw err;
    }
}
