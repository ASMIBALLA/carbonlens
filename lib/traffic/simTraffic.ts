import { TrafficSnapshot, TrafficBand } from "./types";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pickBand(cf: number): TrafficBand {
  if (cf < 1.12) return "Free";
  if (cf < 1.35) return "Moderate";
  if (cf < 1.65) return "Heavy";
  return "Severe";
}

// deterministic-ish noise per point + time bucket
function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function simulateTrafficSnapshot(point: string, baseDurationMin: number): TrafficSnapshot {
  const now = Date.now();
  const t = now / 1000;

  const seed = hashString(point);
  const wave1 = Math.sin(t / 7 + seed * 10);
  const wave2 = Math.sin(t / 17 + seed * 20);
  const wave3 = Math.sin(t / 33 + seed * 30);

  // congestion factor 1.05 .. ~1.8
  let congestionFactor =
    1.12 +
    0.18 * wave1 +
    0.12 * wave2 +
    0.08 * wave3 +
    0.06 * (seed - 0.5);

  // clamp + smooth
  congestionFactor = clamp(congestionFactor, 1.03, 1.85);

  const band = pickBand(congestionFactor);

  const freeFlowSpeedKmh = clamp(92 + seed * 18, 80, 115);
  const currentSpeedKmh = clamp(freeFlowSpeedKmh / congestionFactor, 18, freeFlowSpeedKmh);

  const delayMinutes = Math.max(0, Math.round(baseDurationMin * (congestionFactor - 1)));

  const factors: string[] = [];
  if (band === "Free") factors.push("Free-flow conditions");
  if (band === "Moderate") factors.push("Moderate slowdown");
  if (band === "Heavy") factors.push("Heavy congestion pockets");
  if (band === "Severe") factors.push("Severe congestion / incident-like pattern");

  if (congestionFactor > 1.35) factors.push("Stop-go waves detected");
  if (delayMinutes > 15) factors.push("Delay pressure elevated");

  const confidence = clamp(0.55 + (1.0 / congestionFactor) * 0.35, 0.35, 0.92);

  return {
    ts: now,
    congestionFactor,
    delayMinutes,
    currentSpeedKmh: Math.round(currentSpeedKmh),
    freeFlowSpeedKmh: Math.round(freeFlowSpeedKmh),
    band,
    source: "Simulated",
    confidence,
    factors,
  };
}
