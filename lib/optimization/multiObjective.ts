/**
 * Multi-Objective Optimization Engine
 * Optimizes for: Carbon reduction, Cost, Delivery time (SLA)
 */

import { Supplier } from '../types';

export interface OptimizationObjective {
  weight: number; // 0-1, importance of this objective
  name: string;
  type: 'minimize' | 'maximize';
}

export interface OptimizationConstraint {
  type: 'max_cost_increase' | 'min_delivery_time' | 'min_quality_score' | 'max_supplier_changes';
  value: number;
}

export interface OptimizationSolution {
  supplierAllocations: Map<string, number>; // supplier ID -> allocation weight (0-1)
  objectives: {
    emissionReduction: number; // tons CO2e saved
    costImpact: number; // USD (negative = savings)
    deliveryTimeImpact: number; // days (negative = faster)
  };
  feasible: boolean;
  score: number; // Overall solution quality (0-1)
  changes: SupplierChange[];
}

export interface SupplierChange {
  originalSupplier: Supplier;
  newSupplier?: Supplier;
  action: 'replace' | 'reduce_allocation' | 'increase_allocation' | 'change_transport_mode';
  allocationChange: number; // Percentage change
  emissionImpact: number;
  costImpact: number;
  reason: string;
}

export interface OptimizationConfig {
  objectives: {
    carbonReduction: OptimizationObjective;
    costMinimization: OptimizationObjective;
    deliveryTime: OptimizationObjective;
  };
  constraints: OptimizationConstraint[];
  allowSupplierChanges: boolean;
  allowTransportModeChanges: boolean;
  maxIterations: number;
}

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  objectives: {
    carbonReduction: { weight: 0.6, name: 'Carbon Reduction', type: 'minimize' },
    costMinimization: { weight: 0.3, name: 'Cost Minimization', type: 'minimize' },
    deliveryTime: { weight: 0.1, name: 'Delivery Time', type: 'minimize' },
  },
  constraints: [
    { type: 'max_cost_increase', value: 0.10 }, // Max 10% cost increase
    { type: 'min_delivery_time', value: 30 }, // Min 30 days delivery allowed
    { type: 'max_supplier_changes', value: 0.20 }, // Max 20% of suppliers can be changed
  ],
  allowSupplierChanges: true,
  allowTransportModeChanges: true,
  maxIterations: 1000,
};

/**
 * Calculate emission reduction from transport mode switch
 */
function calculateTransportModeSwitch(
  supplier: Supplier,
  newMode: 'air' | 'sea' | 'road' | 'rail'
): { emissionChange: number; costChange: number; timeChange: number } {
  const EMISSION_FACTORS = {
    air: 1.13,
    sea: 0.016,
    road: 0.096,
    rail: 0.028,
  };

  const COST_FACTORS = {
    air: 1.0,
    sea: 0.2, // 80% cheaper
    road: 0.5,
    rail: 0.3,
  };

  const TIME_FACTORS = {
    air: 1.0,
    sea: 5.0, // 5x slower
    road: 2.0,
    rail: 3.0,
  };

  const currentEmissions = supplier.weight * supplier.distance * EMISSION_FACTORS[supplier.transportMode];
  const newEmissions = supplier.weight * supplier.distance * EMISSION_FACTORS[newMode];
  const emissionChange = (newEmissions - currentEmissions) / 1000; // Convert to tons

  const currentCost = supplier.annualSpend * 0.3; // Assume 30% is transport
  const costChange = currentCost * (COST_FACTORS[newMode] - COST_FACTORS[supplier.transportMode]);

  const currentTime = 7; // Baseline 7 days
  const timeChange = currentTime * (TIME_FACTORS[newMode] - TIME_FACTORS[supplier.transportMode]);

  return { emissionChange, costChange, timeChange };
}

/**
 * Generate alternative suppliers (simulated)
 * In production, this would query a supplier database
 */
