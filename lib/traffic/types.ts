export type TrafficBand = "Free" | "Moderate" | "Heavy" | "Severe";

export interface TrafficSnapshot {
  ts: number;

  // core signal
  congestionFactor: number; // 1.0 = free flow, >1 slows down
  delayMinutes: number;

  // speeds
  currentSpeedKmh: number;
  freeFlowSpeedKmh: number;

  band: TrafficBand;

  // explainability
  source: "Simulated" | "Verified";
  confidence: number; // 0..1
  factors: string[];
}
