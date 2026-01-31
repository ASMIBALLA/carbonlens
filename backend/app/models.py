from pydantic import BaseModel, Field, field_validator
from typing import Optional

class PredictionRequest(BaseModel):
    """Request model for carbon emission prediction"""
    origin_facility: str = Field(
        ..., 
        description="Origin warehouse/facility (e.g., 'WH_Bangalore')",
        min_length=1
    )
    vehicle_type: str = Field(
        ..., 
        description="Type of vehicle (e.g., 'truck', 'van', 'bike')"
    )
    route_type: str = Field(
        ..., 
        description="Type of route (e.g., 'highway', 'urban', 'mixed')"
    )
    distance_km: float = Field(
        ..., 
        description="Distance in kilometers",
        gt=0
    )
    
    @field_validator('vehicle_type', 'route_type')
    @classmethod
    def clean_strings(cls, v: str) -> str:
        """Clean strings for consistency without changing case"""
        return v.strip()
    
    @field_validator('origin_facility')
    @classmethod
    def validate_origin(cls, v: str) -> str:
        """Validate and clean origin facility"""
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "origin_facility": "WH_Bangalore",
                    "vehicle_type": "truck",
                    "route_type": "highway",
                    "distance_km": 350
                }
            ]
        }
    }


class PredictionResponse(BaseModel):
    """Response model for carbon emission prediction"""
    predicted_emission_kgco2e: float = Field(
        ..., 
        description="Predicted carbon emission in kg CO₂e"
    )
    predicted_emission_tons: float = Field(
        ...,
        description="Predicted carbon emission in tons CO₂e"
    )
    input_data: PredictionRequest
    model_version: str = "1.0.0"
    
    model_config = {
        "protected_namespaces": (),  # Disable protected namespace warning
        "json_schema_extra": {
            "examples": [
                {
                    "predicted_emission_kgco2e": 45.67,
                    "predicted_emission_tons": 0.04567,
                    "input_data": {
                        "origin_facility": "WH_Bangalore",
                        "vehicle_type": "truck",
                        "route_type": "highway",
                        "distance_km": 350
                    },
                    "model_version": "1.0.0"
                }
            ]
        }
    }


class BatchPredictionRequest(BaseModel):
    """Request model for batch predictions"""
    predictions: list[PredictionRequest] = Field(
        ..., 
        description="List of prediction requests",
        min_length=1,
        max_length=100
    )


class BatchPredictionResponse(BaseModel):
    """Response model for batch predictions"""
    results: list[PredictionResponse]
    total_count: int
    total_emission_kgco2e: float
    total_emission_tons: float


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    version: str
    
    model_config = {
        "protected_namespaces": ()  # Disable protected namespace warning
    }