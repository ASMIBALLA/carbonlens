import { TrafficSnapshot } from "./types";

export async function fetchTomTomTraffic(
  point: string,
  baseDurationMin: number
): Promise<TrafficSnapshot> {
  throw new Error("TomTom provider not implemented yet");
}
