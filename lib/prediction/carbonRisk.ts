/**
 * Carbon Risk Detection & Forecasting
 * Predicts emission spikes based on external factors
 */

import { Supplier } from '../types';
import { ConfidenceScore, calculateConfidence } from '../ml/confidence';

export interface CarbonRiskAlert {
  id: string;
  supplier: Supplier;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  currentEmissions: number;
  predictedEmissions: number;
  emissionDelta: number; // Absolute change
  emissionDeltaPercent: number; // Percentage change
  reason: string;
  factors: string[];
  timeToImpact: string;
  confidence: ConfidenceScore;
  recommendation: string;
  estimatedCostImpact?: number;
}

export interface RiskFactors {
  weatherDisruption: boolean;
  trafficCongestion: boolean;
  portDelays: boolean;
  fuelPriceSpike: boolean;
  seasonalDemand: boolean;
  geopoliticalRisk: boolean;
}

/**
 * Simulate weather-based risk detection
 * In production, this would call weather APIs
 */
function detectWeatherRisks(supplier: Supplier): Partial<CarbonRiskAlert> | null {
  // Simulate: Air freight from Asia has higher weather risk
  if (supplier.transportMode === 'air' && 
      (supplier.country === 'China' || supplier.country === 'India')) {
    
    // Random chance to trigger (in production, use actual weather data)
    if (Math.random() > 0.7) {
      const delayImpact = 0.15 + Math.random() * 0.25; // 15-40% increase
      
      return {
        reason: 'Severe weather forecast causing flight delays',
        factors: ['Typhoon warning', 'Flight rerouting expected', 'Potential modal shift to backup routes'],
        emissionDeltaPercent: delayImpact * 100,
        timeToImpact: '24-48 hours',
        severity: delayImpact > 0.3 ? 'High' : 'Medium',
        recommendation: 'Consider delaying shipment or switching to sea freight for non-urgent items',
        estimatedCostImpact: supplier.annualSpend * 0.05, // 5% cost increase
      };
    }
  }
  return null;
}

/**
 * Detect traffic/congestion risks
 */
function detectTrafficRisks(supplier: Supplier): Partial<CarbonRiskAlert> | null {
  // Road transport is susceptible to congestion
  if (supplier.transportMode === 'road' && supplier.distance > 500) {
    if (Math.random() > 0.8) {
      const congestionImpact = 0.10 + Math.random() * 0.15; // 10-25% increase
      
      return {
        reason: 'Heavy traffic congestion on primary route',
        factors: ['Rush hour patterns', 'Construction delays', 'Longer idle time'],
        emissionDeltaPercent: congestionImpact * 100,
        timeToImpact: '6-12 hours',
        severity: 'Medium',
        recommendation: 'Route optimization available - switch to alternate highway',
        estimatedCostImpact: supplier.annualSpend * 0.02,
      };
    }
  }
  return null;
}

/**
 * Detect port/logistics delays
 */
function detectPortDelays(supplier: Supplier): Partial<CarbonRiskAlert> | null {
  // Sea freight vulnerable to port congestion
  if (supplier.transportMode === 'sea') {
    if (Math.random() > 0.85) {
      const delayImpact = 0.05 + Math.random() * 0.10; // 5-15% increase
      
      return {
        reason: 'Port congestion causing delays',
        factors: ['Container shortage', 'Labor strikes', 'Customs backlog'],
        emissionDeltaPercent: delayImpact * 100,
        timeToImpact: '3-7 days',
        severity: 'Low',
        recommendation: 'Monitor situation - may need to switch ports or expedite via air if critical',
        estimatedCostImpact: supplier.annualSpend * 0.03,
      };
    }
  }
  return null;
}

/**
 * Detect seasonal demand spikes
 */
function detectSeasonalRisks(supplier: Supplier): Partial<CarbonRiskAlert> | null {
  const currentMonth = new Date().getMonth();
  
  // Electronics peak in Nov-Dec (holiday season)
  if (supplier.material === 'electronics' && (currentMonth === 10 || currentMonth === 11)) {
    const demandImpact = 0.20 + Math.random() * 0.30; // 20-50% increase
    
    return {
      reason: 'Seasonal demand spike (holiday season)',
      factors: ['Increased order volume', 'Rush shipping', 'Potential air freight conversion'],
      emissionDeltaPercent: demandImpact * 100,
      timeToImpact: 'Ongoing',
      severity: 'High',
      recommendation: 'Plan ahead: order earlier with sea freight to avoid last-minute air freight',
      estimatedCostImpact: supplier.annualSpend * 0.08,
    };
  }
  
  return null;
}

/**
 * Main risk detection function
 */
export async function detectCarbonRisks(suppliers: Supplier[]): Promise<CarbonRiskAlert[]> {
  const alerts: CarbonRiskAlert[] = [];

  for (const supplier of suppliers) {
    const risks = [
      detectWeatherRisks(supplier),
      detectTrafficRisks(supplier),
      detectPortDelays(supplier),
      detectSeasonalRisks(supplier),
    ].filter(r => r !== null);

    for (const risk of risks) {
      if (!risk) continue;

      const emissionDelta = (supplier.totalEmissions * (risk.emissionDeltaPercent || 0)) / 100;
      const predictedEmissions = supplier.totalEmissions + emissionDelta;

      const confidence = calculateConfidence(
        'estimated',
        0.7, // Data completeness
        0.75, // Model accuracy (simulated)
        1 // Fresh data
      );

      alerts.push({
        id: `RISK-${supplier.id}-${Date.now()}`,
        supplier,
        severity: risk.severity || 'Medium',
        currentEmissions: supplier.totalEmissions,
        predictedEmissions,
        emissionDelta,
        emissionDeltaPercent: risk.emissionDeltaPercent || 0,
        reason: risk.reason || 'Unknown risk factor',
        factors: risk.factors || [],
        timeToImpact: risk.timeToImpact || 'Unknown',
        confidence,
        recommendation: risk.recommendation || 'Monitor situation closely',
        estimatedCostImpact: risk.estimatedCostImpact,
      });
    }
  }

  // Sort by severity and impact
  return alerts.sort((a, b) => {
    const severityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.emissionDelta - a.emissionDelta;
  });
}

/**
 * Calculate risk score for a supplier
 */
export function calculateRiskScore(supplier: Supplier): number {
  let riskScore = 0;

  // High emission intensity increases risk
  if (supplier.emissionIntensity > 5) riskScore += 0.3;
  else if (supplier.emissionIntensity > 2) riskScore += 0.2;

  // Air freight is riskier (weather dependent)
  if (supplier.transportMode === 'air') riskScore += 0.3;
  
  // Long distances increase risk
  if (supplier.distance > 5000) riskScore += 0.2;
  else if (supplier.distance > 2000) riskScore += 0.1;

  // High total emissions = high stakes
  if (supplier.totalEmissions > 5000) riskScore += 0.2;

  return Math.min(1, riskScore);
}