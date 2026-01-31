from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from typing import List

from .models import (
    PredictionRequest,
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    HealthResponse
)
from .predictor import predictor
from .config import (
    API_TITLE,
    API_VERSION,
    API_DESCRIPTION,
    ALLOWED_ORIGINS
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": "Carbon Emission Prediction API",
        "version": API_VERSION,
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if predictor.is_loaded() else "unhealthy",
        model_loaded=predictor.is_loaded(),
        version=API_VERSION
    )


@app.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"]
)
async def predict_emission(request: PredictionRequest):
    """
    Predict carbon emission for a single logistics route
    
    - **origin_facility**: Origin warehouse/facility
    - **vehicle_type**: Type of vehicle (truck, van, bike, etc.)
    - **route_type**: Type of route (highway, urban, mixed, etc.)
    - **distance_km**: Distance in kilometers
    """
    try:
        # Make prediction
        emission_kg = predictor.predict_single(request)
        
        # Convert to tons
        emission_tons = emission_kg / 1000
        
        logger.info(
            f"Prediction: {request.origin_facility} → "
            f"{request.vehicle_type} → {request.route_type} → "
            f"{request.distance_km}km = {emission_kg:.2f} kgCO₂e"
        )
        
        return PredictionResponse(
            predicted_emission_kgco2e=round(emission_kg, 2),
            predicted_emission_tons=round(emission_tons, 4),
            input_data=request,
            model_version=API_VERSION
        )
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@app.post(
    "/predict/batch",
    response_model=BatchPredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"]
)
async def predict_emissions_batch(request: BatchPredictionRequest):
    """
    Predict carbon emissions for multiple logistics routes
    
    Maximum 100 predictions per request.
    """
    try:
        # Make batch prediction
        emissions_kg = predictor.predict_batch(request.predictions)
        
        # Create individual responses
        results = []
        total_emission_kg = 0
        
        for req, emission_kg in zip(request.predictions, emissions_kg):
            emission_tons = emission_kg / 1000
            total_emission_kg += emission_kg
            
            results.append(PredictionResponse(
                predicted_emission_kgco2e=round(emission_kg, 2),
                predicted_emission_tons=round(emission_tons, 4),
                input_data=req,
                model_version=API_VERSION
            ))
        
        total_emission_tons = total_emission_kg / 1000
        
        logger.info(
            f"Batch prediction: {len(results)} routes, "
            f"Total: {total_emission_kg:.2f} kgCO₂e"
        )
        
        return BatchPredictionResponse(
            results=results,
            total_count=len(results),
            total_emission_kgco2e=round(total_emission_kg, 2),
            total_emission_tons=round(total_emission_tons, 4)
        )
        
    except Exception as e:
        logger.error(f"Batch prediction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch prediction failed: {str(e)}"
        )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )