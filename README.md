# FinGuard-ML — Transaction Fraud Detection

This project studies transaction fraud detection on the PaySim dataset, from data understanding and leakage analysis through feature engineering, model comparison, and final model evaluation. The selected model is a class-weighted LightGBM classifier for `CASH_OUT` and `TRANSFER` transactions. A FastAPI service and interactive dashboard expose the trained model for individual scoring, batch analysis, and transaction-level review.

The final model bundle is included in the repository. The notebooks document the analysis and training workflow; they do not need to be rerun to use the saved model.

## Project structure

```text
FinGuard-ML/
├── notebooks/                       # Data analysis, feature work, and model evaluation
│   ├── 01_data_understanding.ipynb
│   ├── 02_data_quality.ipynb
│   ├── 03_eda.ipynb
│   ├── 04_leakage_analysis.ipynb
│   ├── 05_feature_engineering.ipynb
│   ├── 06_baseline_models.ipynb
│   ├── 07_model_comparison.ipynb
│   ├── 08_balanced_comparison.ipynb
│   └── 09_final_model.ipynb
├── src/
│   ├── features/                    # Feature transformations used in training and scoring
│   └── models/                      # Feature sets and evaluation utilities
├── models/
│   └── final_model.joblib           # Final LightGBM model and evaluation metadata
├── reports/figures/                 # Visual outputs from the analytical workflow
├── backend/                         # API for model inference and history
│   ├── app/
│   │   ├── api/routes/              # Scoring, dashboard, and history endpoints
│   │   ├── core/config.py           # Environment-based settings
│   │   ├── database/                # SQLite persistence
│   │   ├── schemas/                 # Request and response validation
│   │   ├── services/                # Inference, feed, and dataset analytics
│   │   └── main.py                  # API entry point
│   └── requirements.txt             # Runtime API dependencies
├── frontend/                        # React dashboard for model results and scoring
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api.ts
│   └── package.json
├── tests/                           # Feature, API, and transaction-feed tests
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── nginx.conf                       # Dashboard hosting and API reverse proxy
└── requirements.txt                 # Analysis and model-development dependencies
```

## Machine learning workflow

The notebooks follow the project from understanding and validating the data to feature design, baseline training, balanced-model comparisons, and final evaluation. Feature transformations are shared with the inference service to keep training-time and prediction-time inputs aligned.

The final artifact is a LightGBM classifier trained with class weights. It uses eight engineered features derived from transaction type, amount, and account balances. The deployed decision threshold is **0.5**. Its test-split results recorded in the model bundle are:

| Metric | Result |
|---|---:|
| Precision | 0.9971 |
| Recall | 0.9993 |
| F1 score | 0.9982 |
| Fraud cases missed | 1 |
| False alerts | 4 |

These are results on the project's held-out PaySim test split, not a guarantee of performance on future transactions.

