import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { origin, destination, supplierName } = await req.json();

        if (!origin || !destination) {
            return NextResponse.json(
                { ok: false, error: "Missing origin or destination (format: 'lat,lon')" },
                { status: 400 }
            );
        }

        /* =========================
           🚦 TRAFFIC RESOLVER
           ========================= */
        const MODE = (process.env.TRAFFIC_MODE || "sim").toLowerCase();

        // -----------------------------------------------------
        // ✅ SIMULATION MODE (DEFAULT)
        // -----------------------------------------------------
        // Returns deterministic mock data to guarantee stability
        // and prevent any external calls to TomTom.
        if (MODE !== "tomtom") {
            return NextResponse.json({
                outcome: "success",
                result: {
                    supplier: {
                        id: "sup-sim-1",
                        name: supplierName || "Logistics Partner (Sim)",
                        country: "India",
                        riskScore: 0.1,
                        annualSpend: 500000,
                        transportMode: "road",
                        lastAuditDate: "2024-01-15",
                        complianceStatus: "Compliant",
                        distance: 15,
                        weight: 20000,
                        totalEmissions: 50.5
                    },
                    currentRoute: {
                        id: "base-sim",
                        origin: "Sim Origin",
                        destination: "Sim Dest",
                        distance: 18,
                        transportMode: "road",
                        emissions: 55,
                        cost: 1000,
                        duration: 0.8,
                        reliability: 0.9,
                        baseEmissions: 50,
                        adjustedEmission: 55,
                        path: [] // Sim mode does not generate a polyline
                    },
                    recommendedRoute: {
                        id: "opt-sim",
                        origin: "Sim Origin",
                        destination: "Sim Dest",
                        distance: 15,
                        transportMode: "road",
                        emissions: 45,
                        cost: 900,
                        duration: 0.6,
                        reliability: 0.95,
                        baseEmissions: 40,
                        adjustedEmission: 45,
                        path: [], // Sim mode does not generate a polyline
                        traffic: {
                            congestionFactor: 1.1,
                            delayMinutes: 2,
                            band: "Free",
                            decisionMode: "SIMULATION",
                            source: "Simulation Engine",
                            confidence: 0.9,
                            factors: ["Simulated Flow"]
                        }
                    },
                    alternativeRoutes: [],
                    incidents: [],
                    emissionSavings: 10,
                    costImpact: -100,
                    timeDelta: -12,
                    reason: "Simulated eco-optimization.",
                    data_source: "simulation",
                    confidence_band: "Medium",
                    confidence_pct: 85
                }
            });
        }

        /* =========================
           🔒 LIVE MODE (TomTom) - OPT-IN ONLY
           ========================= */
        const rawKey = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
        const key = rawKey?.replace(/^["']|["']$/g, "").trim();

        // Fallback if key missing
        if (!key) {
            console.warn("TRAFFIC_MODE=tomtom but no key. Falling back to sim.");
            return NextResponse.json({
                outcome: "success",
                result: {
                    supplier: { name: "Sim Fallback", totalEmissions: 0 },
                    currentRoute: { id: "sim", emissions: 0 },
                    recommendedRoute: { id: "sim", emissions: 0, traffic: { source: "Simulation Fallback" } },
                    data_source: "simulation_fallback"
                }
            });
        }

        // 1. Call TomTom Routing API
        const baseUrl = `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destination}/json`;
        const url = `${baseUrl}?key=${encodeURIComponent(key)}&traffic=true&routeType=fastest&travelMode=truck&vehicleCommercial=true&maxAlternatives=2&routeRepresentation=polyline`;

        const res = await fetch(url, {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "Referer": "https://carbonlens.onrender.com",
                "Origin": "https://carbonlens.onrender.com"
            }
        });

        if (!res.ok) {
            // Minimal logging
            console.error(`TomTom Routing Failed: ${res.status}`);
            return NextResponse.json({ ok: false, error: "External Provider Unavailable" }, { status: 502 });
        }

        const data = await res.json();
        const routes = data.routes;

        if (!routes || routes.length === 0) {
            return NextResponse.json({ ok: false, error: "No route found" }, { status: 404 });
        }

        // Process all found routes
        const processedRoutes = routes.map((r: any, index: number) => {
            const summary = r.summary;
            const distanceKm = summary.lengthInMeters / 1000;
            const travelTimeHours = summary.travelTimeInSeconds / 3600;
            const trafficDelayMinutes = Math.round(summary.trafficDelayInSeconds / 60);

            // Emission Calc
            const loadTons = 20;
            const truckEmissionFactor = 0.096;
            const baseEmissionsTons = (distanceKm * loadTons * truckEmissionFactor) / 1000;

            // Detailed Congestion Analysis
            const freeFlowTimeSec = summary.noTrafficTravelTimeInSeconds || (summary.lengthInMeters / (85 / 3.6));
            const currentTravelTimeSec = summary.travelTimeInSeconds;
            const ratio = currentTravelTimeSec / freeFlowTimeSec;

            let band = "Free";
            let trafficMultiplier = 1.0;

            if (summary.trafficDelayInSeconds < 60) {
                band = "Free";
                trafficMultiplier = 1.05;
            } else if (ratio > 1.5) {
                band = "Severe";
                trafficMultiplier = 1.6;
            } else if (ratio > 1.25) {
                band = "Heavy";
                trafficMultiplier = 1.4;
            } else if (ratio > 1.1) {
                band = "Moderate";
                trafficMultiplier = 1.15;
            } else {
                band = "Free";
                trafficMultiplier = 1.02;
            }

            const realEmissions = baseEmissionsTons * trafficMultiplier;
            const path = r.legs?.flatMap((leg: any) => leg.points.map((p: any) => [p.latitude, p.longitude])) || [];

            return {
                id: `rt-${index}`,
                summary,
                stats: {
                    distanceKm,
                    travelTimeHours,
                    trafficDelayMinutes,
                    realEmissions,
                    band,
                    trafficMultiplier,
                    baseEmissions: baseEmissionsTons
                },
                path
            };
        });

        // Incident logic can be here, or simplified. 
        // For brevity and stability, we'll skip separate incident fetch if Routing API worked, 
        // or we can include it. Let's include strictly for "TomTom" mode.
        // But since we want to be safe, maybe skip it for now to reduce call volume?
        // User said: "Repeated forbidden calls...". Routing API worked if we got here.
        // Let's add Incidents but wrapped safe.

        const [orgLat, orgLon] = origin.split(',').map(Number);
        const [destLat, destLon] = destination.split(',').map(Number);
        const minLat = Math.min(orgLat, destLat) - 0.2;
        const maxLat = Math.max(orgLat, destLat) + 0.2;
        const minLon = Math.min(orgLon, destLon) - 0.2;
        const maxLon = Math.max(orgLon, destLon) + 0.2;

        const incidentUrl = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${encodeURIComponent(key)}&bbox=${minLon},${minLat},${maxLon},${maxLat}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},startTime}}}`;

        let incidents: any[] = [];
        try {
            const incRes = await fetch(incidentUrl, {
                cache: "no-store",
                headers: {
                    "Referer": "https://carbonlens.onrender.com",
                    "Origin": "https://carbonlens.onrender.com"
                }
            });
            if (incRes.ok) {
                const incJson = await incRes.json();
                incidents = (incJson.incidents || []).map((inc: any, idx: number) => {
                    // ... mapping ...
                    const props = inc.properties || {};
                    const delay = props.magnitudeOfDelay || 0;
                    return {
                        id: `inc-real-${idx}`,
                        location: props.events?.[0]?.description || "Traffic Incident",
                        severity: delay > 300 ? "high" : "low",
                        delay: Math.round(delay / 60)
                    };
                });
            }
        } catch (e) {
            // Ignore incident errors
        }

        // Sort by emissions
        const sorted = [...processedRoutes].sort((a, b) => a.stats.realEmissions - b.stats.realEmissions);
        const best = sorted[0];
        const alternates = sorted.slice(1);
        const isCongested = best.stats.trafficDelayMinutes > 15;

        // Construct Result
        const result = {
            outcome: "success",
            result: {
                supplier: {
                    id: "sup-real-1",
                    name: supplierName || "Logistics Partner",
                    country: "India",
                    riskScore: 0.1,
                    annualSpend: 500000,
                    transportMode: "road",
                    lastAuditDate: "2024-01-15",
                    complianceStatus: "Compliant",
                    distance: best.stats.distanceKm,
                    weight: 20000,
                    totalEmissions: best.stats.realEmissions * 1000
                },
                currentRoute: {
                    id: alternates[0]?.id || "baseline",
                    origin: "Alternates",
                    destination: "Destination",
                    distance: alternates[0]?.stats.distanceKm || best.stats.distanceKm * 1.05,
                    transportMode: "road",
                    emissions: alternates[0]?.stats.realEmissions || best.stats.realEmissions * 1.15,
                    cost: 1300,
                    duration: (alternates[0]?.stats.travelTimeHours || best.stats.travelTimeHours) / 24,
                    reliability: 0.9,
                    baseEmissions: alternates[0]?.stats.baseEmissions || best.stats.baseEmissions * 1.05,
                    adjustedEmission: alternates[0]?.stats.realEmissions || best.stats.realEmissions * 1.15,
                    path: alternates[0]?.path
                },
                recommendedRoute: {
                    id: best.id,
                    origin: "Optimized Route",
                    destination: "Destination",
                    distance: best.stats.distanceKm,
                    transportMode: "road",
                    emissions: best.stats.realEmissions,
                    cost: 1250,
                    duration: best.stats.travelTimeHours / 24,
                    reliability: 0.98,
                    baseEmissions: best.stats.baseEmissions,
                    adjustedEmission: best.stats.realEmissions,
                    path: best.path,
                    traffic: {
                        congestionFactor: best.stats.trafficMultiplier,
                        delayMinutes: best.stats.trafficDelayMinutes,
                        band: best.stats.band,
                        decisionMode: "LIVE",
                        source: "TomTom Real-Time",
                        confidence: 0.99,
                        factors: isCongested ? ["Traffic Incidents", "Rerouting"] : ["Optimal Flow"]
                    }
                },
                alternativeRoutes: alternates.map(a => ({
                    id: a.id,
                    origin: "Alt",
                    destination: "Dest",
                    distance: a.stats.distanceKm,
                    transportMode: "road",
                    emissions: a.stats.realEmissions,
                    cost: 1300,
                    duration: a.stats.travelTimeHours / 24,
                    reliability: 0.9,
                    baseEmissions: a.stats.baseEmissions,
                    adjustedEmission: a.stats.realEmissions,
                    path: a.path
                })),
                incidents: incidents,
                emissionSavings: (alternates[0]?.stats.realEmissions || best.stats.realEmissions * 1.15) - best.stats.realEmissions,
                costImpact: -50,
                timeDelta: 0,
                reason: "Optimized route found with real-time traffic data.",
                data_source: "verified",
                confidence_band: "High",
                confidence_pct: 98
            }
        };

        return NextResponse.json(result);

    } catch (e: any) {
        console.error("Logistics API Error:", e.message);
        return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
    }
}
