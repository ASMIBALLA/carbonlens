/**
 * TrafficSnapshot type for optimization modules.
 * Used by simTraffic.ts, tomtom.ts, and trafficAdapter.ts
 */
export interface TrafficSnapshot {
    point: string;
    baseDurationMin: number;
    congestionFactor: number;
    adjustedDurationMin: number;
    source: string;
    timestamp: number;
}
