/**
 * Supplier Clustering for Better Estimation
 * Groups suppliers by emission profiles
 */

import { Supplier } from '../types';

export interface SupplierCluster {
  id: number;
  name: string;
  suppliers: Supplier[];
  avgEmissions: number;
  avgEmissionIntensity: number;
  characteristics: string[];
}

export interface ClusteringResult {
  clusters: SupplierCluster[];
  assignments: Map<string, number>; // supplier ID -> cluster ID
  silhouetteScore: number; // Quality metric (0-1, higher is better)
}

/**
 * Simple K-means clustering implementation
 */
function kMeansClustering(
  data: number[][], 
  k: number, 
  maxIterations: number = 100
): number[] {
  const n = data.length;
  const dim = data[0].length;

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * n);
    if (!usedIndices.has(idx)) {
      centroids.push([...data[idx]]);
      usedIndices.add(idx);
    }
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to nearest centroid
    const newAssignments = data.map((point) => {
      let minDist = Infinity;
      let cluster = 0;
      
      centroids.forEach((centroid, c) => {
        const dist = euclideanDistance(point, centroid);
        if (dist < minDist) {
          minDist = dist;
          cluster = c;
        }
      });
      
      return cluster;
    });

    // Check convergence
    if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
      break;
    }

    assignments = newAssignments;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterPoints = data.filter((_, i) => assignments[i] === c);
      if (clusterPoints.length > 0) {
        for (let d = 0; d < dim; d++) {
          centroids[c][d] = clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length;
        }
      }
    }
  }

  return assignments;
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

