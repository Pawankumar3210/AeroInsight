# AeroInsight: Aviation Data Analytics, a Spark SQL Approach to Sentiment Analysis

A web app that analyses airline passenger reviews. **Apache Spark SQL** runs the analytics and a pretrained
**transformer** classifies each review as positive, neutral or negative.

> **Data warning:** the bundled `backend/data/demo_reviews.csv` contains 11 *invented* rows (one duplicate and one
> invalid rating on purpose, to test cleaning). It is not real research data. No findings about real airlines
> are claimed anywhere in this project. No public review dataset is bundled yet (see "Dataset").

## Architecture

```
CSV ──► PySpark DataFrame (clean, validate, dedupe) ──► temp view "reviews"
                                  │
          transformer scores unique reviews ──► joined back as sentiment columns
                                  │
                      Spark SQL queries (app/spark_analytics.py)
                                  │
                      FastAPI endpoints (app/main.py) ──► React + Recharts UI
```

| Folder | Purpose |
|---|---|
| `backend/app/spark_analytics.py` | Cleaning and every Spark SQL query |
| `backend/app/sentiment.py` | Transformer inference, caching, labelled fallback |
| `backend/app/benchmark.py` | Spark SQL vs pandas timing |
| `backend/app/main.py` | API routes, upload validation, CSV export |
| `backend/app/make_snapshot.py` | Saves real responses for demo mode |
| `frontend/` | React, Vite, TypeScript, Tailwind, Recharts |

## Prerequisites (Ubuntu)

Python 3.11 (via `uv`), Java 17 or 21, Node 18+, Git. Docker is optional.

```bash
sudo apt install -y openjdk-17-jdk
curl -LsSf https://astral.sh/uv/install.sh | sh && source $HOME/.local/bin/env
uv python install 3.11
```

Python 3.14 is too new for PySpark 3.5 and PyTorch 2.2. Use 3.11.

## Run locally

```bash
# backend
cd backend
uv venv --python 3.11 .venv && source .venv/bin/activate
uv pip install torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements.txt
python -m app.download_model          # one-time, about 500 MB
python -m uvicorn app.main:app --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                           # open http://localhost:5173
```

The first start takes 15 to 30 seconds while Spark boots. Click **Score reviews** once to run the transformer
(scores are kept in memory and are lost when the backend restarts).

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `FRONTEND_ORIGINS` | `http://localhost:5173` | Allowed CORS origins, comma-separated (backend) |
| `SENTIMENT_MODE` | `auto` | `auto`, `transformer` (never fall back) or `fallback` |
| `SENTIMENT_MODEL` | `cardiffnlp/twitter-roberta-base-sentiment-latest` | Hugging Face model id |
| `SENTIMENT_BATCH_SIZE` | `16` | Reviews per model batch |
| `MAX_SCORE_ROWS` | `2000` | Unique reviews scored per run |
| `MAX_UPLOAD_MB` | `50` | Upload size limit |
| `MIN_AIRLINE_SAMPLE` | `3` | Minimum reviews for airline rankings (use 30+ on real data) |
| `ENABLE_UPLOADS` | `true` | Set `false` on a public server |
| `ENABLE_BENCHMARK_RUN` | `true` | Allow `POST /api/benchmark` |
| `VITE_API_URL` | `http://localhost:8000` | Backend URL for the frontend. `none` = always show the demo snapshot |

No API keys are used anywhere.

## API

`GET /api/health`, `/api/dataset`, `/api/queries`, `/api/spark/{query}`, `/api/reviews`, `/api/export`,
`/api/sentiment/status`, `/api/benchmark`; `POST /api/sentiment/predict`, `/api/sentiment/score`, `/api/upload`,
`/api/reset`, `/api/benchmark`. Interactive docs: http://localhost:8000/docs

## Spark SQL queries

Ten queries live in `backend/app/spark_analytics.py` and are shown with their real results on the
**Spark SQL Insights** page: reviews and average rating per airline, rating distribution, monthly trend, complaint
categories (keyword matching, not an ML model), low-rating share, sentiment counts and percentages, sentiment vs
rating, negative trend over time, negative share per airline (with a minimum sample size).

Cleaning: trims text, drops empty reviews/airlines and exact duplicates (airline + review + date), turns ratings
outside 1 to 10 into NULL (the review is kept, excluded from averages), and reports every count.

## Sentiment model

