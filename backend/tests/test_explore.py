import csv
import io

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_demo(client):
    client.post("/api/reset")
    yield


def test_query_list(client):
    names = [q["name"] for q in client.get("/api/queries").json()]
    assert len(names) == 11
    assert "complaint_categories" in names
    assert "complaints_by_airline" in names


def test_rating_filter(client):
    body = client.get("/api/reviews", params={"min_rating": 8}).json()
    assert body["total"] == 4  # ratings 8, 9, 9, 10


def test_date_filter(client):
    body = client.get("/api/reviews", params={"date_from": "2024-03-01", "date_to": "2024-03-31"}).json()
    assert body["total"] == 5


def test_bad_date_is_rejected(client):
    assert client.get("/api/reviews", params={"date_from": "yesterday"}).status_code == 400


def test_export_csv(client):
    r = client.get("/api/export", params={"airline": "SkyWays"})
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(r.text)))
    assert rows[0] == ["airline", "review", "rating", "date"]
    assert len(rows) == 1 + 4  # header + 4 SkyWays reviews
