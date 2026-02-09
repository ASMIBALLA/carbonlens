import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Model path
MODEL_PATH = BASE_DIR / "carbon_emission_model.pkl"

# API Configuration
API_TITLE = "Carbon Emission Prediction API"
API_VERSION = "1.0.0"
API_DESCRIPTION = "API for predicting carbon emissions based on logistics data"

# CORS settings
# CORS settings
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]
ALLOWED_ORIGINS += [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]

# Feature validation
VALID_VEHICLE_TYPES = ["truck", "van", "bike", "cargo_bike", "electric_van"]
VALID_ROUTE_TYPES = ["highway", "urban", "mixed", "rural"]

# Distance validation
MIN_DISTANCE_KM = 0.1
MAX_DISTANCE_KM = 10000