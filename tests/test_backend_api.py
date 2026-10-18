import csv
import io
from pathlib import Path
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import PROJECT_ROOT, Settings
from backend.app.main import create_app


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        model_path=PROJECT_ROOT / "models" / "final_model.joblib",
        database_path=tmp_path / "history.sqlite3",
        dataset_path=tmp_path / "missing-paysim.csv",
        cors_origins=("http://testserver",),
        max_upload_bytes=1024 * 1024,
        max_batch_rows=100,
    )
    with TestClient(create_app(settings)) as test_client:
        yield test_client


def transaction(**overrides):
    values = {
        "type": "TRANSFER",
        "amount": 181000,
        "oldbalanceOrg": 181000,
        "oldbalanceDest": 0,
        "step": 25,
        "nameOrig": "C100",
        "nameDest": "C200",
    }
    return {**values, **overrides}


def test_health_and_prediction_use_saved_model(client):
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["model"]["version"] == "1.0"
    assert health.json()["model"]["features"] == [
        "amount_log",
        "oldbalanceOrg_log",
        "oldbalanceDest_log",
        "amount_to_balance_ratio",
        "zero_old_balance_orig",
        "ratio_gap_to_one",
        "ratio_is_one",
        "type_TRANSFER",
    ]

    response = client.post("/api/predict", json=transaction())
    assert response.status_code == 200
    result = response.json()
    assert result["prediction"] in {"Fraud", "Legitimate"}
    assert result["is_fraud"] is (result["fraud_probability"] >= result["threshold"])
    assert result["risk_level"] == ("High" if result["is_fraud"] else "Low")


def test_batch_keeps_invalid_rows_and_saves_valid_predictions(client):
    content = (Path(__file__).parent / "fixtures" / "batch_sample.csv").read_text(
        encoding="utf-8"
    )
    response = client.post(
        "/api/predict/batch",
        files={"file": ("sample.csv", content, "text/csv")},
    )
    assert response.status_code == 200
    assert response.headers["x-total-rows"] == "3"
    assert response.headers["x-valid-rows"] == "1"
    assert response.headers["x-invalid-rows"] == "2"
    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert len(rows) == 3
    assert rows[0]["prediction"] in {"Fraud", "Legitimate"}
    assert rows[1]["error"]
    assert rows[2]["error"]
    assert rows[1]["fraud_probability"] == ""

    history = client.get("/api/transactions")
    assert history.json()["total"] == 1


def test_dashboard_and_transaction_history_are_live_and_separate(client):
    client.post("/api/predict", json=transaction())
    client.post("/api/predict", json=transaction(type="CASH_OUT", amount=40))

    dashboard = client.get("/api/dashboard/stats")
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["live"]["total_transactions"] == 2
    assert body["live"]["fraud_transactions"] + body["live"]["legitimate_transactions"] == 2
    assert body["dataset"]["available"] is False
    assert body["model"]["version"] == "1.0"

    page = client.get("/api/transactions", params={"page": 1, "page_size": 1})
    assert page.status_code == 200
    assert page.json()["total"] == 2
    assert page.json()["total_pages"] == 2
    first_id = page.json()["items"][0]["id"]
    assert client.get(f"/api/transactions/{first_id}").status_code == 200
    assert client.get("/api/transactions/9999").status_code == 404


def test_rejects_transaction_types_outside_model_scope(client):
    response = client.post("/api/predict", json=transaction(type="PAYMENT"))
    assert response.status_code == 422
    assert client.get("/api/transactions").json()["total"] == 0


def test_dashboard_trends_compare_two_real_history_periods(client):
    client.post("/api/predict", json=transaction())
    client.post("/api/predict", json=transaction(type="CASH_OUT", amount=40))
    client.post("/api/predict", json=transaction())
    client.post("/api/predict", json=transaction(type="CASH_OUT", amount=40))

    today = datetime.now(timezone.utc).date()
    previous_week = (today - timedelta(days=8)).isoformat() + "T12:00:00+00:00"
    current_week = (today - timedelta(days=1)).isoformat() + "T12:00:00+00:00"
    with sqlite3.connect(client.app.state.database.path) as connection:
        connection.execute(
            "UPDATE transactions SET created_at = ? WHERE id IN (1, 2)",
            (previous_week,),
        )
        connection.execute(
            "UPDATE transactions SET created_at = ? WHERE id IN (3, 4)",
            (current_week,),
        )

    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    trends = response.json()["live"]["weekly_trends"]
    assert trends["transactions_change_pct"] == 0
    assert trends["fraud_change_pct"] == 0
    assert trends["legitimate_change_pct"] == 0
    assert trends["fraud_rate_change_pp"] == 0
    assert trends["fraud_amount_change_pct"] == 0
