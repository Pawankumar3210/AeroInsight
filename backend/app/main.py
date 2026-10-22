from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import spark_analytics as sa
from .config import DEMO_CSV, FRONTEND_ORIGINS

state = {"report": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["report"] = sa.load_reviews(str(DEMO_CSV))  # Spark starts once, at startup
    yield


app = FastAPI(title="AeroInsight API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=FRONTEND_ORIGINS,
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "spark_version": sa.get_spark().version, "cleaning_report": state["report"]}


@app.get("/api/spark/{query_name}")
def spark_query(query_name: str):
    if query_name not in sa.QUERIES:
        raise HTTPException(404, f"Unknown query. Available: {list(sa.QUERIES)}")
    return sa.run_query(query_name)
