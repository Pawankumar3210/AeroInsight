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


def dash(client, **params):
    r = client.get("/api/dashboard", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_dashboard_unfiltered(client):
    d = dash(client)
    assert d["scored"] is False
    assert d["kpis"]["reviews"] == 10 and d["kpis"]["airlines"] == 3
    assert d["kpis"]["avg_rating"] == 5.89 and d["kpis"]["rated_reviews"] == 9
    by = {a["airline"]: a for a in d["airlines"]}
    assert by["SkyWays"]["reviews"] == 4 and by["SkyWays"]["avg_rating"] == 6.0
    assert by["BlueJet"]["low_rating_pct"] == 66.7
    assert {m["month"]: m["reviews"] for m in d["monthly"]} == {"2024-01": 2, "2024-02": 3, "2024-03": 5}
    assert {c["category"]: c["mentions"] for c in d["complaints"]}["Delays"] == 2
    assert d["options"]["airlines"] == ["BlueJet", "CloudAir", "SkyWays"]
    assert d["options"]["date_min"] == "2024-01-05" and d["options"]["date_max"] == "2024-03-22"
    assert "filtered_reviews" in d["sql"]["airlines"]
    assert set(d["sql"]) == {"airlines", "rating_distribution", "monthly", "complaints"}


def test_dashboard_filters(client):
    d = dash(client, airline="SkyWays")
    assert d["kpis"]["reviews"] == 4 and d["kpis"]["airlines"] == 1
    d = dash(client, min_rating=8)
    assert d["kpis"]["reviews"] == 4
    d = dash(client, date_from="2024-03-01", date_to="2024-03-31")
    assert d["kpis"]["reviews"] == 5
    d = dash(client, airline="Nope")
    assert d["kpis"]["reviews"] == 0 and d["airlines"] == [] and d["monthly"] == []


def test_dashboard_bad_input(client):
    assert client.get("/api/dashboard", params={"date_from": "soon"}).status_code == 400
    assert client.get("/api/dashboard", params={"sentiment": "negative"}).status_code == 400  # not scored


def test_dashboard_scored(client):
    client.post("/api/sentiment/score")
    d = dash(client)
    assert d["scored"] is True
    assert {s["sentiment"]: s["reviews"] for s in d["sentiment"]} == {"negative": 5, "positive": 4, "neutral": 1}
    by = {a["airline"]: a for a in d["airlines"]}
    assert by["BlueJet"]["negative_pct"] == 66.7 and by["BlueJet"]["scored_reviews"] == 3
    neg = dash(client, sentiment="negative")
    assert neg["kpis"]["reviews"] == 5


def test_complaints_by_airline_and_timing(client):
    r = client.get("/api/spark/complaints_by_airline").json()
    got = {(x["airline"], x["category"]): x["mentions"] for x in r["rows"]}
    assert got[("BlueJet", "Customer service")] == 2
    assert got[("SkyWays", "Delays")] == 1
    assert isinstance(r["elapsed_ms"], int)


def test_dashboard_leaves_no_temp_views(client):
    from app import spark_analytics as sa
    dash(client)
    names = [t.name for t in sa.get_spark().catalog.listTables()]
    assert not any(n.startswith("dash_") for n in names)


def test_dataset_carries_options(client):
    o = client.get("/api/dataset").json()["options"]
    assert o["airlines"] == ["BlueJet", "CloudAir", "SkyWays"]
    assert o["date_min"] == "2024-01-05"


def test_dashboard_cache_is_used_and_cleared(client):
    first = dash(client)
    assert first["cached"] is False
    second = dash(client)
    assert second["cached"] is True and second["kpis"] == first["kpis"]
    client.post("/api/sentiment/score")  # scoring changes the data, so the cache must be cleared
    third = dash(client)
    assert third["cached"] is False and third["scored"] is True
