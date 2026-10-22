import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:  # runs startup: Spark boots once for all tests
        yield c


@pytest.fixture(autouse=True)
def reset_demo(client):
    client.post("/api/reset")  # every test starts from the demo data
    yield


def rows(client, name):
    r = client.get(f"/api/spark/{name}")
    assert r.status_code == 200
    return r.json()["rows"]


def upload(client, filename, content):
    return client.post("/api/upload", files={"file": (filename, content, "text/csv")})


def test_health_reports_cleaning(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["cleaning_report"]["rows_in"] == 11
    assert body["cleaning_report"]["rows_kept"] == 10
    assert body["cleaning_report"]["invalid_ratings_nulled"] == 1


def test_reviews_by_airline(client):
    got = {r["airline"]: r["total_reviews"] for r in rows(client, "reviews_by_airline")}
    assert got == {"SkyWays": 4, "BlueJet": 3, "CloudAir": 3}


def test_average_rating_ignores_invalid_rating(client):
    got = {r["airline"]: r for r in rows(client, "avg_rating_by_airline")}
    assert got["SkyWays"]["avg_rating"] == 6.0
    assert got["SkyWays"]["rated_reviews"] == 3


def test_complaint_categories(client):
    got = {r["category"]: r["mentions"] for r in rows(client, "complaint_categories")}
    assert got["Delays"] == 2
    assert got["Baggage"] == 1
    assert got["Food"] == 0


def test_low_rating_share_ranks_bluejet_first(client):
    top = rows(client, "low_rating_share_by_airline")[0]
    assert top["airline"] == "BlueJet"
    assert top["low_rating_pct"] == 66.7


def test_unknown_query_returns_404(client):
    assert client.get("/api/spark/not_a_query").status_code == 404


def test_review_search(client):
    body = client.get("/api/reviews", params={"search": "delay"}).json()
    assert body["total"] == 2


def test_upload_cleans_data(client):
    csv = (
        b"airline,review,rating,date\n"
        b'A,"good flight",8,2024-01-01\n'
        b'A,"good flight",8,2024-01-01\n'
        b'B,"bad rating value",99,2024-01-02\n'
        b"C,,5,2024-01-02\n"
    )
    r = upload(client, "mine.csv", csv)
    assert r.status_code == 200
    report = r.json()["cleaning_report"]
    assert (report["rows_in"], report["rows_kept"]) == (4, 2)
    assert report["invalid_ratings_nulled"] == 1


def test_bad_uploads_are_rejected_and_data_is_kept(client):
    r = upload(client, "wrong.csv", b"name,comment\nA,B\n")
    assert r.status_code == 400
    assert "Missing required columns" in r.json()["detail"]

    assert upload(client, "notes.txt", b"hello").status_code == 400

    # the demo data must still be active
    assert len(rows(client, "reviews_by_airline")) == 3
    