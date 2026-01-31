# CarbonLens: Traffic-Aware Carbon Emission Intelligence
One-line value proposition:
A high-performance logistics optimization engine that leverages real-time traffic data and machine learning to minimize supply chain carbon footprints through intelligent routing and vehicle recommendations.

# Problem Statement
Estimating carbon emissions in logistics is traditionally a static process, ignoring the massive variability introduced by real-world conditions.
- **Logistics Carbon Emission Estimation**: Traditional models use simple distance-to-emission ratios, failing to account for load, vehicle type, and engine efficiency.
- **Traffic-Aware Routing Complexity**: Congestion, accidents, and construction significantly increase fuel consumption and idling emissions, yet they are rarely integrated into standard carbon reporting.
- **Vehicle Selection Optimization**: Logistics managers lack data-driven tools to compare the environmental impact of different fleet options (e.g., EV vs. Diesel) for specific route types.
- **Real-Time Variability**: Traffic is dynamic; an optimized route at 8:00 AM becomes a high-emission trap by 9:00 AM, necessitating live telemetry integration.

# Solution Overview
CarbonLens bridges the gap between static logistics planning and real-time operational reality:
- **ML Carbon Emission Prediction**: A Scikit-learn based predictive engine trained on logistics datasets to forecast emissions based on facility origin, vehicle type, and route characteristics.
- **Traffic-Aware Route Intelligence**: Dynamically calculates emission penalties by analyzing segment-specific flow and real-time delays.
- **TomTom Real-Time Data Integration**: Ingests live traffic snapshots and incident reports via TomTom's high-fidelity Routing and Traffic APIs.
- **Vehicle Comparison + Recommendation**: A manual "Analyze" engine that pits multiple fleet configurations against each other to identify the "Optimal" (lowest impact) choice.
- **Emissions Optimization Logic**: A multi-path optimization algorithm that evaluates primary and alternative routes to surface the most eco-efficient path.

# Key Technical Highlights (Recruiter Section)
- **ML Model Integration**: Production-grade implementation of a Scikit-learn regressor served via a FastAPI backend, enabling low-latency inference.
- **Polyglot Full-Stack Architecture**: Next.js (App Router/TypeScript) frontend communicating with a high-performance Python FastAPI microservice for specialized ML workloads.
- **Real-Time Traffic Ingestion**: Automated ingestion of TomTom Traffic Flow and Incident data, mapped directly to route segments for precise impact analysis.
- **Route Emissions Modeling**: Implementation of normalized efficiency loss algorithms to classify route segments into performance bands (Green/Yellow/Red).
- **Advanced State Management**: Gated analysis flow preventing premature API calls and ensuring a clean initialization state for heavy predictive tasks.
- **Real-Time Visualization**: SSE (Server-Sent Events) implementation for live traffic signal dashboards with automated polling fallback for high reliability.
- **External API Resilience**: Robust integration with TomTom APIs, including bounding-box incident detection and multi-alternative route processing.
- **Production-Ready UI**: Premium dashboard designed with custom CSS glassmorphism, responsive layouts, and interactive React-Leaflet map implementations.

# System Architecture
The system follows a modern decoupled architecture designed for scale and specialized processing.

**Frontend**: Next.js (React) handles UI state, map rendering via Leaflet, and orchestrates traffic telemetry.
**Backend**: FastAPI (Python) manages the ML prediction lifecycle, including model loading and batch inference.
**External Services**: TomTom API provides the ground truth for traffic flow, incidents, and routing geometry.

```text
[ USER UI ] <──(HTTPS/SSE)──> [ Next.js API Routes ] <──(HTTPS)──> [ TomTom API ]
      │                               │
      │                               └───> [ Processing Logic: Path Optimization ]
      │                                              │
      └──────(HTTPS)───> [ FastAPI Backend ] <───────┘
                               │
                       [ Scikit-learn Model ]
```

# Feature Breakdown
- **CarbonTrafficMap**: Interactive geospatial dashboard rendering optimized routes, real-time traffic overlays, and dynamic incident markers.
- **TrafficViz Live Panel**: A real-time telemetry component showing congestion factors, delay minutes, and speed utilization with animated sparklines.
- **Chennai Hotspot Metrics**: A specialized monitoring tool for high-traffic nodes in the Chennai industrial corridor, showing real-time flow versus freeflow benchmarks.
- **Recommendation Panel**: A comprehensive tool for logistics managers to perform manual deep-dives into route efficiency across different vehicle types.
- **Vehicle Comparison**: Real-time comparison table ranking fleet options from "Optimal" to "High Impact" based on predicted CO2e output.
- **Incident Inventory**: Categorized list of active accidents, construction, and weather events with calculated emission penalties.

