import { getTrafficSnapshot } from "@/lib/traffic/trafficAdapter";

export type DecisionMode = "AUTO" | "HUMAN_REVIEW";

export interface RouteTrafficEvalInput {
  point: string; // traffic point (demo uses 52.5200,13.4050)
  baseEmission: number; // tons CO2e for that route
  baseDurationMin: number; // baseline minutes
  confidenceScore?: number; // optional prior model confidence 0..1
}

export interface RouteTrafficEvalResult {
  ok: boolean;

  // traffic telemetry
  congestionFactor: number;
  delayMinutes: number;
  band: "Free" | "Moderate" | "Heavy" | "Severe";
  currentSpeedKmh: number;
  freeFlowSpeedKmh: number;

  // decision / emissions
  adjustedEmission: number;
  deltaEmission: number;
  decisionMode: DecisionMode;

  // explainability
  source: "Simulated" | "Verified";
  confidence: number; // combined
  factors: string[];
  ts: number;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export async function evaluateRouteWithTraffic(input: RouteTrafficEvalInput): Promise<RouteTrafficEvalResult> {
  const snap = await getTrafficSnapshot(input.point, input.baseDurationMin);

  // Combine confidence: (traffic confidence) × (optional model confidence)
  const combinedConfidence = clamp(
    snap.confidence * (input.confidenceScore ?? 1),
    0,
    1
  );

  // Core assumption: congestion increases emissions roughly proportionally for road.
  // You can later make this mode-aware (road vs air/sea).
  const adjustedEmission = input.baseEmission * snap.congestionFactor;
  const deltaEmission = adjustedEmission - input.baseEmission;

  // Guardrails: if severe & low confidence → human review
  const decisionMode: "AUTO" | "HUMAN_REVIEW" =
    (snap.band === "Severe" && combinedConfidence < 0.65) ? "HUMAN_REVIEW" : "AUTO";

  return {
    ok: true,
    congestionFactor: snap.congestionFactor,
    delayMinutes: snap.delayMinutes,
    band: snap.band,
    currentSpeedKmh: snap.currentSpeedKmh,
    freeFlowSpeedKmh: snap.freeFlowSpeedKmh,
    adjustedEmission,
    deltaEmission,
    decisionMode,
    source: snap.source,
    confidence: combinedConfidence,
    factors: snap.factors,
    ts: snap.ts,
  };
}
