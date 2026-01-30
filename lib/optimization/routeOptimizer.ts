import { Supplier, TransportMode } from "@/lib/types";
import { evaluateRouteWithTraffic } from "@/lib/optimization/orchestratedRouteEval";

export interface Route {
  id: string;
  origin: string;
  destination: string;
  distance: number; // km
  transportMode: TransportMode;
  emissions: number; // base tons CO2e
  cost: number; // USD
  duration: number; // days
  reliability: number; // 0-1
}

export interface RouteOptimizationResult {
  supplier: Supplier;

  currentRoute: Route & {
    adjustedEmission?: number;
  };

  alternativeRoutes: Array<Route & { adjustedEmission?: number }>;

  recommendedRoute: Route & {
    adjustedEmission?: number;
    traffic?: {
      congestionFactor: number;
      delayMinutes: number;
      band: string;
      decisionMode: string;
      source: string;
      confidence: number;
      factors: string[];
    };
  };

  emissionSavings: number;
  costImpact: number;
  timeDelta: number;
  reason: string;

  // UI badges
  data_source: "verified" | "estimated";
  confidence_band: "High" | "Medium" | "Low";
  confidence_pct: number;
}

const EMISSION_FACTORS: Record<TransportMode, number> = {
  air: 1.13,
  sea: 0.016,
  road: 0.096,
  rail: 0.028,
};

function generateRouteAlternatives(supplier: Supplier): Route[] {
  const modes: TransportMode[] = ["air", "sea", "road", "rail"];

  return modes.map((mode) => {
    let distanceMultiplier = 1.0;
    let costMultiplier = 1.0;
    let durationDays = 7;
    let reliability = 0.95;

    switch (mode) {
      case "air":
        distanceMultiplier = 0.9;
        costMultiplier = 5.0;
        durationDays = 2;
        reliability = 0.9;
        break;
      case "sea":
        distanceMultiplier = 1.3;
        costMultiplier = 1.0;
        durationDays = 35;
        reliability = 0.95;
        break;
      case "road":
        distanceMultiplier = 1.1;
        costMultiplier = 2.5;
        durationDays = 10;
        reliability = 0.92;
        break;
      case "rail":
        distanceMultiplier = 1.2;
        costMultiplier = 1.5;
        durationDays = 14;
        reliability = 0.98;
        break;
    }

    const distance = supplier.distance * distanceMultiplier;
    const emissions = (supplier.weight * distance * EMISSION_FACTORS[mode]) / 1000;
    const cost = (supplier.annualSpend * 0.3) * costMultiplier;

    return {
      id: `${supplier.id}-${mode}`,
      origin: supplier.country,
      destination: "Distribution Center",
      distance,
      transportMode: mode,
      emissions,
      cost,
      duration: durationDays,
      reliability,
    };
  });
}

function confidenceBand(pct: number): "High" | "Medium" | "Low" {
  if (pct >= 70) return "High";
  if (pct >= 45) return "Medium";
  return "Low";
}

function scoreBalanced(route: Route, adjEmission?: number) {
  const e = (adjEmission ?? route.emissions) + 1;
  const c = route.cost + 1;
  const t = route.duration + 1;
  return (1 / e) * 0.5 + (1 / c) * 0.3 + (1 / t) * 0.2;
}

export async function optimizeRouteWithTraffic(
  supplier: Supplier,
  trafficPoint: string,
  baseDurationMin = 60
): Promise<RouteOptimizationResult> {
  const routes = generateRouteAlternatives(supplier);
  const currentRoute = routes.find((r) => r.transportMode === supplier.transportMode) ?? routes[0];

  const enriched = await Promise.all(
    routes.map(async (route) => {
      if (route.transportMode !== "road") {
        return { route, adjustedEmission: route.emissions, traffic: null as any };
      }

      const t = await evaluateRouteWithTraffic({
        point: trafficPoint,
        baseEmission: route.emissions,
        baseDurationMin,
        confidenceScore: 0.9,
      });

      return {
        route,
        adjustedEmission: t.adjustedEmission,
        traffic: {
          congestionFactor: t.congestionFactor,
          delayMinutes: t.delayMinutes,
          band: t.band,
          decisionMode: t.decisionMode,
          source: t.source,
          confidence: t.confidence,
          factors: t.factors,
        },
      };
    })
  );

  const scored = enriched
    .map((x) => ({
      ...x,
      score: scoreBalanced(x.route, x.adjustedEmission),
    }))
    .sort((a, b) => b.score - a.score);

  const recommended = scored[0];
  const alternatives = scored.slice(1);

  const currAdj =
    enriched.find((x) => x.route.id === currentRoute.id)?.adjustedEmission ?? currentRoute.emissions;
  const recAdj = recommended.adjustedEmission ?? recommended.route.emissions;

  const emissionSavings = currAdj - recAdj;
  const costImpact = recommended.route.cost - currentRoute.cost;
  const timeDelta = recommended.route.duration - currentRoute.duration;

  const confPct = recommended.traffic?.confidence != null ? Math.round(recommended.traffic.confidence * 100) : 72;
  const data_source = recommended.traffic?.source === "Verified" ? "verified" : "estimated";

  const reason =
    recommended.route.transportMode === currentRoute.transportMode
      ? `Current route is optimal under current traffic conditions. Confidence: ${confPct}%.`
      : `Switch ${currentRoute.transportMode} → ${recommended.route.transportMode} to reduce emissions under live traffic. Savings: ${Math.max(0, emissionSavings).toFixed(
          2
        )} tons CO2e. Confidence: ${confPct}%.`;

  return {
    supplier,
    currentRoute: { ...currentRoute, adjustedEmission: currAdj },
    alternativeRoutes: alternatives.map((a) => ({ ...a.route, adjustedEmission: a.adjustedEmission })),
    recommendedRoute: { ...recommended.route, adjustedEmission: recAdj, traffic: recommended.traffic ?? undefined },
    emissionSavings,
    costImpact,
    timeDelta,
    reason,
    data_source,
    confidence_band: confidenceBand(confPct),
    confidence_pct: confPct,
  };
}

export async function optimizeAllRoutesWithTraffic(
  suppliers: Supplier[],
  trafficPoint: string,
  threshold = 1000
): Promise<RouteOptimizationResult[]> {
  const targets = suppliers.filter((s) => s.totalEmissions > threshold);
  const results = await Promise.all(targets.map((s) => optimizeRouteWithTraffic(s, trafficPoint, 60)));

  return results
    .filter((r) => r.emissionSavings > 0)
    .sort((a, b) => b.emissionSavings - a.emissionSavings);
}
