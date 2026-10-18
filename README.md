# HTVEX AI

A full-stack transaction risk dashboard for the existing PaySim fraud-detection model. The API loads the saved LightGBM artifact; it does not retrain the model or recreate its feature transformations. Predictions and batch results are persisted in a local SQLite database.

## What the model actually uses

The saved `models/final_model.joblib` bundle contains the classifier, feature order, model version, and a **0.5** classification threshold. It was trained for `CASH_OUT` and `TRANSFER` transactions only. The API accepts those transaction types and applies the existing transformations in `src/features/transaction_features.py` and `src/models/feature_sets.py`.

Required prediction inputs:

| PaySim input | Model use |
|---|---|
| `type` | Encoded as the saved `type_TRANSFER` feature |
| `amount` | `amount_log` and `amount_to_balance_ratio` |
| `oldbalanceOrg` | `oldbalanceOrg_log`, ratio, and zero-balance flag |
| `oldbalanceDest` | `oldbalanceDest_log` |

`ratio_gap_to_one` and `ratio_is_one` are derived using the existing training helper. `step`, `nameOrig`, and `nameDest` can be included as optional reference metadata; they are not model inputs. Post-transaction balances, fraud labels, and `isFlaggedFraud` are not accepted as prediction inputs.

Amounts are displayed in PaySim source units; the dataset does not specify a currency, so the application does not infer or convert one.

The model bundle is ignored by Git. Keep the existing trained file at `models/final_model.joblib` or point `MODEL_PATH` at its location before starting the API.

## Requirements

- Python 3.10+
- Node.js 20+
- The trained model bundle
- Optional: the PaySim source CSV for historical dataset analytics

## Launch on Windows

From the project directory, create and activate a virtual environment, then install the existing project and API dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip install -r backend\requirements.txt
Copy-Item .env.example .env
```

In a second terminal:

```powershell
Copy-Item frontend\.env.example frontend\.env
Set-Location frontend
npm ci
npm run dev
```

Start the backend from the project root in the first terminal:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --reload
```

Open the Vite URL (normally `http://localhost:5173`). The API is available at `http://127.0.0.1:8000`; interactive Swagger documentation is at `http://127.0.0.1:8000/docs`.

The first dashboard request calculates PaySim source statistics by streaming the configured CSV. This can take a little time for the full 6.3-million-row dataset. If the file is absent, live prediction features remain available and the dashboard clearly reports that source analytics are unavailable.

## Configuration

Copy `.env.example` to `.env` for the backend. Paths may be absolute or relative to the project root.

| Variable | Default | Description |
|---|---|---|
| `MODEL_PATH` | `models/final_model.joblib` | Existing trained model bundle |
| `DATABASE_PATH` | `.data/fraudguard.sqlite3` | Local prediction history |
| `PAYSIM_DATA_PATH` | `data/raw/PS_20174392719_1491204439457_log.csv` | Optional source data for labeled dataset metrics |
| `CORS_ORIGINS` | Local Vite dev/preview URLs | Comma-separated allowed browser origins |
| `MAX_UPLOAD_BYTES` | `26214400` | Maximum batch CSV upload size (25 MiB) |
| `MAX_BATCH_ROWS` | `100000` | Maximum rows in a batch |

The frontend reads `VITE_API_BASE_URL` from `frontend/.env`; see [frontend/.env.example](./frontend/.env.example).

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | API, SQLite, and model health |
| `POST` | `/api/predict` | Validate and score one transaction; save the result |
| `POST` | `/api/predict/batch` | Score a CSV and return a results CSV with invalid rows retained |
| `GET` | `/api/dashboard/stats` | Live prediction aggregates and separately labeled PaySim source metrics |
| `GET` | `/api/transactions` | Search, filter, sort, and paginate saved predictions |
| `GET` | `/api/transactions/{id}` | Saved transaction and prediction detail |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | OpenAPI schema |

Batch CSVs must include `type`, `amount`, `oldbalanceOrg`, and `oldbalanceDest`. Optional `step`, `nameOrig`, and `nameDest` values are preserved as metadata. Invalid rows are included in the output with an `error` value and are not scored or added to history.

Use [`tests/fixtures/htvex_ai_90000_transactions.csv`](./tests/fixtures/htvex_ai_90000_transactions.csv) to test batch uploads with 90,000 synthetic transactions. It contains only model-supported transaction types and the required input columns, with no fraud labels or claimed ground truth.

`GET /api/dashboard/stats` keeps live model decisions (SQLite history) distinct from PaySim `isFraud` ground-truth metrics. A dataset fraud label is not represented as a model prediction.

## Validation

From the project root:

```powershell
python -m pytest tests -q
Set-Location frontend
npm run build
```

The tests load the real saved artifact and exercise single prediction, batch CSV output, live dashboard metrics, input validation, and transaction history. The existing feature-engineering tests remain unchanged.
