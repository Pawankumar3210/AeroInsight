# AeroInsight

**Aviation Data Analytics: a Spark SQL approach to sentiment analysis**

**Live demo: https://aeroinsightapp.vercel.app/**

AeroInsight analyses airline passenger reviews. Apache Spark SQL does the analytics, and a pretrained
transformer classifies each review as positive, neutral or negative. The interface shows the SQL behind every number.

> **Data warning:** the bundled `backend/data/demo_reviews.csv` holds 11 *invented* rows (one duplicate and one
> invalid rating on purpose, to test cleaning). It is not real research data and says nothing about real airlines.

## What it does

- **Overview:** KPIs, sentiment mix, monthly trend, rating distribution, complaint themes, plain-English insights, and
  filters (airline, sentiment, rating, date) that run as Spark SQL.
- **Airline Comparison:** leaderboard with small-sample flags, rating-vs-negativity chart, complaint heatmap per airline.
- **Review Explorer:** search, sort, filter, review detail drawer, CSV upload with validation, CSV export.
- **Live Sentiment Analyzer:** paste any review and get a verdict, confidence and per-class scores.
- **Spark SQL Insights:** 11 named queries with their SQL, live results and timings, plus a Spark vs pandas benchmark.

## How it works

```
CSV -> PySpark DataFrame (clean, validate, dedupe) -> temp view "reviews"
         -> transformer scores unique reviews, joined back as sentiment columns
         -> Spark SQL queries -> FastAPI JSON -> React + Recharts interface
```

| Part | Technology |
|---|---|
| Analytics | Apache Spark 3.5 (PySpark), Spark SQL |
| API | Python 3.11, FastAPI |
| Sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` (PyTorch, Transformers) |
| Frontend | React, Vite, TypeScript, Tailwind CSS, Recharts |

## Run it locally (Ubuntu)

Needs Python 3.11 (via [`uv`](https://docs.astral.sh/uv/)), Java 17 or 21, Node 18+ and Git.

```bash
# backend
cd backend
uv venv --python 3.11 .venv && source .venv/bin/activate
uv pip install torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements.txt
python -m app.download_model            # one time, about 500 MB
python -m uvicorn app.main:app --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                             # open http://localhost:5173
```

The first start takes 15 to 30 seconds while Spark boots. Click **Score reviews** once to run the transformer.
Scores live in memory and are lost when the backend restarts.

## Live demo mode (what Vercel serves)

The hosted site is **frontend only**. With `VITE_API_URL=none` it shows `frontend/public/demo-snapshot.json`: saved
responses from a real run (real Spark SQL results and real transformer predictions), under an amber banner saying nothing
is computed live. In this mode filters, scoring, uploads and analysing your own text are switched off; only the four
example reviews in the Analyzer work. Regenerate the snapshot with the backend running:

```bash
cd backend && python -m app.make_snapshot
```

If the frontend cannot reach a backend it falls back to the same snapshot automatically.

## Tests

```bash
cd backend && source .venv/bin/activate && python -m pytest -q     # 34 tests
cd frontend && npm run build                                       # type-checks and builds
```

Tests use a word-list fallback, so they never download the model. The frontend has no automated UI tests.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend URL for the frontend. `none` = snapshot only |
| `FRONTEND_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `SENTIMENT_MODE` | `auto` | `auto`, `transformer` (never fall back) or `fallback` |
| `MAX_SCORE_ROWS` | `2000` | Unique reviews scored per run |
| `MAX_UPLOAD_MB` | `50` | Upload size limit |
| `MIN_AIRLINE_SAMPLE` | `3` | Minimum reviews to rank an airline (use 30+ on real data) |
| `ENABLE_UPLOADS` | `true` | Set `false` on any public backend |
| `ENABLE_BENCHMARK_RUN` | `true` | Allow `POST /api/benchmark` |

No API keys or secrets are used anywhere.

## API

`GET /api/health`, `/api/dataset`, `/api/queries`, `/api/spark/{query}`, `/api/dashboard`, `/api/reviews`,
`/api/export`, `/api/sentiment/status`, `/api/benchmark`.
`POST /api/sentiment/predict`, `/api/sentiment/score`, `/api/upload`, `/api/reset`, `/api/benchmark`.
Interactive docs at http://localhost:8000/docs.

## Deployment

**Frontend (Vercel, Hobby plan):** import the repo, set **Root Directory** to `frontend`, add the environment variable
`VITE_API_URL=none`, deploy. Vercel redeploys on every push to `main`. Vercel Functions are not suitable for the backend.

**Backend (Docker, optional):**

```bash
cd backend && docker build -t aeroinsight-backend .
docker run --rm -p 8000:8000 -e ENABLE_UPLOADS=false -e FRONTEND_ORIGINS=https://aeroinsightapp.vercel.app aeroinsight-backend
```

Measured on the author's machine: image 3.67 GB on disk, about 1.2 GiB RAM with the model loaded and 10 reviews scored
(a light-load figure, not a maximum). A host needs Java, several GB of disk and at least 2 GB of RAM. Free hosting tiers
change often and the hosted-backend route has not been tested, so verify limits before relying on one. Expect cold starts.

## Benchmark (honest result)

`python -m app.benchmark` times Spark SQL against pandas on synthetic CSVs (3 runs per size, median reported, results must
match). On the author's laptop **pandas was faster at every size tested** (about 18x at 1,000 rows, about 1.4x at 500,000),
because Spark has a fixed start-up cost. This says nothing about clusters or data larger than memory, where Spark is built to run.

## Limitations

- The model was trained on social-media text, not airline reviews, so it can misjudge aviation wording. High confidence is not accuracy.
- Complaint themes use keyword matching, which misses synonyms and negation.
- The backend holds one dataset at a time; an upload replaces it for everyone.
- Small samples give unreliable percentages, so airlines below the minimum sample size are flagged.
- No website is scraped. To analyse real data, upload a CSV you have the right to use and record its source and license here.

## Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` | Activate the venv and use `python -m uvicorn` |
| Page says it cannot reach the backend | Start the backend; open the app via `localhost`, not `127.0.0.1` |
| Amber "Demo snapshot" banner locally | The backend is not running or not on port 8000 |
| Docker `permission denied` | Log out and back in after adding yourself to the `docker` group |
| Install looks frozen on `pyspark` | It is a 300 MB download; wait |

## Attribution

Sentiment model: [`cardiffnlp/twitter-roberta-base-sentiment-latest`](https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest)
by Cardiff NLP, via Hugging Face. See its model card for training data and license terms. Demo reviews: invented for this project.

## Project structure

```
backend/   FastAPI app (app/), Spark SQL analytics, sentiment, benchmark, tests, Dockerfile
frontend/  React app (src/), snapshot and icons (public/), Vercel config
```
