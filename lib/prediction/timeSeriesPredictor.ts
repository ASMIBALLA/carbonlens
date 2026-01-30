/**
 * Time Series Emission Forecasting
 * Predicts future emissions based on historical patterns
 */

import { Supplier } from '../types';

export interface EmissionForecast {
  date: Date;
  predictedEmissions: number;
  confidenceLower: number;
  confidenceUpper: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ForecastResult {
  supplier: Supplier;
  forecasts: EmissionForecast[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number; // 0-1
  seasonality: boolean;
  anomaliesDetected: number;
}

/**
 * Simple moving average calculation
 */
function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const subset = data.slice(start, i + 1);
    const avg = subset.reduce((sum, val) => sum + val, 0) / subset.length;
    result.push(avg);
  }
  return result;
}

/**
 * Calculate linear trend
 */
function calculateTrend(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (data[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
}

/**
 * Generate synthetic historical data for demo
 * In production, this would come from database
 */
function generateHistoricalData(supplier: Supplier, months: number = 12): number[] {
  const baseEmission = supplier.totalEmissions / 12; // Monthly average
  const history: number[] = [];

  for (let i = 0; i < months; i++) {
    // Add trend (slight increase over time)
    const trendComponent = baseEmission * (1 + (i * 0.02));
    
    // Add seasonality (peak in Nov-Dec for some materials)
    const month = (new Date().getMonth() - (months - i - 1) + 12) % 12;
    let seasonalMultiplier = 1;
    if (supplier.material === 'electronics' && (month === 10 || month === 11)) {
      seasonalMultiplier = 1.3; // 30% peak
    } else if (month === 6 || month === 7) {
      seasonalMultiplier = 0.9; // 10% dip in summer
    }
    
    // Add random noise
    const noise = (Math.random() - 0.5) * 0.2 * baseEmission;
    
    history.push(trendComponent * seasonalMultiplier + noise);
  }

  return history;
}

/**
 * Forecast future emissions using exponential smoothing
 */
export function forecastEmissions(
  supplier: Supplier,
  horizonMonths: number = 6
): ForecastResult {
  // Generate historical data (in production, fetch from database)
  const historicalData = generateHistoricalData(supplier, 12);

  // Calculate trend
  const { slope, intercept } = calculateTrend(historicalData);
  const trendStrength = Math.abs(slope) / (historicalData[0] || 1);

  // Determine trend direction
  let trend: 'increasing' | 'decreasing' | 'stable';
  if (slope > historicalData[0] * 0.05) {
    trend = 'increasing';
  } else if (slope < -historicalData[0] * 0.05) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  // Calculate moving average for smoothing
  const smoothed = movingAverage(historicalData, 3);
  const lastValue = smoothed[smoothed.length - 1];

  // Generate forecasts
  const forecasts: EmissionForecast[] = [];
  const currentDate = new Date();

  for (let i = 1; i <= horizonMonths; i++) {
    const futureDate = new Date(currentDate);
    futureDate.setMonth(futureDate.getMonth() + i);

    // Simple forecast: last value + trend * periods ahead
    const trendForecast = lastValue + (slope * i);
    
    // Add seasonal component (simplified)
    const month = futureDate.getMonth();
    let seasonalMultiplier = 1;
    if (supplier.material === 'electronics' && (month === 10 || month === 11)) {
      seasonalMultiplier = 1.3;
    } else if (month === 6 || month === 7) {
      seasonalMultiplier = 0.9;
    }

    const predicted = trendForecast * seasonalMultiplier;

    // Confidence intervals (widen over time)
    const uncertainty = predicted * (0.1 + 0.05 * i); // Increases with forecast horizon
    const confidenceLower = predicted - uncertainty;
    const confidenceUpper = predicted + uncertainty;

    forecasts.push({
      date: futureDate,
      predictedEmissions: Math.max(0, predicted),
      confidenceLower: Math.max(0, confidenceLower),
      confidenceUpper: confidenceUpper,
      trend,
    });
  }

  // Detect seasonality
  const seasonality = supplier.material === 'electronics' || supplier.material === 'textiles';

  // Detect anomalies in historical data
  const stdDev = Math.sqrt(
    historicalData.reduce((sum, val) => sum + Math.pow(val - lastValue, 2), 0) / historicalData.length
  );
  const anomaliesDetected = historicalData.filter(val => 
    Math.abs(val - lastValue) > 2 * stdDev
  ).length;

  return {
    supplier,
    forecasts,
    trend,
    trendStrength: Math.min(1, trendStrength),
    seasonality,
    anomaliesDetected,
  };
}

/**
 * Forecast all suppliers
 */
export function forecastAllSuppliers(
  suppliers: Supplier[],
  horizonMonths: number = 6
): ForecastResult[] {
  return suppliers
    .map(supplier => forecastEmissions(supplier, horizonMonths))
    .sort((a, b) => {
      // Prioritize increasing trends with high emission suppliers
      if (a.trend === 'increasing' && b.trend !== 'increasing') return -1;
      if (a.trend !== 'increasing' && b.trend === 'increasing') return 1;
      return b.supplier.totalEmissions - a.supplier.totalEmissions;
    });
}