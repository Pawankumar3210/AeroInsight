import pytest
from fastapi.testclient import TestClient

from app import sentiment as sent
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_demo(client):
    client.post("/api/reset")
    yield


def rows(client, name):
    r = client.get(f"/api/spark/{name}")
    assert r.status_code == 200
    return r.json()["rows"]


def test_preprocess_cleans_text():
    assert sent.preprocess("  Great   flight  http://x.com/a @bob ") == "Great flight http @user"


def test_fallback_labels_are_honest():
    out = sent.predict(["Great legroom and excellent service.",
                        "Rude staff and a dirty cabin.",
                        "Average experience, nothing special."])
    assert [r["label"] for r in out] == ["positive", "negative", "neutral"]
    assert all(r["method"] == "fallback-lexicon" for r in out)
    assert all(0 <= r["confidence"] <= 1 for r in out)


def test_empty_text_raises():
    with pytest.raises(ValueError):
        sent.predict(["   "])


def test_predict_endpoint(client):
    r = client.post("/api/sentiment/predict", json={"text": "Lost my bags, terrible service"})
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == "negative"
    assert body["method"] == "fallback-lexicon"
    assert "note" in body


def test_predict_endpoint_rejects_blank_text(client):
    assert client.post("/api/sentiment/predict", json={"text": "   "}).status_code == 400


def test_status_reports_method(client):
    client.post("/api/sentiment/predict", json={"text": "Great flight"})
    assert client.get("/api/sentiment/status").json()["method"] == "fallback-lexicon"


def test_sentiment_queries_need_scoring_first(client):
    assert client.get("/api/spark/sentiment_counts").status_code == 409


def test_scoring_and_sentiment_queries(client):
    r = client.post("/api/sentiment/score")
    assert r.status_code == 200
    s = r.json()
    assert (s["scored_rows"], s["unscored_rows"]) == (10, 0)
    assert s["method"] == "fallback-lexicon"

    counts = {x["sentiment"]: x for x in rows(client, "sentiment_counts")}
    assert counts["negative"]["reviews"] == 5
    assert counts["positive"]["reviews"] == 4
    assert counts["neutral"]["reviews"] == 1
    assert counts["negative"]["pct"] == 50.0

    vs = {x["sentiment"]: x["avg_rating"] for x in rows(client, "sentiment_vs_rating")}
    assert vs["positive"] == 9.0
    assert vs["negative"] == 2.75

    trend = {x["month"]: x["negative_pct"] for x in rows(client, "negative_trend_monthly")}
    assert trend == {"2024-01": 50.0, "2024-02": 66.7, "2024-03": 40.0}

    top = rows(client, "negative_share_by_airline")[0]
    assert top["airline"] == "BlueJet" and top["negative_pct"] == 66.7


def test_review_search_by_sentiment(client):
    client.post("/api/sentiment/score")
    body = client.get("/api/reviews", params={"sentiment": "negative"}).json()
    assert body["total"] == 5
    assert all(r["sentiment"] == "negative" for r in body["rows"])
    