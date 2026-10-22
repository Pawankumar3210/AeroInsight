import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEMO_CSV = BASE_DIR / "data" / "demo_reviews.csv"
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
# An airline needs at least this many rated reviews to appear in "worst airline" rankings.
# 3 suits the tiny demo file. Use 30 or more with real data.
MIN_AIRLINE_SAMPLE = int(os.getenv("MIN_AIRLINE_SAMPLE", "3"))