`cardiffnlp/twitter-roberta-base-sentiment-latest` (Cardiff NLP, via Hugging Face). It was trained on social-media
text, **not airline reviews**, so it can misjudge aviation wording; high confidence does not mean a correct label.
See the model card for its training data and license. If it cannot load (and `SENTIMENT_MODE=auto`), a tiny
word-list fallback is used and every result is labelled `fallback-lexicon`. It is never reported as the transformer.

## Benchmark

`python -m app.benchmark` times Spark SQL against pandas on synthetic CSVs (1k to 500k rows): 3 runs per size after a
discarded warm-up, median reported, results must match. **On the author's laptop pandas was faster at every size
tested** (about 18x at 1,000 rows, about 1.4x at 500,000), because Spark has a fixed start-up cost. This shows
nothing about clusters or data larger than memory, where Spark is designed to be used. Results are in
`backend/data/benchmark_results.json` and on the Spark SQL Insights page.

## Tests

```bash
cd backend && source .venv/bin/activate && python -m pytest -q    # 26 tests
```

Tests use the fallback, so they never download the model. Cleaning, SQL results, search, upload validation,
export and benchmark behaviour are covered. The frontend has no automated tests; it is type-checked with
`npm run build`.

## Data upload

CSV with columns `airline, review, rating (1-10), date (YYYY-MM-DD)`. Files are streamed to disk, limited by
`MAX_UPLOAD_MB`, and a bad file never replaces the current data. The backend holds **one dataset**: an upload
replaces it for every user, so disable uploads on public servers (`ENABLE_UPLOADS=false`). Scoring is capped at
`MAX_SCORE_ROWS` unique reviews per run; larger files are analysed in Spark but the unscored remainder is reported.
Test larger data by uploading a bigger CSV and raising the limits.

## Demo-data mode

If the frontend cannot reach the backend it shows `frontend/public/demo-snapshot.json`: saved responses from a real
run, with a banner that says no live query is running. Regenerate it with the backend running:
`cd backend && python -m app.make_snapshot`. Snapshot mode cannot score, analyse new text or upload.

## Deploy the frontend (Vercel)

1. Push this repo to GitHub.
2. In Vercel: **Add New, Project**, import the repo, set **Root Directory** to `frontend`.
3. Add the environment variable `VITE_API_URL`: use `none` for snapshot-only, or your backend's https URL.
4. Deploy. (Check Vercel's current plan terms for your use.)

Vercel Functions are not suitable for this backend (Java + Spark + PyTorch).

## Deploy the backend (Docker)

```bash
cd backend
docker build -t aeroinsight-backend .
docker run --rm -p 8000:8000 -e FRONTEND_ORIGINS=https://your-app.vercel.app -e ENABLE_UPLOADS=false aeroinsight-backend
```

Measured on the author's machine: image 3.67 GB on disk (1.23 GB compressed), about 1.2 GiB RAM after the model
loaded and 10 reviews were scored (a light-load snapshot, not a maximum). Hosting needs Java and several GB of
disk, and at least 2 GB of RAM is a sensible minimum. Checked in October 2026 and subject to change:

- Render free instances have 512 MB RAM, so this does not fit; they also spin down after 15 minutes idle.
- Hugging Face Docker Spaces list 16 GB RAM / 2 vCPU and sleep when idle. Their docs disagree on whether Docker Spaces
  are free for new accounts, so check at signup. Deploying there is **not yet tested** and may need a README header,
  the right port, and non-root file permissions.

Expect cold starts and a slow first request while the model loads.

## Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` | Activate the venv, use `python -m uvicorn` |
| `Could not import module "app.main"` | A file is missing; run `ls app/` and recreate it |
| Install seems frozen on `pyspark` | It is a 300 MB download; wait |
| Docker `permission denied` | `sudo apt install util-linux-extra`, then `newgrp docker`, or log out and in |
| Docker `port is already allocated` | `docker ps`, then `docker stop <name>` |
| Docker `crc32 mismatch` | Retry the build; if it repeats, `docker builder prune -af` |
| `openjdk-17 has no installation candidate` in Docker | The Dockerfile uses Java 21 for Debian trixie |
| Page says "Cannot reach the backend" | Start the backend; open the app via `localhost`, not `127.0.0.1` |

## Attribution and limitations

- **Demo data:** invented for this project.
- **Public dataset:** none bundled yet. If you add one, record its source, license and preprocessing here.
- **Model:** see above and its Hugging Face model card.
- **Limitations:** model not tuned for aviation; keyword complaint themes miss synonyms and negation; one shared
  dataset; scores are lost on restart; small samples give unreliable percentages; no scraping is done.
  