function generateAlternativeSuppliers(originalSupplier: Supplier): Supplier[] {
  const alternatives: Supplier[] = [];

  // Generate 2-3 alternatives with different characteristics
  const alternativeConfigs = [
    {
      namePrefix: 'Regional',
      distanceMultiplier: 0.4, // 60% closer
      costMultiplier: 1.15, // 15% more expensive
      transportMode: 'road' as const,
      material: originalSupplier.material,
    },
    {
      namePrefix: 'Eco-Certified',
      distanceMultiplier: 0.7,
      costMultiplier: 1.25, // 25% premium for green supplier
      transportMode: 'rail' as const,
      material: originalSupplier.material,
      emissionReduction: 0.3, // 30% lower emissions
    },
    {
      namePrefix: 'Budget',
      distanceMultiplier: 1.2, // 20% farther
      costMultiplier: 0.85, // 15% cheaper
      transportMode: 'sea' as const,
      material: originalSupplier.material,
    },
  ];

  alternativeConfigs.forEach((config, idx) => {
    const newDistance = originalSupplier.distance * config.distanceMultiplier;
    const newCost = originalSupplier.annualSpend * config.costMultiplier;
    const newWeight = originalSupplier.weight * (0.9 + Math.random() * 0.2); // ±10% variance

    // Calculate emissions
    const EMISSION_FACTORS = {
      air: 1.13,
      sea: 0.016,
      road: 0.096,
      rail: 0.028,
    };

    const MATERIAL_FACTORS: { [key: string]: number } = {
      steel: 1.85,
      aluminum: 8.24,
      plastic: 3.14,
      electronics: 12.5,
      textiles: 5.5,
      food: 2.5,
      paper: 1.1,
      chemicals: 2.8,
    };

    const transportEmissions = newWeight * newDistance * EMISSION_FACTORS[config.transportMode];
    const materialKey = config.material ?? 'default';
    const materialFactor = MATERIAL_FACTORS[materialKey] || 2.0;
    const materialEmissions = newWeight * 1000 * materialFactor;
    let totalEmissions = (transportEmissions + materialEmissions) / 1000;

    if (config.emissionReduction) {
      totalEmissions *= (1 - config.emissionReduction);
    }

    const alternative: Supplier = {
      id: `${originalSupplier.id}-ALT${idx + 1}`,
      name: `${config.namePrefix} ${originalSupplier.category} Supplier`,
      category: originalSupplier.category,
      country: originalSupplier.country,
      coordinates: originalSupplier.coordinates,
      annualSpend: newCost,
      weight: newWeight,
      distance: newDistance,
      transportMode: config.transportMode,
      material: config.material,
      emissionFactor: EMISSION_FACTORS[config.transportMode],
      totalEmissions,
      emissionIntensity: (totalEmissions * 1000) / newCost,
    };

    alternatives.push(alternative);
  });

  return alternatives;
}

/**
 * Evaluate a solution against constraints
 */
function evaluateConstraints(
  solution: OptimizationSolution,
  config: OptimizationConfig,
  totalCost: number
): boolean {
  for (const constraint of config.constraints) {
    switch (constraint.type) {
      case 'max_cost_increase':
        const costIncreasePct = solution.objectives.costImpact / totalCost;
        if (costIncreasePct > constraint.value) return false;
        break;

      case 'min_delivery_time':
        if (solution.objectives.deliveryTimeImpact > constraint.value) return false;
        break;

      case 'max_supplier_changes':
        const changeCount = solution.changes.filter(c => c.action === 'replace').length;
        const totalSuppliers = solution.supplierAllocations.size;
        if (changeCount / totalSuppliers > constraint.value) return false;
        break;
    }
  }
  return true;
}

/**
 * Calculate solution score based on weighted objectives
 */
function calculateScore(
  solution: OptimizationSolution,
  config: OptimizationConfig
): number {
  const { objectives } = solution;
  const { carbonReduction, costMinimization, deliveryTime } = config.objectives;

  // Normalize values (0-1 scale)
  const normalizedEmission = Math.min(1, Math.abs(objectives.emissionReduction) / 10000);
  const normalizedCost = Math.min(1, Math.abs(objectives.costImpact) / 1000000);
  const normalizedTime = Math.min(1, Math.abs(objectives.deliveryTimeImpact) / 30);

  const score =
    carbonReduction.weight * normalizedEmission +
    costMinimization.weight * (1 - normalizedCost) + // Invert for minimization
    deliveryTime.weight * (1 - normalizedTime);

  return score;
}

/**
 * Main optimization function
 */
