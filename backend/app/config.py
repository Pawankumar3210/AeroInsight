import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEMO_CSV = BASE_DIR / "data" / "demo_reviews.csv"
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