function calculateSilhouetteScore(data: number[][], assignments: number[]): number {
  // Simplified silhouette score calculation
  let totalScore = 0;
  const n = data.length;

  for (let i = 0; i < n; i++) {
    const cluster = assignments[i];
    
    // Calculate a(i): average distance to points in same cluster
    const sameCluster = data.filter((_, j) => assignments[j] === cluster && i !== j);
    const a = sameCluster.length > 0
      ? sameCluster.reduce((sum, point) => sum + euclideanDistance(data[i], point), 0) / sameCluster.length
      : 0;

    // Calculate b(i): min average distance to points in other clusters
    const clusters = Array.from(new Set(assignments));
    let b = Infinity;
    
    for (const otherCluster of clusters) {
      if (otherCluster === cluster) continue;
      const otherPoints = data.filter((_, j) => assignments[j] === otherCluster);
      if (otherPoints.length > 0) {
        const avgDist = otherPoints.reduce((sum, point) => sum + euclideanDistance(data[i], point), 0) / otherPoints.length;
        b = Math.min(b, avgDist);
      }
    }

    // Silhouette coefficient for point i
    const s = b === Infinity ? 0 : (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / n;
}

/**
 * Normalize features to 0-1 range
 */
function normalizeFeatures(features: number[][]): number[][] {
  const dim = features[0].length;
  const mins = new Array(dim).fill(Infinity);
  const maxs = new Array(dim).fill(-Infinity);

  // Find min/max for each dimension
  features.forEach(point => {
    point.forEach((val, d) => {
      mins[d] = Math.min(mins[d], val);
      maxs[d] = Math.max(maxs[d], val);
    });
  });

  // Normalize
  return features.map(point =>
    point.map((val, d) => {
      const range = maxs[d] - mins[d];
      return range > 0 ? (val - mins[d]) / range : 0;
    })
  );
}

/**
 * Extract features for clustering
 */
function extractFeatures(supplier: Supplier): number[] {
  return [
    supplier.totalEmissions / 1000, // Scale down
    supplier.emissionIntensity,
    supplier.distance / 1000,
    supplier.weight / 100,
    supplier.transportMode === 'air' ? 1 : 0,
    supplier.transportMode === 'sea' ? 1 : 0,
  ];
}

/**
 * Main clustering function
 */
export function clusterSuppliers(suppliers: Supplier[], numClusters: number = 3): ClusteringResult {
  if (suppliers.length < numClusters) {
    numClusters = Math.max(1, suppliers.length);
  }

  // Extract and normalize features
  const features = suppliers.map(extractFeatures);
  const normalizedFeatures = normalizeFeatures(features);

  // Perform clustering
  const assignments = kMeansClustering(normalizedFeatures, numClusters);

  // Calculate silhouette score
  const silhouetteScore = calculateSilhouetteScore(normalizedFeatures, assignments);

  // Build clusters
  const clusters: SupplierCluster[] = [];
  const assignmentMap = new Map<string, number>();

  for (let c = 0; c < numClusters; c++) {
    const clusterSuppliers = suppliers.filter((_, i) => assignments[i] === c);
    
    if (clusterSuppliers.length === 0) continue;

    const avgEmissions = clusterSuppliers.reduce((sum, s) => sum + s.totalEmissions, 0) / clusterSuppliers.length;
    const avgIntensity = clusterSuppliers.reduce((sum, s) => sum + s.emissionIntensity, 0) / clusterSuppliers.length;

    // Identify cluster characteristics
    const characteristics: string[] = [];
    const transportModes = clusterSuppliers.map(s => s.transportMode);
    const dominantMode = transportModes.sort((a, b) =>
      transportModes.filter(v => v === a).length - transportModes.filter(v => v === b).length
    ).pop();
    
    if (dominantMode) {
      characteristics.push(`Primarily ${dominantMode} transport`);
    }

    if (avgEmissions > 5000) {
      characteristics.push('High emission profile');
    } else if (avgEmissions > 2000) {
      characteristics.push('Medium emission profile');
    } else {
      characteristics.push('Low emission profile');
    }

    if (avgIntensity > 5) {
      characteristics.push('Emission-intensive operations');
    }

    const clusterName = avgEmissions > 5000 ? 'High Emitters' :
                        avgEmissions > 2000 ? 'Medium Emitters' : 'Low Emitters';

    clusters.push({
      id: c,
      name: clusterName,
      suppliers: clusterSuppliers,
      avgEmissions,
      avgEmissionIntensity: avgIntensity,
      characteristics,
    });

    // Record assignments
    clusterSuppliers.forEach(s => assignmentMap.set(s.id, c));
  }

  return {
    clusters,
    assignments: assignmentMap,
    silhouetteScore,
  };
}

/**
 * Estimate emissions for a supplier with missing data
 * Uses cluster averages from similar suppliers
 */
export function estimateEmissionsFromCluster(
  partialSupplier: Partial<Supplier>,
  clusteringResult: ClusteringResult
): { estimatedEmissions: number; confidence: number; cluster: SupplierCluster } {
  // Find most similar cluster based on available features
  let bestCluster = clusteringResult.clusters[0];
  let minDistance = Infinity;

  for (const cluster of clusteringResult.clusters) {
    let distance = 0;
    let featureCount = 0;

    // Compare available features
    if (partialSupplier.transportMode) {
      const modeMatch = cluster.suppliers.filter(s => s.transportMode === partialSupplier.transportMode).length;
      distance += (1 - modeMatch / cluster.suppliers.length);
      featureCount++;
    }

    if (partialSupplier.category) {
      const catMatch = cluster.suppliers.filter(s => s.category === partialSupplier.category).length;
      distance += (1 - catMatch / cluster.suppliers.length);
      featureCount++;
    }

    if (featureCount > 0) {
      distance /= featureCount;
      if (distance < minDistance) {
        minDistance = distance;
        bestCluster = cluster;
      }
    }
  }

  // Use cluster average as estimate
  const estimatedEmissions = bestCluster.avgEmissions;
  
  // Confidence based on cluster quality and similarity
  const confidence = (1 - minDistance) * clusteringResult.silhouetteScore;

  return {
    estimatedEmissions,
    confidence: Math.max(0.1, Math.min(0.9, confidence)),
    cluster: bestCluster,
  };
}