export function optimizeSupplierMix(
  suppliers: Supplier[],
  config: OptimizationConfig = DEFAULT_OPTIMIZATION_CONFIG
): OptimizationSolution {
  const changes: SupplierChange[] = [];
  let totalEmissionReduction = 0;
  let totalCostImpact = 0;
  let totalTimeImpact = 0;

  const totalCost = suppliers.reduce((sum, s) => sum + s.annualSpend, 0);
  const supplierAllocations = new Map<string, number>();

  // Initialize all suppliers with 100% allocation
  suppliers.forEach(s => supplierAllocations.set(s.id, 1.0));

  // Sort suppliers by emission impact (highest first)
  const sortedSuppliers = [...suppliers].sort((a, b) => b.totalEmissions - a.totalEmissions);

  // Optimize top emitters
  for (const supplier of sortedSuppliers.slice(0, 10)) {
    let bestChange: SupplierChange | null = null;
    let bestImpact = 0;

    // Option 1: Change transport mode
    if (config.allowTransportModeChanges && supplier.transportMode === 'air') {
      const seaSwitch = calculateTransportModeSwitch(supplier, 'sea');

      if (seaSwitch.emissionChange < 0) { // Reduction
        const change: SupplierChange = {
          originalSupplier: supplier,
          action: 'change_transport_mode',
          allocationChange: 0,
          emissionImpact: seaSwitch.emissionChange,
          costImpact: seaSwitch.costChange,
          reason: `Switch from air to sea freight - ${Math.abs(seaSwitch.emissionChange).toFixed(2)} tons CO2e saved`,
        };

        if (Math.abs(seaSwitch.emissionChange) > bestImpact) {
          bestImpact = Math.abs(seaSwitch.emissionChange);
          bestChange = change;
        }
      }
    }

    // Option 2: Replace with alternative supplier
    if (config.allowSupplierChanges) {
      const alternatives = generateAlternativeSuppliers(supplier);

      for (const alt of alternatives) {
        const emissionReduction = supplier.totalEmissions - alt.totalEmissions;
        const costChange = alt.annualSpend - supplier.annualSpend;

        if (emissionReduction > 0) {
          const change: SupplierChange = {
            originalSupplier: supplier,
            newSupplier: alt,
            action: 'replace',
            allocationChange: -100,
            emissionImpact: -emissionReduction,
            costImpact: costChange,
            reason: `Replace with ${alt.name} - ${emissionReduction.toFixed(2)} tons CO2e saved`,
          };

          if (emissionReduction > bestImpact) {
            bestImpact = emissionReduction;
            bestChange = change;
          }
        }
      }
    }

    // Apply best change if found
    if (bestChange) {
      changes.push(bestChange);
      totalEmissionReduction += Math.abs(bestChange.emissionImpact);
      totalCostImpact += bestChange.costImpact;

      if (bestChange.action === 'replace' && bestChange.newSupplier) {
        supplierAllocations.set(supplier.id, 0);
        supplierAllocations.set(bestChange.newSupplier.id, 1.0);
      }
    }
  }

  const solution: OptimizationSolution = {
    supplierAllocations,
    objectives: {
      emissionReduction: totalEmissionReduction,
      costImpact: totalCostImpact,
      deliveryTimeImpact: totalTimeImpact,
    },
    feasible: true,
    score: 0,
    changes,
  };

  // Check constraints
  solution.feasible = evaluateConstraints(solution, config, totalCost);

  // Calculate score
  solution.score = calculateScore(solution, config);

  return solution;
}

/**
 * Generate multiple optimization scenarios
 */
export function generateOptimizationScenarios(
  suppliers: Supplier[]
): { aggressive: OptimizationSolution; balanced: OptimizationSolution; conservative: OptimizationSolution } {
  // Aggressive: Maximize carbon reduction
  const aggressive = optimizeSupplierMix(suppliers, {
    ...DEFAULT_OPTIMIZATION_CONFIG,
    objectives: {
      carbonReduction: { weight: 0.8, name: 'Carbon Reduction', type: 'minimize' },
      costMinimization: { weight: 0.1, name: 'Cost', type: 'minimize' },
      deliveryTime: { weight: 0.1, name: 'Delivery', type: 'minimize' },
    },
    constraints: [
      { type: 'max_cost_increase', value: 0.25 }, // Allow 25% cost increase
    ],
  });

  // Balanced: Equal weighting
  const balanced = optimizeSupplierMix(suppliers, DEFAULT_OPTIMIZATION_CONFIG);

  // Conservative: Minimize disruption
  const conservative = optimizeSupplierMix(suppliers, {
    ...DEFAULT_OPTIMIZATION_CONFIG,
    objectives: {
      carbonReduction: { weight: 0.4, name: 'Carbon Reduction', type: 'minimize' },
      costMinimization: { weight: 0.5, name: 'Cost', type: 'minimize' },
      deliveryTime: { weight: 0.1, name: 'Delivery', type: 'minimize' },
    },
    constraints: [
      { type: 'max_cost_increase', value: 0.05 }, // Max 5% cost increase
      { type: 'max_supplier_changes', value: 0.10 }, // Max 10% supplier changes
    ],
    allowSupplierChanges: false, // Only allow transport mode changes
  });

  return { aggressive, balanced, conservative };
}