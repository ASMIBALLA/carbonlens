import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Types
interface RouteSegment {
  id: string;
  path: [number, number][];
  band: string;
  multiplier: number;
  confidence: number;
  baseEmissions: number;
  adjustedEmissions: number;
  deltaEmissions: number;
}

interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'weather' | 'congestion';
  location: string;
  coordinates: [number, number];
  severity: 'low' | 'medium' | 'high';
  delay: number;
  emissionsImpact: number;
  timestamp: Date;
}

interface TomTomIncident {
  id: string;
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: {
    delay?: number;
    from?: string;
    to?: string;
    length?: number;
    magnitudeOfDelay?: number;
  };
}

// API Configuration
const TOMTOM_API_KEY = 'YOUR_TOMTOM_API_KEY'; // Get free key from https://developer.tomtom.com
const ENABLE_REAL_TIME = true; // Toggle real-time vs demo data

// Component to add TomTom traffic tiles
const TrafficTileLayer: React.FC<{ apiKey: string }> = ({ apiKey }) => {
  const map = useMap();

  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_TOMTOM_API_KEY') return;

    const trafficLayer = L.tileLayer(
      `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${apiKey}&thickness=10`,
      {
        opacity: 0.7,
        attribution: '© TomTom'
      }
    );

    trafficLayer.addTo(map);

    return () => {
      map.removeLayer(trafficLayer);
    };
  }, [apiKey, map]);

  return null;
};

// Fetch traffic incidents from TomTom
const fetchTomTomIncidents = async (
  bbox: string,
  apiKey: string
): Promise<TrafficIncident[]> => {
  if (!apiKey || apiKey === 'YOUR_TOMTOM_API_KEY') {
    console.warn('TomTom API key not configured');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,delay,from,to,length}}}&language=en-GB&categoryFilter=0,1,2,3,4,5,6,7,8,9,10,11,14&timeValidityFilter=present`
    );

    if (!response.ok) {
      throw new Error(`TomTom API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform TomTom incidents to our format
    return data.incidents?.map((incident: TomTomIncident, index: number) => {
      const coords = incident.geometry.coordinates;
      const lat = coords[1];
      const lng = coords[0];

      // Map TomTom incident types to our types
      let type: TrafficIncident['type'] = 'congestion';
      if (incident.type.includes('ACCIDENT')) type = 'accident';
      else if (incident.type.includes('CONSTRUCTION')) type = 'construction';
      else if (incident.type.includes('WEATHER')) type = 'weather';

      // Estimate severity based on delay
      const delay = incident.properties.delay || incident.properties.magnitudeOfDelay || 0;
      let severity: TrafficIncident['severity'] = 'low';
      if (delay > 10) severity = 'high';
      else if (delay > 5) severity = 'medium';

      return {
        id: `tomtom-${incident.id || index}`,
        type,
        location: incident.properties.from || incident.properties.to || 'Traffic Incident',
        coordinates: [lat, lng] as [number, number],
        severity,
        delay: Math.round(delay),
        emissionsImpact: delay * 1.5, // Rough estimate
        timestamp: new Date()
      };
    }) || [];
  } catch (error) {
    console.error('Error fetching TomTom incidents:', error);
    return [];
  }
};

