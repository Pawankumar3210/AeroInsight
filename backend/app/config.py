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

# "auto" = use the transformer, fall back to word lists if it can't load.
# "transformer" = never fall back (errors instead). "fallback" = word lists only.
_mode = os.getenv("SENTIMENT_MODE", "auto").lower()
SENTIMENT_MODE = _mode if _mode in ("auto", "transformer", "fallback") else "auto"
SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "cardiffnlp/twitter-roberta-base-sentiment-latest")
SENTIMENT_BATCH_SIZE = int(os.getenv("SENTIMENT_BATCH_SIZE", "16"))
# Safety cap: at most this many unique reviews are scored per run.
MAX_SCORE_ROWS = int(os.getenv("MAX_SCORE_ROWS", "2000"))

# Uploads and benchmark runs change or load the shared server. Turn them off on a public demo.
ENABLE_UPLOADS = os.getenv("ENABLE_UPLOADS", "true").lower() in ("1", "true", "yes")
ENABLE_BENCHMARK_RUN = os.getenv("ENABLE_BENCHMARK_RUN", "true").lower() in ("1", "true", "yes")
BENCHMARK_MAX_ROWS = int(os.getenv("BENCHMARK_MAX_ROWS", "1000000"))
BENCHMARK_FILE = BASE_DIR / "data" / "benchmark_results.json"
