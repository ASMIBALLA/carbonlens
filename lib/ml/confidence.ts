/**
 * Confidence Scoring Framework
 * Assigns confidence levels to emission calculations and predictions
 */

export interface ConfidenceScore {
  score: number; // 0-1
  level: 'High' | 'Medium' | 'Low';
  factors: string[];
  dataQuality: 'Primary' | 'Secondary' | 'Estimated';

  // ✅ NEW — audit + UI flags
  dataSourceLabel: 'verified' | 'estimated';
  confidenceBand: 'High' | 'Medium' | 'Low';
}

/**
 * Convert numeric score → band
 */
export function scoreToBand(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 0.8) return 'High';
  if (score >= 0.6) return 'Medium';
  return 'Low';
}

export function calculateConfidence(
  dataSource: 'user_provided' | 'estimated' | 'api',
  dataCompleteness: number,
  modelAccuracy?: number,
  dataAge?: number
): ConfidenceScore {
  let baseScore = 0;
  const factors: string[] = [];

  // Source weight
  switch (dataSource) {
    case 'user_provided':
      baseScore += 0.4;
      factors.push('Primary data source');
      break;

    case 'api':
      baseScore += 0.3;
      factors.push('Verified external API');
      break;

    case 'estimated':
      baseScore += 0.1;
      factors.push('Industry / peer estimation');
      break;
  }

  // Completeness
  baseScore += dataCompleteness * 0.3;

  if (dataCompleteness > 0.9) factors.push('Complete coverage');
  else if (dataCompleteness > 0.7) factors.push('Good coverage');
  else factors.push('Partial coverage');

  // Model accuracy
  if (modelAccuracy !== undefined) {
    baseScore += modelAccuracy * 0.2;
    if (modelAccuracy > 0.85) factors.push('High model accuracy');
  }

  // Freshness
  if (dataAge !== undefined) {
    const freshness = Math.max(0, 1 - dataAge / 365) * 0.1;
    baseScore += freshness;

    if (dataAge < 30) factors.push('Recent data');
    else if (dataAge < 90) factors.push('Moderately recent');
    else factors.push('Older data');
  }

  const score = Math.max(0, Math.min(1, baseScore));
  const band = scoreToBand(score);

  let dataQuality: 'Primary' | 'Secondary' | 'Estimated';

  if (dataSource === 'user_provided' && dataCompleteness > 0.9)
    dataQuality = 'Primary';
  else if (dataSource === 'api' || dataCompleteness > 0.6)
    dataQuality = 'Secondary';
  else
    dataQuality = 'Estimated';

  return {
    score,
    level: band,
    factors,
    dataQuality,

    // ✅ NEW
    dataSourceLabel: dataSource === 'estimated' ? 'estimated' : 'verified',
    confidenceBand: band,
  };
}

export function aggregateConfidence(scores: ConfidenceScore[]): ConfidenceScore {
  if (!scores.length) {
    return {
      score: 0,
      level: 'Low',
      factors: ['No data'],
      dataQuality: 'Estimated',
      dataSourceLabel: 'estimated',
      confidenceBand: 'Low',
    };
  }

  const avg = scores.reduce((s, x) => s + x.score, 0) / scores.length;
  const band = scoreToBand(avg);

  const allFactors = Array.from(new Set(scores.flatMap(s => s.factors)));

  const qualityRank: Record<'Primary' | 'Secondary' | 'Estimated', number> = { Primary: 3, Secondary: 2, Estimated: 1 };

  const bestQuality = scores.reduce<'Primary' | 'Secondary' | 'Estimated'>((best, curr) =>
    qualityRank[curr.dataQuality] > qualityRank[best]
      ? curr.dataQuality
      : best
    , 'Estimated');

  const anyEstimated = scores.some(s => s.dataSourceLabel === 'estimated');

  return {
    score: avg,
    level: band,
    factors: allFactors,
    dataQuality: bestQuality,
    dataSourceLabel: anyEstimated ? 'estimated' : 'verified',
    confidenceBand: band,
  };
}
