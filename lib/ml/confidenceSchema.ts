// lib/ml/confidenceSchema.ts

export type DataSourceType = "verified" | "estimated";

export type ConfidenceBand = "High" | "Medium" | "Low";

export interface ConfidenceMeta {
  data_source: DataSourceType;
  confidence_score: number; // 0–1
  confidence_band: ConfidenceBand;
  confidence_reason?: string;
}

/**
 * Convert numeric confidence → band label
 */
export function scoreToBand(score: number): ConfidenceBand {
  if (score >= 0.8) return "High";
  if (score >= 0.6) return "Medium";
  return "Low";
}

/**
 * Clamp + normalize score
 */
export function normalizeScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

/**
 * Helper builder
 */
export function buildConfidenceMeta(
  source: DataSourceType,
  score: number,
  reason?: string
): ConfidenceMeta {
  const s = normalizeScore(score);
  return {
    data_source: source,
    confidence_score: s,
    confidence_band: scoreToBand(s),
    confidence_reason: reason,
  };
}
