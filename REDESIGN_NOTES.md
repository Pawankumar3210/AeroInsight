# AeroInsight redesign: what's in this zip

Backend (replace these files):
  backend/app/spark_analytics.py   new dashboard query (4 parallel Spark SQL jobs, cached), complaints_by_airline, timing
  backend/app/main.py              new /api/dashboard, /api/dataset now carries dropdown options
  backend/app/make_snapshot.py     also saves the dashboard and 4 example predictions
  backend/tests/test_dashboard.py  NEW: 8 tests
  backend/tests/test_explore.py    updated (11 queries instead of 10)

Frontend (replace the whole src folder contents, plus these two):
  frontend/index.html
  frontend/tailwind.config.js
  frontend/src/**                  every file

New API: GET /api/dashboard?airline=&sentiment=&min_rating=&max_rating=&date_from=&date_to=
Expected backend tests after applying: 34 passed (26 before + 8 new).
