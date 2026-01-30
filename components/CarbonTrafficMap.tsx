import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// =====================
// Types
// =====================
interface TrafficIncident {
  id: string;
  type: "accident" | "construction" | "congestion" | "weather";
  location: string;
  coordinates: [number, number];
  severity: "low" | "medium" | "high";
  delay: number;
  emissionsImpact: number; // kg CO2e added due to idling/detours
  timestamp: Date;
}

interface RouteSegment {
  id: string;
  path: [number, number][];
  band: "Free" | "Moderate" | "Heavy" | "Severe";
  multiplier: number;
  confidence: number;
  baseEmissions: number;
  adjustedEmissions: number;
  deltaEmissions: number;
}

type RouteOption = {
  id: string;
  name: string;
  segments: RouteSegment[];
  kind?: "primary" | "alt";
};

interface CarbonTrafficMapProps {
  // Backwards-compatible single route input
  route?: RouteSegment[];

  // NEW: multi-route input (primary + alternatives)
  routes?: RouteOption[];

  incidents?: TrafficIncident[];
  animated?: boolean;

  // Optional: allow selecting primary route from outside
  activeRouteId?: string;
  onRouteSelect?: (routeId: string) => void;

  source?: { label?: string; coord: [number, number] };
  destination?: { label?: string; coord: [number, number] };
  autoPickBestRoute?: boolean; // default false

}

/** ====== Chennai live mode toggles ====== **/
const ENABLE_CHENNAI_LIVE =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_CHENNAI_LIVE === "1" || process.env.NEXT_PUBLIC_CHENNAI_LIVE === "true");

const TOMTOM_PUBLIC_KEY =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_TOMTOM_API_KEY : undefined;

/** NEW: Chennai hotspots for metrics panel **/
type Hotspot = { id: string; name: string; lat: number; lon: number; hint?: string };
type HotspotFlow = {
  currentSpeedKmph?: number;
  freeFlowSpeedKmph?: number;
  currentTravelTimeSec?: number;
  freeFlowTravelTimeSec?: number;
  confidence?: number;
  roadClosure?: boolean;
};
type HotspotResult =
  | { id: string; name: string; lat: number; lon: number; ok: true; flow: HotspotFlow; fetchedAt: string }
  | { id: string; name: string; lat: number; lon: number; ok: false; error: { status: number; body: string } };

const CHENNAI_HOTSPOTS: Hotspot[] = [
  { id: "tnagar", name: "T Nagar", lat: 13.0418, lon: 80.2337, hint: "Retail + peak-hour choke points" },
  { id: "guindy", name: "Guindy", lat: 13.0109, lon: 80.2123, hint: "GST corridor + industrial traffic" },
  { id: "adyar", name: "Adyar", lat: 13.0067, lon: 80.2575, hint: "Bridge + school zones" },
  { id: "velachery", name: "Velachery", lat: 12.9756, lon: 80.2212, hint: "IT commute + mall traffic" },
  { id: "annanagar", name: "Anna Nagar", lat: 13.085, lon: 80.2101, hint: "Residential arterials" },
  { id: "egmore", name: "Egmore", lat: 13.0784, lon: 80.261, hint: "Central junctions" },
  { id: "mylapore", name: "Mylapore", lat: 13.0339, lon: 80.269, hint: "Dense inner streets" },
  { id: "porur", name: "Porur", lat: 13.0374, lon: 80.1567, hint: "Ring-road spillover" },
];

// =====================
// Animation helpers
// =====================
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const bandFromSpeed = (speedKmph?: number) => {
  if (typeof speedKmph !== "number") return { band: "Moderate" as const, multiplier: 1.18 };
  if (speedKmph > 35) return { band: "Free" as const, multiplier: 1.02 };
  if (speedKmph > 25) return { band: "Moderate" as const, multiplier: 1.18 };
  if (speedKmph > 15) return { band: "Heavy" as const, multiplier: 1.45 };
  return { band: "Severe" as const, multiplier: 1.6 };
};

const routeTotals = (segs: RouteSegment[]) => {
  const total = segs.reduce((s, x) => s + x.adjustedEmissions, 0);
  const delta = segs.reduce((s, x) => s + x.deltaEmissions, 0);
  const base = segs.reduce((s, x) => s + x.baseEmissions, 0);
  return { total, delta, base };
};

const getBandColor = (band: string) => {
  switch (band) {
    case "Free":
      return "#10b981";
    case "Moderate":
      return "#f59e0b";
    case "Heavy":
      return "#ef4444";
    case "Severe":
      return "#991b1b";
    default:
      return "#6b7280";
  }
};

