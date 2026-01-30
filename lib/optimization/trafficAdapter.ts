export interface TrafficSignal {
  congestionIndex: number;
  delayMinutes: number;
  reliability: number;
}

const TOMTOM_KEY = process.env.TOMTOM_API_KEY!;

export async function fetchTrafficSignal(
  origin: string,
  destination: string
): Promise<TrafficSignal> {

  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${origin}&key=${TOMTOM_KEY}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    const speed = data.flowSegmentData.currentSpeed;
    const free = data.flowSegmentData.freeFlowSpeed;

    const congestion = 1 - speed / free;

    return {
      congestionIndex: Math.max(0, Math.min(1, congestion)),
      delayMinutes: data.flowSegmentData.currentTravelTime - data.flowSegmentData.freeFlowTravelTime,
      reliability: 0.9,
    };

  } catch (e) {
    return {
      congestionIndex: 0.3,
      delayMinutes: 8,
      reliability: 0.4,
    };
  }
}