The PaySim source CSV is not included because of its size. It is only needed to rerun the data-analysis and training notebooks or to display source-dataset analytics. Download the [PaySim dataset from Kaggle](https://www.kaggle.com/datasets/ealaxi/paysim1). The saved model and bundled transaction feed are sufficient to run the inference service and dashboard.

## Getting started

### Option 1 — Docker (recommended)

Install Docker Desktop (including Docker Compose), clone the repository, and run from its root:

```bash
docker compose up --build
```

Open **http://localhost:3000** for the dashboard. Select **Start monitoring** to see transaction decisions arrive, or open **Batch detection** to upload your own CSV. The frontend proxies API requests to the backend, so Docker requires no Python or Node.js installation on the host.
If these ports are already in use, create `.env` from `.env.example` and change `WEB_PORT` and `API_PORT` before starting the containers. For example, use `WEB_PORT=13000` and `API_PORT=18000`, then open **http://localhost:13000**.

The live feed reads from the bundled [`htvex_ai_90000_transactions.csv`](./tests/fixtures/htvex_ai_90000_transactions.csv), brings an actual model-flagged transaction into the first few entries, then continues through the remaining records. Each record is scored using the saved model and stored in local transaction history; displayed decisions are model predictions, not confirmed outcomes. CSV batch uploads remain available independently.

| Service | URL | Description |
|---|---|---|
| Live dashboard | http://localhost:3000 | React dashboard served by Nginx |
| API health | http://localhost:8000/api/health | Backend and model health |
| API documentation | http://localhost:8000/docs | Interactive FastAPI documentation |

Stop the application with `Ctrl+C`, or run `docker compose down`. The prediction history is stored in a Docker volume and is retained when containers are recreated. To also remove that history, run `docker compose down --volumes`.

### Option 2 — Manual setup (development)

Prerequisites: Python 3.11 or later, Node.js 20 or later, and npm.

In the project root, create a Python environment and install the API dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Start the API from the project root:

```powershell
python -m uvicorn backend.app.main:app --reload
```

In a second terminal, install frontend dependencies and start the dashboard:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open **http://localhost:5173** for the live dashboard. Vite forwards API requests to the backend at **http://127.0.0.1:8000**, including the live monitoring endpoint. Interactive API documentation is available at **http://localhost:5173/docs**. If the backend uses another address, set `VITE_API_PROXY_TARGET` in `frontend/.env` and restart Vite.

## Configuration

Copy `.env.example` to `.env` to override backend defaults. Relative paths are resolved from the project root.

| Variable | Default | Description |
|---|---|---|
| `MODEL_PATH` | `models/final_model.joblib` | Pre-trained model bundle |
| `DATABASE_PATH` | `.data/fraudguard.sqlite3` | SQLite prediction history |
| `PAYSIM_DATA_PATH` | `data/raw/PS_20174392719_1491204439457_log.csv` | Optional PaySim source data for dataset analytics |
| `CORS_ORIGINS` | Local Vite development and preview URLs | Allowed browser origins |
| `MAX_UPLOAD_BYTES` | `26214400` | Maximum batch CSV upload size (25 MiB) |
| `MAX_BATCH_ROWS` | `100000` | Maximum number of batch rows |

The frontend reads `VITE_API_BASE_URL` from `frontend/.env`. In Docker, the built frontend uses a same-origin `/api` route through Nginx.

To enable PaySim dataset analytics, obtain the source CSV separately and place it at the configured path, or set `PAYSIM_DATA_PATH` to its location. The source data is not needed for live scoring.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | API, SQLite, and model health |
| `POST` | `/api/predict` | Validate and score one transaction; save the result |
| `POST` | `/api/predict/batch` | Score a CSV and return a results CSV |
| `GET` | `/api/dashboard/stats` | Live prediction aggregates and optional PaySim metrics |
| `GET` | `/api/transactions` | Search, filter, sort, and paginate saved predictions |
| `GET` | `/api/transactions/{id}` | Saved transaction and prediction details |
| `GET` | `/docs` | Interactive Swagger documentation |
| `GET` | `/openapi.json` | OpenAPI schema |

Batch CSV files must include `type`, `amount`, `oldbalanceOrg`, and `oldbalanceDest`. Optional `step`, `nameOrig`, and `nameDest` columns are retained as reference metadata. The model accepts `CASH_OUT` and `TRANSFER` only. Dataset `isFraud` labels are kept distinct from model predictions in dashboard statistics.

## Validation

The saved model bundle can be used without rerunning the analysis or training notebooks. To rerun the model-development workflow, install the root `requirements.txt` and provide the PaySim source data.

Run the same checks locally from the project root:

```powershell
python -m pip install -r backend\requirements.txt
python -m pip install pytest
python -m pytest tests -q
Set-Location frontend
npm ci
npm run build
Set-Location ..
docker compose up --build --wait
Invoke-WebRequest http://localhost:3000
Invoke-WebRequest http://localhost:8000/api/health
docker compose down
```

The root `requirements.txt` contains the ML, analysis, and notebook dependencies. The smaller `backend/requirements.txt` is sufficient to serve the saved model.
