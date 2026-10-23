"""Spark SQL vs pandas benchmark.   Run:  python -m app.benchmark [sizes...]"""
import csv
import json
import os
import platform
import random
import statistics
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import spark_analytics as sa
from .config import BENCHMARK_FILE, BENCHMARK_MAX_ROWS

DEFAULT_SIZES = [1_000, 10_000, 100_000, 500_000]
REPEATS = 3
AIRLINES = [f"Airline {c}" for c in "ABCDEFGHIJ"]
TEXTS = [
    "Flight was delayed two hours and nobody told us why.",
    "Lovely crew, comfortable seats, would fly again.",
    "Lost my baggage and customer service was unhelpful.",
    "Smooth flight and the food was surprisingly good.",
    "Seats were cramped and the cabin was dirty.",
    "On time, friendly staff, easy check-in.",
    "Average experience, nothing special.",
    "Another delay, and rude gate staff.",
    "Great legroom and excellent service.",
]

SPARK_SQL = """
    SELECT airline, date_format(date, 'yyyy-MM') AS month,
           COUNT(*) AS reviews, ROUND(AVG(rating), 2) AS avg_rating
    FROM bench_reviews
    GROUP BY airline, date_format(date, 'yyyy-MM')
"""


def generate_csv(path: Path, n: int, seed: int = 42) -> None:
    """Write n synthetic rows. Random data: only for timing, never for findings."""
    rng = random.Random(seed)
    start = date(2022, 1, 1)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["airline", "review", "rating", "date"])
        for _ in range(n):
            d = start + timedelta(days=rng.randrange(730))
            w.writerow([rng.choice(AIRLINES), rng.choice(TEXTS), rng.randint(1, 10), d.isoformat()])


def run_spark(path: Path):
    spark = sa.get_spark()
    t = time.perf_counter()
    df = (spark.read.option("header", True)
          .schema("airline string, review string, rating double, date date").csv(str(path)))
    df.createOrReplaceTempView("bench_reviews")  # separate view: never touches "reviews"
    rows = spark.sql(SPARK_SQL).collect()
    return time.perf_counter() - t, len(rows), int(sum(r["reviews"] for r in rows))


def run_pandas(path: Path):
    import pandas as pd
    t = time.perf_counter()
    df = pd.read_csv(path, dtype={"airline": "string", "review": "string", "date": "string"})
    df["month"] = df["date"].str[:7]
    out = (df.groupby(["airline", "month"])
             .agg(reviews=("rating", "size"), avg_rating=("rating", "mean")).reset_index())
    return time.perf_counter() - t, len(out), int(out["reviews"].sum())


def load_saved():
    try:
        return json.loads(Path(BENCHMARK_FILE).read_text())
    except (FileNotFoundError, ValueError):
        return None


def run_benchmark(sizes, repeats: int = REPEATS) -> dict:
    sizes = sorted(set(sizes))
    if not sizes or len(sizes) > 6:
        raise ValueError("Give between 1 and 6 dataset sizes.")
    if any(s < 1 or s > BENCHMARK_MAX_ROWS for s in sizes):
        raise ValueError(f"Each size must be between 1 and {BENCHMARK_MAX_ROWS} rows.")
    import pandas as pd

    results = []
    with tempfile.TemporaryDirectory() as tmp:
        warm = Path(tmp) / "warmup.csv"
        generate_csv(warm, 1000)
        run_spark(warm)  # warm-up (JVM start, code paths): discarded
        run_pandas(warm)

        for n in sizes:
            path = Path(tmp) / f"bench_{n}.csv"
            generate_csv(path, n)
            spark_runs, pandas_runs, ok = [], [], True
            for _ in range(repeats):
                s = run_spark(path)
                p = run_pandas(path)
                spark_runs.append(round(s[0], 3))
                pandas_runs.append(round(p[0], 3))
                ok = ok and s[1:] == p[1:] and s[2] == n  # same groups, same total
            sm, pm = statistics.median(spark_runs), statistics.median(pandas_runs)
            faster = "spark" if sm < pm else "pandas"
            results.append({
                "rows": n,
                "file_mb": round(path.stat().st_size / 1_048_576, 2),
                "spark_median_s": round(sm, 3), "pandas_median_s": round(pm, 3),
                "spark_runs_s": spark_runs, "pandas_runs_s": pandas_runs,
                "faster": faster,
                "speed_ratio": round(max(sm, pm) / max(min(sm, pm), 1e-9), 2),
                "results_match": ok,
            })
            path.unlink()

    report = {
        "run_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "data": "Synthetic random reviews generated for timing only. Not real airline data.",
        "task": "Read the CSV, then count reviews and average the rating per airline per month.",
        "spark_sql": SPARK_SQL.strip(),
        "machine": {"cpu_threads": os.cpu_count(), "python": platform.python_version(),
                    "spark": sa.get_spark().version, "spark_master": "local[2] (2 threads)",
                    "pandas": pd.__version__, "pandas_threads": 1},
        "methodology": [
            f"Each size is run {repeats} times per engine; the median is reported (all runs are listed).",
            "Both engines read the same CSV from disk, so reading time is included for both.",
            "One discarded warm-up run happens first so JVM start-up is not counted.",
            "Spark uses 2 local threads; pandas uses 1. Timings depend on this machine and other running programs.",
            "A run only counts as valid if both engines return the same number of groups and the same total.",
            "Results from one laptop do not predict a cluster. Spark is designed for data larger than one machine's memory.",
        ],
        "results": results,
    }
    Path(BENCHMARK_FILE).write_text(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    args = [int(a) for a in sys.argv[1:]] or DEFAULT_SIZES
    print(f"Benchmarking sizes {args} ({REPEATS} runs each). This can take a few minutes...")
    rep = run_benchmark(args)
    print(f"\n{'rows':>9} {'MB':>7} {'spark(s)':>9} {'pandas(s)':>10}  faster   match")
    for r in rep["results"]:
        print(f"{r['rows']:>9} {r['file_mb']:>7} {r['spark_median_s']:>9} {r['pandas_median_s']:>10}  "
              f"{r['faster']:<7}  {r['results_match']}")
    print(f"\nSaved to {BENCHMARK_FILE}")
    