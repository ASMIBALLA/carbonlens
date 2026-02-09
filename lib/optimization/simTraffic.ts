import { TrafficSnapshot } from "./types";

export function simulateTrafficSnapshot(
  point: string,
  baseDurationMin: number
): TrafficSnapshot {
  return {
    point,
    baseDurationMin,
    congestionFactor: 1.2,
    adjustedDurationMin: Math.round(baseDurationMin * 1.2),
    source: "simulation",
    timestamp: Date.now()
  };
}