// Fetch traffic flow data and generate route segments
const fetchTrafficFlow = async (
  route: [number, number][],
  apiKey: string
): Promise<RouteSegment[]> => {
  if (!apiKey || apiKey === 'YOUR_TOMTOM_API_KEY') {
    console.warn('TomTom API key not configured');
    return [];
  }

  const segments: RouteSegment[] = [];

  // Split route into segments and fetch flow data for each
  for (let i = 0; i < route.length - 1; i++) {
    const start = route[i];
    const end = route[i + 1];
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;

    try {
      const response = await fetch(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?key=${apiKey}&point=${midLat},${midLng}`
      );

      if (!response.ok) continue;

      const data = await response.json();
      const flowData = data.flowSegmentData;

      // Calculate congestion band based on current/free flow speed ratio
      const speedRatio = flowData.currentSpeed / flowData.freeFlowSpeed;
      let band = 'Free';
      let multiplier = 1.0;

      if (speedRatio >= 0.85) {
        band = 'Free';
        multiplier = 1.0;
      } else if (speedRatio >= 0.65) {
        band = 'Moderate';
        multiplier = 1.2;
      } else if (speedRatio >= 0.45) {
        band = 'Heavy';
        multiplier = 1.45;
      } else {
        band = 'Severe';
        multiplier = 1.65;
      }

      const baseEmissions = 30; // Base kg CO2e
      const adjustedEmissions = baseEmissions * multiplier;

      segments.push({
        id: `seg-real-${i}`,
        path: [start, end],
        band,
        multiplier,
        confidence: flowData.confidence || 0.85,
        baseEmissions,
        adjustedEmissions: Math.round(adjustedEmissions * 10) / 10,
        deltaEmissions: Math.round((adjustedEmissions - baseEmissions) * 10) / 10
      });
    } catch (error) {
      console.error(`Error fetching flow for segment ${i}:`, error);
    }
  }

  return segments;
};

// Main Traffic Map Component
export const TrafficMap: React.FC = () => {
  const [activeRoute, setActiveRoute] = useState<RouteSegment[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<TrafficIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [emissionsDelta, setEmissionsDelta] = useState(0);

  // Chennai coordinates
  const center: [number, number] = [13.0418, 80.2337];

  // Demo route points (Adyar -> T Nagar -> Guindy -> Velachery -> Anna Nagar)
  const routePoints: [number, number][] = [
    [13.0067, 80.2575], // Adyar
    [13.0418, 80.2337], // T Nagar
    [13.0109, 80.2123], // Guindy
    [12.9756, 80.2212], // Velachery
    [13.0850, 80.2101], // Anna Nagar
  ];

  // Demo data fallback
  const demoRoute: RouteSegment[] = [
    {
      id: 'seg-demo-1',
      path: [[13.0067, 80.2575], [13.0418, 80.2337]],
      band: 'Moderate',
      multiplier: 1.20,
      confidence: 0.86,
      baseEmissions: 28,
      adjustedEmissions: 33.6,
      deltaEmissions: 5.6
    },
    {
      id: 'seg-demo-2',
      path: [[13.0418, 80.2337], [13.0109, 80.2123]],
      band: 'Heavy',
      multiplier: 1.42,
      confidence: 0.80,
      baseEmissions: 34,
      adjustedEmissions: 48.3,
      deltaEmissions: 14.3
    }
  ];

  const demoIncidents: TrafficIncident[] = [
    {
      id: 'demo-1',
      type: 'accident',
      location: 'Guindy (GST Road)',
      coordinates: [13.0109, 80.2123],
      severity: 'high',
      delay: 14,
      emissionsImpact: 19.2,
      timestamp: new Date()
    }
  ];

  // Fetch real-time data
  useEffect(() => {
    const fetchData = async () => {
      if (!ENABLE_REAL_TIME || TOMTOM_API_KEY === 'YOUR_TOMTOM_API_KEY') {
        // Use demo data
        setActiveRoute(demoRoute);
        setActiveIncidents(demoIncidents);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch traffic flow for route segments
        const flowSegments = await fetchTrafficFlow(routePoints, TOMTOM_API_KEY);

        // Fetch incidents in bounding box around Chennai
        const bbox = '80.15,12.90,80.35,13.15'; // Chennai area
        const incidents = await fetchTomTomIncidents(bbox, TOMTOM_API_KEY);

        setActiveRoute(flowSegments.length > 0 ? flowSegments : demoRoute);
        setActiveIncidents(incidents.length > 0 ? incidents : demoIncidents);
      } catch (error) {
        console.error('Error fetching traffic data:', error);
        setActiveRoute(demoRoute);
        setActiveIncidents(demoIncidents);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate total emissions
  useEffect(() => {
    const total = activeRoute.reduce((sum, seg) => sum + seg.adjustedEmissions, 0);
    const delta = activeRoute.reduce((sum, seg) => sum + seg.deltaEmissions, 0);
    setTotalEmissions(total);
    setEmissionsDelta(delta);
  }, [activeRoute]);

  const getBandColor = (band: string) => {
    switch (band) {
      case 'Free': return '#10b981';
      case 'Moderate': return '#f59e0b';
      case 'Heavy': return '#ef4444';
      case 'Severe': return '#991b1b';
      default: return '#6b7280';
    }
  };

  const getIncidentIcon = (incident: TrafficIncident) => {
    const iconMap = {
      accident: '🚨',
      construction: '🚧',
      weather: '🌧️',
      congestion: '🚗'
    };
    return L.divIcon({
      html: `<div style="font-size: 24px;">${iconMap[incident.type]}</div>`,
      className: 'custom-icon',
      iconSize: [30, 30]
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
      {/* Map */}
      <div className="lg:col-span-2 rounded-lg overflow-hidden border border-slate-800 relative" style={{ height: '500px' }}>
        {loading && (
          <div className="absolute top-4 left-4 z-[1000] bg-blue-600 text-white px-3 py-2 rounded">
            Loading real-time traffic...
          </div>
        )}
        
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          />

          {/* TomTom Traffic Tiles */}
          {ENABLE_REAL_TIME && TOMTOM_API_KEY !== 'YOUR_TOMTOM_API_KEY' && (
            <TrafficTileLayer apiKey={TOMTOM_API_KEY} />
          )}

          {/* Route segments */}
          {activeRoute.map((segment) => (
            <Polyline
              key={segment.id}
              positions={segment.path}
              pathOptions={{
                color: getBandColor(segment.band),
                weight: 6,
                opacity: 0.8,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold mb-2">{segment.band} Congestion</div>
                  <div className="space-y-1 text-xs">
                    <div>Multiplier: <strong>{segment.multiplier}×</strong></div>
                    <div>Base: <strong>{segment.baseEmissions} kg CO₂e</strong></div>
                    <div>Adjusted: <strong className="text-red-600">{segment.adjustedEmissions} kg CO₂e</strong></div>
                    <div>Traffic Impact: <strong className="text-red-600">+{segment.deltaEmissions} kg</strong></div>
                    <div>Confidence: <strong>{(segment.confidence * 100).toFixed(0)}%</strong></div>
                  </div>
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Incident markers */}
          {activeIncidents.map((incident) => (
            <Marker
              key={incident.id}
              position={incident.coordinates}
              icon={getIncidentIcon(incident)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold mb-2">{incident.type.toUpperCase()}</div>
                  <div className="space-y-1 text-xs">
                    <div>{incident.location}</div>
                    <div>Delay: <strong>{incident.delay} min</strong></div>
                    <div className="text-red-600">
                      Emissions Impact: <strong>+{incident.emissionsImpact.toFixed(1)} kg CO₂e</strong>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Stats Panel */}
      <div className="space-y-4">
        <div className="bg-slate-800 p-4 rounded-lg">
          <h3 className="text-lg font-bold mb-2 text-white">Traffic Status</h3>
          <div className="text-sm text-gray-300">
            <div>Total Emissions: <span className="text-red-400 font-bold">{totalEmissions.toFixed(1)} kg CO₂e</span></div>
            <div>Traffic Impact: <span className="text-red-400 font-bold">+{emissionsDelta.toFixed(1)} kg</span></div>
            <div className="mt-2 text-xs">
              {ENABLE_REAL_TIME && TOMTOM_API_KEY !== 'YOUR_TOMTOM_API_KEY' 
                ? '✅ Real-time data active' 
                : '⚠️ Demo data (configure API key)'}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-4 rounded-lg">
          <h3 className="text-lg font-bold mb-2 text-white">Active Incidents</h3>
          <div className="space-y-2 text-sm text-gray-300">
            {activeIncidents.slice(0, 3).map(inc => (
              <div key={inc.id} className="border-b border-slate-700 pb-2">
                <div className="font-semibold">{inc.type.toUpperCase()}</div>
                <div className="text-xs">{inc.location}</div>
                <div className="text-xs text-red-400">+{inc.delay} min delay</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficMap;