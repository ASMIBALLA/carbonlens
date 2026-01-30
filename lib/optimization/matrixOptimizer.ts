/**
 * Matrix-based supplier → destination optimizer
 * Uses Matrix Routing API adapter
 */

import { fetchRouteMatrix } from "./matrixAdapter";
import { Supplier } from "@/lib/types";

const EMISSION_FACTOR_ROAD = 0.096; // kg CO2e per ton-km

export interface SupplierMatrixOptimization {
  supplierId: string;
  supplierName: string;
  bestDC: string;
  emission: number;
  distanceKm: number;
  durationMin: number;
}

export async function optimizeSupplierDestinations(
  suppliers: Supplier[],
  distributionCenters: string[]
): Promise<SupplierMatrixOptimization[]> {

  if (!suppliers.length || !distributionCenters.length) {
    return [];
  }

  // ⚠️ In production use coordinates — for now using country strings as placeholders
  const origins = suppliers.map(s => s.country);

  const matrix = await fetchRouteMatrix(origins, distributionCenters);

  return suppliers.map((s, i) => {

    let bestIdx = 0;
    let bestEmission = Infinity;

    matrix.matrix[i].forEach((cell, j) => {

      const emission =
        (s.weight * cell.distanceKm * EMISSION_FACTOR_ROAD) / 1000;

      if (emission < bestEmission) {
        bestEmission = emission;
        bestIdx = j;
      }
    });

    const bestCell = matrix.matrix[i][bestIdx];

    return {
      supplierId: s.id,
      supplierName: s.name,
      bestDC: distributionCenters[bestIdx],
      emission: bestEmission,
      distanceKm: bestCell.distanceKm,
      durationMin: bestCell.durationMin,
    };
  });
}
