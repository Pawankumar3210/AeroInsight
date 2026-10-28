"""Save real API responses for the frontend's demo mode.
Run with the backend already running:   python -m app.make_snapshot"""
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "demo-snapshot.json"


# Keep in sync with EXAMPLES in frontend/src/pages/Analyzer.tsx
EXAMPLES = [
    "The flight was delayed three hours and the staff were rude.",
    "Lovely crew, comfortable seats, would fly again.",
    "The flight departed at 9am and landed at 11am.",
    "Lost my bags, and customer service blamed me for it.",
]


def call(path: str, method: str = "GET", body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else (b"" if method == "POST" else None)
    req = urllib.request.Request(BASE + path, method=method, data=data,
                                 headers={"Content-Type": "application/json"} if body is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise SystemExit(f"{path} failed: HTTP {e.code} {e.read().decode()[:200]}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Cannot reach {BASE}: {e.reason}. Is the backend running?")


if not (call("/api/dataset") or {}).get("source", "").startswith("Demo data"):
    print("Restoring the demo data first...")
    call("/api/reset", "POST")

print("Scoring reviews...")
score = call("/api/sentiment/score", "POST")
if score["method"] != "transformer":
    raise SystemExit(f"Scoring used '{score['method']}', not the transformer. "
                     "Fix that first: a snapshot must never claim transformer results it does not have.")

dataset = call("/api/dataset")
queries = call("/api/queries")
spark = {}
for q in queries:
    spark[q["name"]] = call("/api/spark/" + q["name"])
    print("  saved", q["name"])
predictions = {}
for text in EXAMPLES:
    pred = call("/api/sentiment/predict", "POST", {"text": text})
    if pred["method"] != "transformer":
        raise SystemExit("An example was not read by the transformer; refusing to save it.")
    predictions[text] = pred
print(f"  saved {len(predictions)} example predictions")
dashboard = call("/api/dashboard")
print("  saved dashboard")
reviews = call("/api/reviews?limit=100&sort=date&order=desc")["rows"]

snapshot = {
    "captured_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "dataset": dataset, "queries": queries, "spark": spark, "dashboard": dashboard, "predictions": predictions,
    "benchmark": call("/api/benchmark"), "reviews": reviews,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(snapshot, indent=1))
print(f"Saved {len(reviews)} reviews, {len(spark)} query results, the dashboard and {len(predictions)} predictions to {OUT}")
