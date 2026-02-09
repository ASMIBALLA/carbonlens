import { TrafficSnapshot } from "./types";
import { simulateTrafficSnapshot } from "./simTraffic";

// For now: sim mode. Later: set TRAFFIC_MODE=tomtom
export async function getTrafficSnapshot(
  point: string,
  baseDurationMin: number
): Promise<TrafficSnapshot> {

  const mode = (process.env.TRAFFIC_MODE || "sim").toLowerCase();

  // ✅ Simulation mode (default)
  if (mode === "sim") {
    return simulateTrafficSnapshot(point, baseDurationMin);
  }

  // ✅ External provider (TomTom)
  try {
    const { fetchTomTomTraffic } = await import("./tomtom");
    return await fetchTomTomTraffic(point, baseDurationMin);
  } catch (error) {
    console.warn("Falling back to simulation due to provider error:", error);
    return simulateTrafficSnapshot(point, baseDurationMin);
  }
}