# ML Model Section (Important for Recruiters)
The core intelligence is driven by a Scikit-learn regressor optimized for logistics variability.
- **Predicts**: Continuous value representing `predicted_emission_kgco2e`.
- **Input Features**: `origin_facility`, `vehicle_type`, `route_type`, and `distance_km`.
- **Output**: Multi-scale prediction (kg and tons) with internal confidence scoring.
- **Recommendation Logic**: The system performs batch inference across the entire fleet (`VEHICLE_TYPES`) for a given route and ranks them based on absolute emission savings.
- **Relative Rating**: Dynamically classifies vehicles as "Optimal", "Efficient", or "High Impact" based on their position in the emission distribution.
- **% Benefit Computation**: Calculates the percentage reduction achieved by choosing the "Optimal" vehicle versus the "Worst" performing fleet configuration.

# API Layer
### Backend (FastAPI: Port 8000)
| Method | Endpoint | Purpose | Input |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Check model & service health | N/A |
| `POST` | `/predict` | Single route emission prediction | `PredictionRequest` (JSON) |
| `POST` | `/predict/batch` | Batch vehicle comparison | `BatchPredictionRequest` (JSON) |

### Frontend (Next.js: Port 3000)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/logistics/optimize` | Orchestrates TomTom routing + optimization |
| `POST` | `/api/traffic/segment` | Fetches segment-specific flow data |
| `GET`  | `/api/traffic/stream` | SSE stream for live traffic telemetry |

# Real-Time Data Handling
- **TomTom Integration**: Uses Routing V1 and Traffic Incident V5 services.
- **Sim vs Live Mode**: Switchable modes for demonstration (simulation) versus production (verified TomTom telemetry).
- **Fallback Behavior**: `TrafficViz` automatically downgrades from SSE to high-frequency polling if the stream connection is interrupted.
- **Normalization**: Traffic flow speed is normalized against freeflow benchmarks to calculate a consistent `congestionFactor`.

# UI/UX Engineering Notes
- **Interactive Maps**: Custom Leaflet markers with SVG icons and animated "flow" particles representing emissions intensity.
- **Animated Indicators**: Pulse animations for live status and high-severity incidents to reduce cognitive load.
- **Design System**: Deep-space theme utilizing glassmorphism (`backdrop-filter`) and vibrant emerald/amber/rose palettes for actionable data visualization.
- **Performance**: Heavy computation (like route optimization) is memoized using React's `useMemo` to ensure smooth map interactions.

# Setup Instructions
### Frontend (Next.js)
1. Install dependencies: `npm install`
2. Configure `.env.local` with `TOMTOM_API_KEY`.
3. Start dev server: `npm run dev`

### Backend (FastAPI)
1. Navigate to `/backend`.
2. Install requirements: `pip install -r requirements.txt`
3. Ensure `carbon_emission_model.pkl` is present.
4. Run server: `uvicorn app.main:app --reload`

# Environment Variables
- `TOMTOM_API_KEY`: Required for real-time map and traffic data.
- `NEXT_PUBLIC_API_URL`: Base URL for the FastAPI backend (Default: `http://127.0.0.1:8000`).
- `NEXT_PUBLIC_TRAFFIC_MODE`: Set to `live` for real telemetry or `sim` for testing.

# Performance / Engineering Decisions
- **Hydration Resilience**: Implemented `isMounted` checks for all real-time clock and relative-time components to prevent SSR/CSR divergence.
- **SSE vs Polling**: Chose SSE for the traffic dashboard to minimize HTTP overhead while maintaining a "live" pulse feel.
- **Route Scoring**: Implemented a penalty-based scoring system where active incidents add `emissionsImpact` to segment deltas, influencing the "Best" route decision.
- **Data Guarding**: Analysis results are gated behind a manual trigger to optimize API costs and prevent unnecessary background model inference.

# Limitations
- **Model Scope**: Prediction is currently limited to the specific categories of facilities and vehicles included in the training set.
- **TomTom Credits**: Heavy use of matrix or segment-specific flow APIs may consume significant API credits.

# Future Improvements
- **Live Routing Refresh**: Implementing automated re-routing logic if a high-severity incident appears on the active path.
- **Historical Trends**: Storing telemetry in a time-series database to provide weekday/weekend carbon forecasting.
- **Multi-Modal Support**: Extending the ML model to include rail and sea freight configurations.

# Tech Stack Summary
| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15, TypeScript, React 19, Tailwind CSS, Lucide React |
| **Mapping** | Leaflet, React Leaflet, TomTom Web SDK |
| **Backend** | FastAPI, Python 3.10+, Pydantic |
| **ML/Data** | Scikit-learn, Pandas, Joblib |
| **APIs** | TomTom Routing & Traffic |

# Resume-Ready Summary
Developed **CarbonLens**, a full-stack logistics optimization platform that integrates **Machine Learning** and **Real-Time Traffic Telemetry** to reduce supply chain emissions. Built a **FastAPI** microservice to serve a **Scikit-learn** model for low-latency carbon forecasting, integrated with a **Next.js** frontend via **SSE (Server-Sent Events)** for live dashboarding. Optimized routing logic using the **TomTom API**, implementing dynamic emission penalty calculations based on real-time incidents and segment-specific congestion flow. Designed a premium, data-dense UI that enables logistics managers to compare fleet configurations and identify eco-efficient paths, resulting in a data-driven approach to sustainable freight management.
