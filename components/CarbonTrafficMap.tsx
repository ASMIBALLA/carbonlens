import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Types
interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'congestion' | 'weather';
  location: string;
  coordinates: [number, number];
  severity: 'low' | 'medium' | 'high';
  delay: number;
  emissionsImpact: number; // kg CO2e added due to idling/detours
  timestamp: Date;
}

interface RouteSegment {
  id: string;
  path: [number, number][];
  band: 'Free' | 'Moderate' | 'Heavy' | 'Severe';
  multiplier: number;
  confidence: number;
  baseEmissions: number; // kg CO2e at free flow
  adjustedEmissions: number; // kg CO2e with traffic
  deltaEmissions: number; // additional CO2e from congestion
}

interface CarbonTrafficMapProps {
  route?: RouteSegment[];
  incidents?: TrafficIncident[];
  animated?: boolean;
}

// Animated marker component for emissions flow
const EmissionsFlowMarker: React.FC<{ 
  path: [number, number][]; 
  color: string;
  emissionRate: number;
}> = ({ path, color, emissionRate }) => {
  const map = useMap();
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const duration = 3000 / emissionRate; // Faster movement = higher emissions
    const steps = 100;
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
    const segmentProgress = (progress * totalSegments) - segmentIndex;
    
    if (segmentIndex >= path.length - 1) return path[path.length - 1];
    
    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];
    
    return [
      start[0] + (end[0] - start[0]) * segmentProgress,
      start[1] + (end[1] - start[1]) * segmentProgress
    ] as [number, number];
  };

  const currentPos = getPointAlongPath(position);

  const emissionIcon = L.divIcon({
    className: 'emission-marker',
    html: `<div style="
      width: 12px;
      height: 12px;
      background: ${color};
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.8);
      box-shadow: 0 0 12px ${color};
      animation: pulse-emission 1s ease-in-out infinite;
    "></div>`,
    iconSize: [12, 12],
  });

  return <Marker position={currentPos} icon={emissionIcon} />;
};