const severityClass = (severity: string) => {
  switch (severity) {
    case "high":
      return "bg-red-500/10 border-red-500/30";
    case "medium":
      return "bg-amber-500/10 border-amber-500/30";
    case "low":
      return "bg-blue-500/10 border-blue-500/30";
    default:
      return "bg-slate-800/40 border-slate-700";
  }
};

const severityTextClass = (severity: string) => {
  switch (severity) {
    case "high":
      return "text-red-300";
    case "medium":
      return "text-amber-300";
    case "low":
      return "text-blue-300";
    default:
      return "text-slate-300";
  }
};

const severityChipClass = (severity: string) => {
  switch (severity) {
    case "high":
      return "border-red-500/30 bg-red-500/10";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10";
    case "low":
      return "border-blue-500/30 bg-blue-500/10";
    default:
      return "border-slate-600/40 bg-slate-900/30";
  }
};



const formatTimestamp = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
};

const getIncidentIcon = (incident: TrafficIncident) => {
  const iconMap = {
    accident: "🚨",
    construction: "🚧",
    weather: "🌧️",
    congestion: "🚗",
  } as const;

  return L.divIcon({
    className: "incident-icon",
    html: `
      <div style="
        font-size: 24px;
        text-align: center;
        animation: bounce-incident 2s ease-in-out infinite;
      ">
        ${iconMap[incident.type]}
      </div>
    `,
    iconSize: [30, 30],
  });
};

// =====================
// Existing particle marker (extended via “intensity”)
// =====================
const EmissionsFlowMarker: React.FC<{
  path: [number, number][];
  color: string;
  emissionRate: number; // bigger = faster
  intensity: number; // bigger = brighter glow & size
  zIndexOffset?: number;
}> = ({ path, color, emissionRate, intensity, zIndexOffset = 0 }) => {
  const map = useMap();
  const [position, setPosition] = useState(0);

  useEffect(() => {
    // Faster movement = higher emissions (but slowed overall)
    const base = 12000; // ← doubled baseline → slower everywhere

    const speedFactor = clamp(emissionRate, 0.6, 2.0); // slightly tighter cap
    const duration = base / speedFactor;

    const steps = 200; // more steps = smoother + visually slower
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep = (currentStep + 1) % steps;
      setPosition(currentStep / steps);
    }, duration / steps);

    return () => clearInterval(interval);
  }, [emissionRate]);


  const getPointAlongPath = (progress: number) => {
    const totalSegments = path.length - 1;
    const segmentIndex = Math.floor(progress * totalSegments);
    const segmentProgress = progress * totalSegments - segmentIndex;

    if (segmentIndex >= path.length - 1) return path[path.length - 1];

    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];

    return [
      start[0] + (end[0] - start[0]) * segmentProgress,
      start[1] + (end[1] - start[1]) * segmentProgress,
    ] as [number, number];
  };

  const currentPos = getPointAlongPath(position);

  const size = Math.round(10 + clamp(intensity, 0, 2.5) * 6); // 10..25ish
  const glow = 10 + clamp(intensity, 0, 2.5) * 18;

  const emissionIcon = L.divIcon({
    className: "emission-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.82);
      box-shadow: 0 0 ${glow}px ${color};
      animation: pulse-emission 1.05s ease-in-out infinite;
      opacity: 0.95;
    "></div>`,
    iconSize: [size, size],
  });

  return <Marker position={currentPos} icon={emissionIcon} zIndexOffset={zIndexOffset} />;
};

// =====================
// Main component
// =====================
const CarbonTrafficMap: React.FC<CarbonTrafficMapProps> = ({
  route,
  routes,
  incidents,
  animated = true,
  activeRouteId,
  onRouteSelect,
  source,
  destination,
  autoPickBestRoute = false,
  
}) => {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  /** ====== hotspot metrics state (Chennai mode) ====== **/
  const [hotspotResults, setHotspotResults] = useState<Record<string, HotspotResult>>({});
  const [hotspotLastUpdated, setHotspotLastUpdated] = useState<string>("");
  const [hotspotLoading, setHotspotLoading] = useState<boolean>(false);


  
  /** NEW: cache-buster tick for traffic overlay tiles */
  const [tileTick, setTileTick] = useState<number>(0);

  // ===== LIVE DATA STATE (optional, if you later compute real routes/incidents) =====
  const [liveRoutes, setLiveRoutes] = useState<RouteOption[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<TrafficIncident[]>([]);

  // =====================
  // Demo routes/incidents
  // =====================
  const demoRoute: RouteSegment[] = [
    {
      id: "seg-1",
      path: [
        [37.7749, -122.4194],
        [37.8044, -122.2712],
      ],
      band: "Free",
      multiplier: 1.02,
      confidence: 0.92,
      baseEmissions: 45,
      adjustedEmissions: 45.9,
      deltaEmissions: 0.9,
    },
    {
      id: "seg-2",
      path: [
        [37.8044, -122.2712],
        [37.8716, -122.2727],
      ],
      band: "Moderate",
      multiplier: 1.18,
      confidence: 0.85,
      baseEmissions: 32,
      adjustedEmissions: 37.8,
      deltaEmissions: 5.8,
    },
    {
      id: "seg-3",
      path: [
        [37.8716, -122.2727],
        [37.9577, -122.3477],
      ],
      band: "Heavy",
      multiplier: 1.45,
      confidence: 0.78,
      baseEmissions: 52,
      adjustedEmissions: 75.4,
      deltaEmissions: 23.4,
    },
    {
      id: "seg-4",
      path: [
        [37.9577, -122.3477],
        [38.0293, -122.2416],
      ],
      band: "Moderate",
      multiplier: 1.21,
      confidence: 0.88,
      baseEmissions: 38,
      adjustedEmissions: 46,
      deltaEmissions: 8,
    },
  ];

  const demoIncidents: TrafficIncident[] = [
    {
      id: "inc-1",
      type: "accident",
      location: "I-580 E near Livermore",
      coordinates: [37.9577, -122.3477],
      severity: "high",
      delay: 12,
      emissionsImpact: 18.5,
      timestamp: new Date(Date.now() - 8 * 60000),
    },
    {
      id: "inc-2",
      type: "construction",
      location: "I-80 W between Berkeley & Emeryville",
      coordinates: [37.8716, -122.2727],
      severity: "medium",
      delay: 7,
      emissionsImpact: 8.2,
      timestamp: new Date(Date.now() - 23 * 60000),
    },
    {
      id: "inc-3",
      type: "congestion",
      location: "US-101 S approaching SFO",
      coordinates: [37.7749, -122.4194],
      severity: "low",
      delay: 4,
      emissionsImpact: 3.1,
      timestamp: new Date(Date.now() - 2 * 60000),
    },
  ];

  const chennaiRoutePrimary: RouteSegment[] = [
    {
      id: "seg-c-1",
      path: [
        [13.0067, 80.2575],
        [13.0418, 80.2337],
      ],
      band: "Moderate",
      multiplier: 1.2,
      confidence: 0.86,
      baseEmissions: 28,
      adjustedEmissions: 33.6,
      deltaEmissions: 5.6,
    },
    {
      id: "seg-c-2",
      path: [
        [13.0418, 80.2337],
        [13.0109, 80.2123],
      ],
      band: "Heavy",
      multiplier: 1.42,
      confidence: 0.8,
      baseEmissions: 34,
      adjustedEmissions: 48.3,
      deltaEmissions: 14.3,
    },
    {
      id: "seg-c-3",
      path: [
        [13.0109, 80.2123],
        [12.9756, 80.2212],
      ],
      band: "Moderate",
      multiplier: 1.25,
      confidence: 0.83,
      baseEmissions: 26,
      adjustedEmissions: 32.5,
      deltaEmissions: 6.5,
    },
    {
      id: "seg-c-4",
      path: [
        [12.9756, 80.2212],
        [13.085, 80.2101],
      ],
      band: "Severe",
      multiplier: 1.6,
      confidence: 0.76,
      baseEmissions: 44,
      adjustedEmissions: 70.4,
      deltaEmissions: 26.4,
    },
  ];

  // Two alternates (slight detours) — purely for “other routes” animation demo
  const chennaiRouteAlt1: RouteSegment[] = [
    {
      id: "seg-a1-1",
      path: [
        [13.0067, 80.2575],
        [13.0339, 80.269],
        [13.0418, 80.2337],
      ],
      band: "Moderate",
      multiplier: 1.18,
      confidence: 0.82,
      baseEmissions: 30,
      adjustedEmissions: 35.4,
      deltaEmissions: 5.4,
    },
    {
      id: "seg-a1-2",
      path: [
        [13.0418, 80.2337],
        [13.0374, 80.1567],
        [13.0109, 80.2123],
      ],
      band: "Heavy",
      multiplier: 1.45,
      confidence: 0.78,
      baseEmissions: 40,
      adjustedEmissions: 58,
      deltaEmissions: 18,
    },
    {
      id: "seg-a1-3",
      path: [
        [13.0109, 80.2123],
        [12.9756, 80.2212],
        [13.085, 80.2101],
      ],
      band: "Moderate",
      multiplier: 1.22,
      confidence: 0.8,
      baseEmissions: 64,
      adjustedEmissions: 78.1,
      deltaEmissions: 14.1,
    },
  ];

  const chennaiRouteAlt2: RouteSegment[] = [
    {
      id: "seg-a2-1",
      path: [
        [13.0067, 80.2575],
        [13.0784, 80.261],
        [13.0418, 80.2337],
      ],
      band: "Moderate",
      multiplier: 1.16,
      confidence: 0.8,
      baseEmissions: 36,
      adjustedEmissions: 41.8,
      deltaEmissions: 5.8,
    },
    {
      id: "seg-a2-2",
      path: [
        [13.0418, 80.2337],
        [13.0109, 80.2123],
        [12.9756, 80.2212],
      ],
      band: "Heavy",
      multiplier: 1.38,
      confidence: 0.79,
      baseEmissions: 48,
      adjustedEmissions: 66.2,
      deltaEmissions: 18.2,
    },
    {
      id: "seg-a2-3",
      path: [
        [12.9756, 80.2212],
        [13.085, 80.2101],
      ],
      band: "Severe",
      multiplier: 1.55,
      confidence: 0.75,
      baseEmissions: 44,
      adjustedEmissions: 68.2,
      deltaEmissions: 24.2,
    },
  ];

  const chennaiIncidents: TrafficIncident[] = [
    {
      id: "inc-c-1",
      type: "accident",
      location: "Guindy (GST Road) - Incident reported",
      coordinates: [13.0109, 80.2123],
      severity: "high",
      delay: 14,
      emissionsImpact: 19.2,
      timestamp: new Date(Date.now() - 6 * 60000),
    },
    {
      id: "inc-c-2",
      type: "construction",
      location: "T Nagar - Road work / lane closure",
      coordinates: [13.0418, 80.2337],
      severity: "medium",
      delay: 8,
      emissionsImpact: 9.1,
      timestamp: new Date(Date.now() - 21 * 60000),
    },
    {
      id: "inc-c-3",
      type: "congestion",
      location: "Velachery - Peak hour congestion",
      coordinates: [12.9756, 80.2212],
      severity: "low",
      delay: 5,
      emissionsImpact: 3.8,
      timestamp: new Date(Date.now() - 3 * 60000),
    },
  ];

  // =====================
  // Hotspot polling (Chennai)
  // =====================
  useEffect(() => {
    if (!ENABLE_CHENNAI_LIVE) return;

    let cancelled = false;

    async function poll() {
      try {
        setHotspotLoading(true);

        const res = await fetch("/api/traffic/segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotspots: CHENNAI_HOTSPOTS }),
        });

        const json = await res.json();
        if (cancelled) return;

        if (!res.ok || !json?.ok) {
          setHotspotLastUpdated(new Date().toLocaleTimeString());
          setHotspotLoading(false);
          return;
        }

        const map: Record<string, HotspotResult> = {};
        for (const r of json.results as HotspotResult[]) map[r.id] = r;

        setHotspotResults(map);
        setHotspotLastUpdated(new Date().toLocaleTimeString());
        setHotspotLoading(false);
      } catch (e) {
        console.error("Hotspot polling failed", e);
        if (!cancelled) {
          setHotspotLastUpdated(new Date().toLocaleTimeString());
          setHotspotLoading(false);
        }
      }
    }

    poll();
    const id = window.setInterval(() => {
      setTileTick((t) => t + 1);
      poll();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // =====================
  // OPTIONAL: “Plug in” hotspot values into route segments (Chennai demo)
  // - We map each segment endpoint to the nearest hotspot flow (simple + stable)
  // - Then we re-band & recompute emissions, which then drives animations
  // =====================
  const applyHotspotTrafficToSegments = (segments: RouteSegment[], biasId: string) => {
    // If no results, return original
    const anyOk = Object.values(hotspotResults).some((r: any) => r?.ok);
    if (!anyOk) return segments;

    const hotspotsOk = CHENNAI_HOTSPOTS.map((h) => {
      const r = hotspotResults[h.id] as any;
      const ok = r && r.ok === true;
      return {
        ...h,
        ok,
        flow: ok ? (r.flow as HotspotFlow) : undefined,
      };
    });

    const dist2 = (a: [number, number], b: [number, number]) => {
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      return dx * dx + dy * dy;
    };

    return segments.map((seg, idx) => {
      // Use midpoint for mapping
      const mid = seg.path[Math.floor(seg.path.length / 2)] ?? seg.path[0];
      const nearest = hotspotsOk
        .filter((h) => h.ok)
        .sort((x, y) => dist2([x.lat, x.lon], mid) - dist2([y.lat, y.lon], mid))[0];

      const speed = nearest?.flow?.currentSpeedKmph;
      const conf = nearest?.flow?.confidence;

      const { band, multiplier } = bandFromSpeed(speed);

      const base = seg.baseEmissions;
      const adjusted = Math.round(base * multiplier * 10) / 10;
      const delta = Math.round((adjusted - base) * 10) / 10;

      // Slightly vary alternates so they animate differently (but still driven by live)
      const altBias =
        biasId === "primary" ? 1 : biasId === "alt1" ? 1.03 : 0.98;

      const m2 = Math.round(multiplier * altBias * 100) / 100;
      const adj2 = Math.round(base * m2 * 10) / 10;
      const del2 = Math.round((adj2 - base) * 10) / 10;

      return {
        ...seg,
        band,
        multiplier: m2,
        confidence: typeof conf === "number" ? clamp(conf, 0, 1) : seg.confidence,
        adjustedEmissions: adj2,
        deltaEmissions: del2,
      };
    });
  };

  // Build internal route options (priority: props.routes > props.route > liveRoutes > demo)
  const computedRouteOptions: RouteOption[] = useMemo(() => {
    if (routes && routes.length > 0) return routes;
    if (route && route.length > 0) {
      return [{ id: "single", name: "Route", segments: route, kind: "primary" }];
    }
    if (liveRoutes.length > 0) return liveRoutes;

    if (ENABLE_CHENNAI_LIVE) {
      const p = applyHotspotTrafficToSegments(chennaiRoutePrimary, "primary");
      const a1 = applyHotspotTrafficToSegments(chennaiRouteAlt1, "alt1");
      const a2 = applyHotspotTrafficToSegments(chennaiRouteAlt2, "alt2");
      return [
        { id: "r-primary", name: "Fastest (Live)", segments: p, kind: "primary" },
        { id: "r-alt-1", name: "Alt A (Detour)", segments: a1, kind: "alt" },
        { id: "r-alt-2", name: "Alt B (Scenic)", segments: a2, kind: "alt" },
      ];
    }

    return [
      { id: "r-demo", name: "Supply Route", segments: demoRoute, kind: "primary" },
    ];
  }, [routes, route, liveRoutes, hotspotResults]);

  // Determine active primary route
  const internalActiveRouteId = useMemo(() => {
    if (activeRouteId) return activeRouteId;
    const primary = computedRouteOptions.find((r) => r.kind === "primary") ?? computedRouteOptions[0];
    return primary?.id ?? "r-demo";
  }, [activeRouteId, computedRouteOptions]);

  const primaryRoute = useMemo(() => {
    return computedRouteOptions.find((r) => r.id === internalActiveRouteId) ??
      computedRouteOptions.find((r) => r.kind === "primary") ??
      computedRouteOptions[0];
  }, [computedRouteOptions, internalActiveRouteId]);

  const activeIncidents =
    incidents ??
    (liveIncidents.length > 0 ? liveIncidents : ENABLE_CHENNAI_LIVE ? chennaiIncidents : demoIncidents);

  const totals = useMemo(() => routeTotals(primaryRoute?.segments ?? []), [primaryRoute]);

  /** TomTom traffic overlay tiles url (ONLY when key present) */
  const trafficTileUrl =
    ENABLE_CHENNAI_LIVE && TOMTOM_PUBLIC_KEY
      ? `https://api.tomtom.com/traffic/map/4/tile/flow/relative0-dark/{z}/{x}/{y}.png?key=${encodeURIComponent(
          TOMTOM_PUBLIC_KEY
        )}&tileSize=256&t=${tileTick}`
      : null;

  const fmtKmph = (n?: number) => (typeof n === "number" ? `${Math.round(n)} km/h` : "—");
  const fmtMin = (sec?: number) => (typeof sec === "number" ? `${Math.max(0, Math.round(sec / 60))} min` : "—");
  const pct = (n?: number) => (typeof n === "number" ? `${Math.round(clamp(n, 0, 1) * 100)}%` : "—");

  const center: [number, number] = ENABLE_CHENNAI_LIVE ? [13.0827, 80.2707] : [37.8716, -122.2727];

  // Particle logic:
  // - Primary route: more particles + higher zIndex
  // - Alternatives: fewer particles + lower opacity
  const particleCountForSegment = (seg: RouteSegment, isPrimary: boolean) => {
    const base = isPrimary ? 2 : 1;
    const extra = Math.floor(clamp((seg.multiplier - 1) * 4, 0, 4)); // congestion => more
    const confBoost = seg.confidence > 0.85 ? 1 : 0;
    return clamp(base + extra + confBoost, 1, isPrimary ? 6 : 3);
  };

  const intensityForSegment = (seg: RouteSegment, isPrimary: boolean) => {
    const m = clamp(seg.multiplier, 1, 2.2);
    const d = clamp(seg.deltaEmissions / 20, 0, 2.2);
    const c = clamp(seg.confidence, 0.4, 1);
    const boost = (m - 1) * 1.6 + d * 0.9;
    return clamp((isPrimary ? 1.0 : 0.65) * boost * c, 0.2, 2.5);
  };

  // Polyline style “priority”
  const polyStyleFor = (seg: RouteSegment, isPrimary: boolean) => {
    const color = getBandColor(seg.band);
    const intensity = intensityForSegment(seg, isPrimary);
    const weight = isPrimary ? 7 : 4.5;
    const opacity = isPrimary ? 0.9 : 0.45;
    return { color, weight, opacity, intensity };
  };

  return (
    <div className="carbon-traffic-map bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-100 tracking-tight">Carbon Emissions • Traffic Flow</h3>

            {ENABLE_CHENNAI_LIVE ? (
              <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-500/15 text-emerald-300 rounded-full border border-emerald-500/30">
                Chennai Live
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400">Route Emissions</div>
              <div className="text-xl font-bold text-emerald-400">{totals.total.toFixed(1)} kg CO₂e</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Traffic Impact</div>
              <div className="text-xl font-bold text-red-400">+{totals.delta.toFixed(1)} kg</div>
            </div>
          </div>
        </div>

        {/* NEW: route selector (only shows if multiple routes exist) */}
        {computedRouteOptions.length > 1 ? (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {computedRouteOptions.map((r) => {
              const active = r.id === primaryRoute?.id;
              const t = routeTotals(r.segments);
              return (
                <button
                  key={r.id}
                  onClick={() => (onRouteSelect ? onRouteSelect(r.id) : undefined)}
                  className={[
                    "px-3 py-1.5 rounded-full border text-xs transition-all",
                    active
                      ? "bg-slate-100/10 border-slate-200/30 text-slate-100"
                      : "bg-slate-950/30 border-slate-700 text-slate-300 hover:bg-slate-100/5",
                  ].join(" ")}
                  title={`${t.total.toFixed(1)} kg • +${t.delta.toFixed(1)} kg`}
                >
                  <span className="font-semibold">{r.name}</span>
                  <span className="ml-2 text-slate-400">
                    {t.total.toFixed(1)}kg • +{t.delta.toFixed(1)}kg
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
        {/* Map */}
        <div
          className="lg:col-span-2 rounded-lg overflow-hidden border border-slate-800 relative"
          style={{ height: "500px" }}
        >
          <MapContainer center={center} zoom={ENABLE_CHENNAI_LIVE ? 12 : 11} style={{ height: "100%", width: "100%" }} zoomControl>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {trafficTileUrl ? <TileLayer url={trafficTileUrl} opacity={0.85} /> : null}

            {/* Render ALL routes:
                - primary route (selected) on top: higher opacity & more particles
                - others below: faded + fewer particles
            */}
            {computedRouteOptions.map((routeOpt) => {
              const isPrimary = routeOpt.id === primaryRoute?.id;
              const z = isPrimary ? 400 : 200;

              return (
                <React.Fragment key={routeOpt.id}>
                  {routeOpt.segments.map((segment) => {
                    const style = polyStyleFor(segment, isPrimary);

                    // “Shimmer” class only when animated; it’s subtle + doesn’t break anything
                    const className = animated ? (isPrimary ? "poly-shimmer-primary" : "poly-shimmer-alt") : undefined;

                    const nParticles = animated ? particleCountForSegment(segment, isPrimary) : 0;
                    const intensity = intensityForSegment(segment, isPrimary);

                    // Spread particles with slightly different rates so it looks “alive”
                    const rates: number[] = [];
                    for (let i = 0; i < nParticles; i++) {
                      const factor = 1 - i * 0.12;
                      rates.push(clamp(segment.multiplier * factor, 0.7, 2.2));
                    }

                    return (
                      <React.Fragment key={`${routeOpt.id}:${segment.id}`}>
                        <Polyline
                          positions={segment.path}
                          pathOptions={{
                            color: style.color,
                            weight: style.weight,
                            opacity: style.opacity,
                            className,
                          } as any}
                          eventHandlers={{
                            click: () => {
                              setActiveSegment(segment.id);
                              // If you click an alt route segment, promote that route as primary (if handler exists)
                              if (!isPrimary && onRouteSelect) onRouteSelect(routeOpt.id);
                            },
                            mouseover: (e) => {
                              e.target.setStyle({ weight: style.weight + 2, opacity: Math.min(1, style.opacity + 0.15) });
                            },
                            mouseout: (e) => {
                              e.target.setStyle({ weight: style.weight, opacity: style.opacity });
                            },
                          }}
                        >
                          <Popup>
                            <div className="text-sm">
                              <div className="font-bold mb-2">{segment.band} Congestion</div>
                              <div className="space-y-1 text-xs">
                                <div>
                                  Route: <strong>{routeOpt.name}</strong>
                                </div>
                                <div>
                                  Multiplier: <strong>{segment.multiplier}×</strong>
                                </div>
                                <div>
                                  Base: <strong>{segment.baseEmissions} kg CO₂e</strong>
                                </div>
                                <div>
                                  Adjusted: <strong className="text-red-600">{segment.adjustedEmissions} kg CO₂e</strong>
                                </div>
                                <div>
                                  Traffic Impact: <strong className="text-red-600">+{segment.deltaEmissions} kg</strong>
                                </div>
                                <div>
                                  Confidence: <strong>{(segment.confidence * 100).toFixed(0)}%</strong>
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Polyline>

                        {/* Particles */}
                        {animated
                          ? rates.map((r, i) => (
                              <EmissionsFlowMarker
                                key={`${routeOpt.id}:${segment.id}:p${i}`}
                                path={segment.path}
                                color={style.color}
                                emissionRate={r}
                                intensity={intensity}
                                zIndexOffset={z + i}
                              />
                            ))
                          : null}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Incidents */}
            {activeIncidents.map((incident) => (
              <Marker key={incident.id} position={incident.coordinates} icon={getIncidentIcon(incident)}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold mb-2">{incident.type.toUpperCase()}</div>
                    <div className="space-y-1 text-xs">
                      <div>{incident.location}</div>
                      <div>
                        Delay: <strong>{incident.delay} min</strong>
                      </div>
                      <div className="text-red-600">
                        Emissions Impact: <strong>+{incident.emissionsImpact} kg CO₂e</strong>
                      </div>
                      <div className="text-gray-500">{formatTimestamp(incident.timestamp)}</div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Legend overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur-sm rounded-lg p-3 border border-slate-700 z-[1000]">
            <div className="text-xs font-semibold text-slate-300 mb-2">Congestion Level</div>
            <div className="space-y-1.5">
              {["Free", "Moderate", "Heavy", "Severe"].map((band) => (
                <div key={band} className="flex items-center gap-2">
                  <div className="w-4 h-2 rounded" style={{ backgroundColor: getBandColor(band) }} />
                  <span className="text-xs text-slate-400">{band}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* ✅ IMPORTANT: closes the MAP COLUMN div (lg:col-span-2) properly */}

        {/* Incidents & Stats Panel (RIGHT) */}
        <div className="space-y-4">
          {/* Emissions Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Emissions Impact</h4>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Base Emissions</span>
                  <span>{(totals.base ?? 0).toFixed(1)} kg</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Traffic Penalty</span>
                  <span className="text-red-400">+{(totals.delta ?? 0).toFixed(1)} kg</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{
                      width: `${(totals.total ?? 0) > 0 ? ((totals.delta ?? 0) / (totals.total ?? 1)) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Efficiency Loss</span>
                  <span className="text-lg font-bold text-red-400">
                    {((totals.delta ?? 0) / Math.max(1e-6, totals.base ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Incidents */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Active Incidents</h4>
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                {activeIncidents.length}
              </span>
            </div>

            <div className="space-y-2">
              {activeIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`p-3 rounded-lg border ${severityClass(
                    incident.severity
                  )} transition-all duration-200 hover:scale-[1.02] cursor-pointer`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">
                      {incident.type === "accident"
                        ? "🚨"
                        : incident.type === "construction"
                        ? "🚧"
                        : incident.type === "weather"
                        ? "🌧️"
                        : "🚗"}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* only chip gets severity color */}
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${severityChipClass(
                            incident.severity
                          )} ${severityTextClass(incident.severity)}`}
                        >
                          {incident.type}
                        </span>

                        <span className="text-xs text-slate-400">{formatTimestamp(incident.timestamp)}</span>
                      </div>

                      <p className="text-xs font-medium mb-1 leading-tight text-slate-200">
                        {incident.location}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="opacity-90">⏱️ {incident.delay}m</span>
                        <span className="text-red-300">💨 +{incident.emissionsImpact} kg CO₂e</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Route Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-xl font-bold text-emerald-400">
                {(primaryRoute?.segments ?? []).filter((s) => s.band === "Free" || s.band === "Moderate").length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Clear segments</div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-xl font-bold text-red-400">
                {(primaryRoute?.segments ?? []).filter((s) => s.band === "Heavy" || s.band === "Severe").length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Congested</div>
            </div>
          </div>
        </div>


        {/* HOTSPOTS: Separate container (full-width row), NOT inside map container */}
        {ENABLE_CHENNAI_LIVE ? (
          <div className="lg:col-span-3 traf-wrap">
            <div className="traf-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-200">
                  Chennai Hotspot Metrics
                </h4>

                <div className="text-xs text-slate-300">
                  {hotspotLoading ? "Refreshing…" : "Live"} • {hotspotLastUpdated || "—"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CHENNAI_HOTSPOTS.map((h) => {
                  const r = hotspotResults[h.id];
                  const ok = r && (r as any).ok === true;
                  const flow = ok ? ((r as any).flow as HotspotFlow) : undefined;

                  return (
                    <div
                      key={h.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-100">
                            {h.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {h.hint}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          {ok ? "OK" : "—"}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="traf-mini">
                          <div className="traf-miniLabel">Speed</div>
                          <div className="traf-miniVal">
                            {fmtKmph(flow?.currentSpeedKmph)}
                          </div>
                        </div>

                        <div className="traf-mini">
                          <div className="traf-miniLabel">Freeflow</div>
                          <div className="traf-miniVal">
                            {fmtKmph(flow?.freeFlowSpeedKmph)}
                          </div>
                        </div>

                        <div className="traf-mini">
                          <div className="traf-miniLabel">Travel</div>
                          <div className="traf-miniVal">
                            {fmtMin(flow?.currentTravelTimeSec)}
                          </div>
                        </div>

                        <div className="traf-mini">
                          <div className="traf-miniLabel">Confidence</div>
                          <div className="traf-miniVal">
                            {pct(flow?.confidence)}
                          </div>
                        </div>
                      </div>

                      {!ok && r ? (
                        <div className="mt-2 text-[11px] text-amber-300">
                          API error {(r as any).error?.status ?? "?"}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {!TOMTOM_PUBLIC_KEY ? (
                <div className="mt-3 text-[11px] text-amber-300">
                  Tip: set NEXT_PUBLIC_TOMTOM_API_KEY to enable the traffic overlay tiles.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}


      </div>

      <style jsx>{`
.traf-wrap {
  --bg: rgba(255,255,255,0.06);
  --bg2: rgba(255,255,255,0.04);
  --stroke: rgba(255,255,255,0.12);
  --shadow: 0 18px 60px rgba(0,0,0,0.35);
  --radius: 22px;
}

.traf-card {
  border-radius: var(--radius);
  border: 1px solid var(--stroke);
  background:
    radial-gradient(700px 240px at 14% 12%, rgba(99,102,241,0.22), transparent 60%),
    radial-gradient(560px 240px at 92% 10%, rgba(168,85,247,0.18), transparent 60%),
    linear-gradient(180deg, var(--bg), var(--bg2));
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}

.traf-mini {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  padding: 8px;
}

.traf-miniLabel {
  font-size: 10px;
  color: rgba(255,255,255,0.6);
}

.traf-miniVal {
  font-size: 13px;
  font-weight: 700;
  margin-top: 4px;
}
`}</style>

    </div>
  );
};

export default CarbonTrafficMap;
