// Types
export interface PredictionRequest {
    origin_facility: string;
    vehicle_type: string;
    route_type: string;
    distance_km: number;
}

export interface PredictionResponse {
    predicted_emission_kgco2e: number;
    predicted_emission_tons: number;
    input_data: PredictionRequest;
    model_version: string;
}

export interface BatchPredictionRequest {
    predictions: PredictionRequest[];
}

export interface BatchPredictionResponse {
    results: PredictionResponse[];
    total_count: number;
    total_emission_kgco2e: number;
    total_emission_tons: number;
}

export interface HealthResponse {
    status: string;
    model_loaded: boolean;
    version: string;
}

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

class CarbonEmissionAPI {
    private baseURL: string;

    constructor(baseURL: string = API_BASE_URL) {
        this.baseURL = baseURL;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    detail: `HTTP ${response.status} - ${response.statusText}`
                }));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }

            return response.json();
        } catch (err: any) {
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error(`Connection refused at ${this.baseURL}. Ensure FastAPI backend is running.`);
            }
            throw err;
        }
    }

    /**
     * Check API health status
     */
    async healthCheck(): Promise<HealthResponse> {
        return this.request<HealthResponse>('/health');
    }

    /**
     * Predict carbon emission for a single route
     */
    async predictEmission(
        data: PredictionRequest
    ): Promise<PredictionResponse> {
        return this.request<PredictionResponse>('/predict', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Predict carbon emissions for multiple routes
     */
    async predictEmissionsBatch(
        data: BatchPredictionRequest
    ): Promise<BatchPredictionResponse> {
        return this.request<BatchPredictionResponse>('/predict/batch', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Helper: Calculate emission for common scenarios
     */
    async calculateEmission(params: {
        origin: string;
        vehicle: string;
        route: string;
        distance: number;
    }): Promise<number> {
        const response = await this.predictEmission({
            origin_facility: params.origin,
            vehicle_type: params.vehicle,
            route_type: params.route,
            distance_km: params.distance,
        });

        return response.predicted_emission_kgco2e;
    }
}

// Export singleton instance
export const carbonAPI = new CarbonEmissionAPI();

// Export class for custom instances
export default CarbonEmissionAPI;