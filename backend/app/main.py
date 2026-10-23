import csv
import io
import threading
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import benchmark as bench
from . import sentiment as sent
from . import spark_analytics as sa
from .config import (DEMO_CSV, ENABLE_BENCHMARK_RUN, ENABLE_UPLOADS, FRONTEND_ORIGINS,
                     MAX_SCORE_ROWS, MAX_UPLOAD_MB, UPLOAD_DIR)

DEMO_LABEL = "Demo data (demo_reviews.csv, illustrative, not real research data)"
state = {"report": None, "source": None, "sentiment": None}
load_lock = threading.Lock()  # one dataset load or scoring run at a time
bench_lock = threading.Lock()


def _load(path: str, label: str) -> dict:
    with load_lock:
        report = sa.load_reviews(path)
        state["report"] = report
        state["source"] = label
        state["sentiment"] = None  # a new dataset has not been scored yet
    return report


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load(str(DEMO_CSV), DEMO_LABEL)  # Spark starts once, at startup
    yield


app = FastAPI(title="AeroInsight API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "spark_version": sa.get_spark().version,
            "source": state["source"], "cleaning_report": state["report"]}


@app.get("/api/dataset")
def dataset():
    return {"source": state["source"], "cleaning_report": state["report"],
            "required_columns": sa.REQUIRED_COLUMNS, "sentiment": state["sentiment"],
            "uploads_enabled": ENABLE_UPLOADS}


@app.get("/api/queries")
def list_queries():
    return [{"name": k, "purpose": v["purpose"], "needs_sentiment": v.get("needs_sentiment", False)}
            for k, v in sa.QUERIES.items()]


@app.get("/api/spark/{query_name}")
def spark_query(query_name: str):
    if query_name not in sa.QUERIES:
        raise HTTPException(404, f"Unknown query. Available: {list(sa.QUERIES)}")
    try:
        return sa.run_query(query_name)
    except sa.SentimentNotScored:
        raise HTTPException(409, "This query needs sentiment scores. "
                                 "Run POST /api/sentiment/score first.")


@app.get("/api/reviews")
def reviews(search: str = "", airline: str = "", sentiment: str = "",
            min_rating: float | None = None, max_rating: float | None = None,
            date_from: str = "", date_to: str = "",
            sort: str = "date", order: str = "desc",
            limit: int = Query(25, ge=1, le=100), offset: int = Query(0, ge=0, le=10000)):
    try:
        return sa.search_reviews(search, airline, sort, order, limit, offset,
                                 sentiment=sentiment, min_rating=min_rating,
                                 max_rating=max_rating, date_from=date_from,
                                 date_to=date_to)
    except ValueError as e:
        raise HTTPException(400, str(e))


EXPORT_MAX_ROWS = 100_000


@app.get("/api/export")
def export(search: str = "", airline: str = "", sentiment: str = "",
           min_rating: float | None = None, max_rating: float | None = None,
           date_from: str = "", date_to: str = ""):
    """Download the filtered reviews (with sentiment, if scored) as a CSV file."""
    try:
        df = sa.filtered_reviews(search, airline, sentiment, min_rating, max_rating,
                                 date_from, date_to)
    except ValueError as e:
        raise HTTPException(400, str(e))
    columns = df.columns

    def stream():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        yield buf.getvalue()
        for i, row in enumerate(df.orderBy("date", "review").toLocalIterator()):
            if i >= EXPORT_MAX_ROWS:
                break
            buf.seek(0)
            buf.truncate(0)
            writer.writerow(row)
            yield buf.getvalue()

    return StreamingResponse(
        stream(), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="aeroinsight_reviews.csv"'},
    )


# ---------- sentiment ----------
class PredictIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


@app.get("/api/sentiment/status")
def sentiment_status():
    return sent.status()


@app.post("/api/sentiment/predict")
def sentiment_predict(body: PredictIn):
    try:
        result = sent.predict([body.text])[0]
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {**result, "note": sent.DISCLAIMER}


@app.post("/api/sentiment/score")
def sentiment_score():
    """Score the current dataset's reviews and add sentiment columns."""
    start = time.perf_counter()
    with load_lock:
        try:
            summary = sa.attach_sentiment(sent.predict, MAX_SCORE_ROWS)
        except RuntimeError as e:
            raise HTTPException(503, str(e))
        summary["seconds"] = round(time.perf_counter() - start, 2)
        summary["note"] = sent.DISCLAIMER
        state["sentiment"] = summary
    return summary


# ---------- data ----------
@app.post("/api/upload")
def upload(file: UploadFile = File(...)):
    if not ENABLE_UPLOADS:
        raise HTTPException(403, "Uploads are disabled on this server.")
    name = file.filename or ""
    if not name.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a file ending in .csv")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / f"{uuid.uuid4().hex}.csv"
    limit_bytes = MAX_UPLOAD_MB * 1024 * 1024
    size, too_big = 0, False

    with open(dest, "wb") as out:  # stream to disk in 1 MB chunks, never all in memory
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > limit_bytes:
                too_big = True
                break
            out.write(chunk)
    if too_big:
        dest.unlink(missing_ok=True)
        raise HTTPException(413, f"File is larger than the {MAX_UPLOAD_MB} MB limit.")

    try:
        report = _load(str(dest), f"Uploaded file: {name}")
    except ValueError as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, str(e))
    except Exception:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "Could not read this file as a CSV. Check it is a "
                                 "comma-separated text file with a header row.")

    for old in UPLOAD_DIR.glob("*.csv"):  # keep only the active upload
        if old != dest:
            old.unlink(missing_ok=True)
    return {"message": "Upload processed", "source": state["source"], "cleaning_report": report}


@app.post("/api/reset")
def reset():
    if not ENABLE_UPLOADS:
        raise HTTPException(403, "Resetting is disabled on this server.")
    report = _load(str(DEMO_CSV), DEMO_LABEL)
    return {"message": "Demo data restored", "source": state["source"], "cleaning_report": report}


# ---------- benchmark ----------
@app.get("/api/benchmark")
def benchmark_results():
    saved = bench.load_saved()
    if saved is None:
        raise HTTPException(404, "No benchmark has been run yet. Run: python -m app.benchmark")
    return saved


@app.post("/api/benchmark")
def benchmark_run(sizes: str = "1000,10000,100000"):
    if not ENABLE_BENCHMARK_RUN:
        raise HTTPException(403, "Running benchmarks is disabled on this server.")
    try:
        parsed = [int(s) for s in sizes.split(",") if s.strip()]
    except ValueError:
        raise HTTPException(400, "sizes must be comma-separated whole numbers")
    if not bench_lock.acquire(blocking=False):
        raise HTTPException(409, "A benchmark is already running.")
    try:
        return bench.run_benchmark(parsed)
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        bench_lock.release()
        