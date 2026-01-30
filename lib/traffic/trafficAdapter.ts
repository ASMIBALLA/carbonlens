import { TrafficSnapshot } from "./types";
import { simulateTrafficSnapshot } from "./simTraffic";

// For now: sim mode. Later: set TRAFFIC_MODE=tomtom and implement fetch in here.
export async function getTrafficSnapshot(point: string, baseDurationMin: number): Promise<TrafficSnapshot> {
  const mode = (process.env.TRAFFIC_MODE || "sim").toLowerCase();

  if (mode === "sim") {
    return simulateTrafficSnapshot(point, baseDurationMin);
  }

  // Placeholder for future real provider
  // You can implement TomTom/Here/etc here and return source:"Verified"
  // For now fallback to sim to keep app running.
  return simulateTrafficSnapshot(point, baseDurationMin);
}
