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


def call(path: str, method: str = "GET"):
    req = urllib.request.Request(BASE + path, method=method, data=b"" if method == "POST" else None)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise SystemExit(f"{path} failed: HTTP {e.code} {e.read().decode()[:200]}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Cannot reach {BASE}: {e.reason}. Is the backend running?")


if (call("/api/dataset") or {}).get("source", "").startswith("Demo data") is False:
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
reviews = call("/api/reviews?limit=100&sort=date&order=desc")["rows"]

snapshot = {
    "captured_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "dataset": dataset, "queries": queries, "spark": spark,
    "benchmark": call("/api/benchmark"), "reviews": reviews,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(snapshot, indent=1))
print(f"Saved {len(reviews)} reviews and {len(spark)} query results to {OUT}")
