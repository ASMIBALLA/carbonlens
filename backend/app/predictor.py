import joblib
import pandas as pd
from pathlib import Path
import logging
from typing import List
from .models import PredictionRequest
from .config import MODEL_PATH

logger = logging.getLogger(__name__)

class CarbonEmissionPredictor:
    """Carbon emission prediction using trained ML model"""
    
    def __init__(self, model_path: Path = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load the trained model from pickle file"""
        try:
            logger.info(f"Loading model from {self.model_path}")
            self.model = joblib.load(self.model_path)
            logger.info("✅ Model loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            raise RuntimeError(f"Could not load model: {e}")
    
    def predict_single(self, request: PredictionRequest) -> float:
        """
        Predict carbon emission for a single request
        
        Args:
            request: PredictionRequest object
            
        Returns:
            Predicted carbon emission in kg CO₂e
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        # Create DataFrame with exact column order expected by model
        input_df = pd.DataFrame({
            "origin_facility": [request.origin_facility],
            "vehicle_type": [request.vehicle_type],
            "route_type": [request.route_type],
            "distance_km": [request.distance_km]
        })
        
        # Make prediction
        prediction = self.model.predict(input_df)
        
        return float(prediction[0])
    
    def predict_batch(self, requests: List[PredictionRequest]) -> List[float]:
        """
        Predict carbon emissions for multiple requests
        
        Args:
            requests: List of PredictionRequest objects
            
        Returns:
            List of predicted carbon emissions in kg CO₂e
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        # Create DataFrame from all requests
        input_df = pd.DataFrame([
            {
                "origin_facility": req.origin_facility,
                "vehicle_type": req.vehicle_type,
                "route_type": req.route_type,
                "distance_km": req.distance_km
            }
            for req in requests
        ])
        
        # Make predictions
        predictions = self.model.predict(input_df)
        
        return [float(pred) for pred in predictions]
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None


# Global predictor instance
predictor = CarbonEmissionPredictor()