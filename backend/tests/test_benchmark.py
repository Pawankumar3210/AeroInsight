import pytest
from fastapi.testclient import TestClient

from app import benchmark as bench
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def isolate(client, tmp_path, monkeypatch):
    monkeypatch.setattr(bench, "BENCHMARK_FILE", tmp_path / "bench.json")
    client.post("/api/reset")
    yield


def test_engines_agree_and_report_is_honest():
    rep = bench.run_benchmark([200, 400], repeats=1)
    assert [r["rows"] for r in rep["results"]] == [200, 400]
    assert all(r["results_match"] for r in rep["results"])
    assert "Synthetic" in rep["data"]
    assert len(rep["methodology"]) >= 5


def test_size_limits():
    with pytest.raises(ValueError):
        bench.run_benchmark([10**9])
    with pytest.raises(ValueError):
        bench.run_benchmark([])


def test_benchmark_endpoints_and_demo_data_untouched(client):
    assert client.get("/api/benchmark").status_code == 404
    r = client.post("/api/benchmark", params={"sizes": "300"})
    assert r.status_code == 200
    assert r.json()["results"][0]["results_match"] is True
    assert client.get("/api/benchmark").status_code == 200
    assert client.get("/api/reviews").json()["total"] == 10  # demo view unchanged
    assert client.post("/api/benchmark", params={"sizes": "abc"}).status_code == 400
    