const CarbonTrafficMap: React.FC<CarbonTrafficMapProps> = ({ 
  route, 
  incidents, 
  animated = true 
}) => {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [emissionsDelta, setEmissionsDelta] = useState(0);

  // Demo data - San Francisco Bay Area supply chain route
  const demoRoute: RouteSegment[] = [
    {
      id: 'seg-1',
      path: [
        [37.7749, -122.4194], // SF
        [37.8044, -122.2712], // Oakland
      ],
      band: 'Free',
      multiplier: 1.02,
      confidence: 0.92,
      baseEmissions: 45,
      adjustedEmissions: 45.9,
      deltaEmissions: 0.9
    },
    {
      id: 'seg-2',
      path: [
        [37.8044, -122.2712], // Oakland
        [37.8716, -122.2727], // Berkeley
      ],
      band: 'Moderate',
      multiplier: 1.18,
      confidence: 0.85,
      baseEmissions: 32,
      adjustedEmissions: 37.8,
      deltaEmissions: 5.8
    },
    {
      id: 'seg-3',
      path: [
        [37.8716, -122.2727], // Berkeley
        [37.9577, -122.3477], // Richmond
      ],
      band: 'Heavy',
      multiplier: 1.45,
      confidence: 0.78,
      baseEmissions: 52,
      adjustedEmissions: 75.4,
      deltaEmissions: 23.4
    },
    {
      id: 'seg-4',
      path: [
        [37.9577, -122.3477], // Richmond
        [38.0293, -122.2416], // Warehouse destination
      ],
      band: 'Moderate',
      multiplier: 1.21,
      confidence: 0.88,
      baseEmissions: 38,
      adjustedEmissions: 46,
      deltaEmissions: 8
    },
  ];

  const demoIncidents: TrafficIncident[] = [
    {
      id: 'inc-1',
      type: 'accident',
      location: 'I-580 E near Livermore',
      coordinates: [37.9577, -122.3477],
      severity: 'high',
      delay: 12,
      emissionsImpact: 18.5,
      timestamp: new Date(Date.now() - 8 * 60000)
    },
    {
      id: 'inc-2',
      type: 'construction',
      location: 'I-80 W between Berkeley & Emeryville',
      coordinates: [37.8716, -122.2727],
      severity: 'medium',
      delay: 7,
      emissionsImpact: 8.2,
      timestamp: new Date(Date.now() - 23 * 60000)
    },
    {
      id: 'inc-3',
      type: 'congestion',
      location: 'US-101 S approaching SFO',
      coordinates: [37.7749, -122.4194],
      severity: 'low',
      delay: 4,
      emissionsImpact: 3.1,
      timestamp: new Date(Date.now() - 2 * 60000)
    }
  ];

  const activeRoute = route || demoRoute;
  const activeIncidents = incidents || demoIncidents;

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
      className: 'incident-icon',
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const center: [number, number] = [37.8716, -122.2727];

  return (
    <div className="carbon-traffic-map bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-lg font-semibold text-slate-100 tracking-tight">
              Carbon Emissions • Traffic Flow
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400">Route Emissions</div>
              <div className="text-xl font-bold text-emerald-400">{totalEmissions.toFixed(1)} kg CO₂e</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Traffic Impact</div>
              <div className="text-xl font-bold text-red-400">+{emissionsDelta.toFixed(1)} kg</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
        {/* Leaflet Map */}
        <div className="lg:col-span-2 rounded-lg overflow-hidden border border-slate-800 relative" style={{ height: '500px' }}>
          <MapContainer
            center={center}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Route segments */}
            {activeRoute.map((segment) => (
              <React.Fragment key={segment.id}>
                <Polyline
                  positions={segment.path}
                  pathOptions={{
                    color: getBandColor(segment.band),
                    weight: 6,
                    opacity: 0.8,
                  }}
                  eventHandlers={{
                    click: () => setActiveSegment(segment.id),
                    mouseover: (e) => {
                      e.target.setStyle({ weight: 8, opacity: 1 });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ weight: 6, opacity: 0.8 });
                    },
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

                {/* Animated emission particles */}
                {animated && (
                  <>
                    <EmissionsFlowMarker 
                      path={segment.path} 
                      color={getBandColor(segment.band)}
                      emissionRate={segment.multiplier}
                    />
                    <EmissionsFlowMarker 
                      path={segment.path} 
                      color={getBandColor(segment.band)}
                      emissionRate={segment.multiplier * 0.7}
                    />
                  </>
                )}
              </React.Fragment>
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
              {['Free', 'Moderate', 'Heavy', 'Severe'].map(band => (
                <div key={band} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-2 rounded"
                    style={{ backgroundColor: getBandColor(band) }}
                  />
                  <span className="text-xs text-slate-400">{band}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Incidents & Stats Panel */}
        <div className="space-y-4">
          {/* Emissions Summary */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Emissions Impact</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Base Emissions</span>
                  <span>{activeRoute.reduce((sum, s) => sum + s.baseEmissions, 0).toFixed(1)} kg</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Traffic Penalty</span>
                  <span className="text-red-400">+{emissionsDelta.toFixed(1)} kg</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${(emissionsDelta / totalEmissions) * 100}%` }}
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Efficiency Loss</span>
                  <span className="text-lg font-bold text-red-400">
                    {((emissionsDelta / (totalEmissions - emissionsDelta)) * 100).toFixed(1)}%
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
              {activeIncidents.map(incident => (
                <div 
                  key={incident.id}
                  className={`p-3 rounded-lg border ${getSeverityColor(incident.severity)} transition-all duration-200 hover:scale-[1.02] cursor-pointer`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{incident.type === 'accident' ? '🚨' : incident.type === 'construction' ? '🚧' : incident.type === 'weather' ? '🌧️' : '🚗'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {incident.type}
                        </span>
                        <span className="text-xs opacity-60">
                          {formatTimestamp(incident.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs font-medium mb-1 leading-tight">
                        {incident.location}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="opacity-75">⏱️ {incident.delay}m</span>
                        <span className="opacity-75">💨 +{incident.emissionsImpact} kg CO₂e</span>
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
                {activeRoute.filter(s => s.band === 'Free' || s.band === 'Moderate').length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Clear segments</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-xl font-bold text-red-400">
                {activeRoute.filter(s => s.band === 'Heavy' || s.band === 'Severe').length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Congested</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-emission {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.3);
            opacity: 0.7;
          }
        }

        @keyframes bounce-incident {
          0%, 100% { 
            transform: translateY(0);
          }
          50% { 
            transform: translateY(-5px);
          }
        }

        .emission-marker,
        .incident-icon {
          background: transparent !important;
          border: none !important;
        }

        .leaflet-popup-content-wrapper {
          background: rgb(15 23 42);
          color: rgb(226 232 240);
          border-radius: 8px;
          border: 1px solid rgb(51 65 85);
        }

        .leaflet-popup-tip {
          background: rgb(15 23 42);
        }
      `}</style>
    </div>
  );
};

export default CarbonTrafficMap;