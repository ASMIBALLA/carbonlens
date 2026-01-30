/**
 * Convert traffic → emission multiplier
 */

export function trafficEmissionMultiplier(congestionIndex: number): number {
  // Idle + stop-go increases emissions
  // 0 congestion → 1.0
  // heavy congestion → up to 1.35

  return 1 + congestionIndex * 0.35;
}
