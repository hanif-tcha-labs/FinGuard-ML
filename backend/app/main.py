from contextlib import asynccontextmanager
import logging
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.routes.dashboard import router as dashboard_router
from backend.app.api.routes.predict import router as prediction_router
from backend.app.api.routes.transactions import router as transactions_router
from backend.app.core.config import Settings
from backend.app.database import Database
from backend.app.services.analytics import DatasetAnalyticsService
from backend.app.services.prediction import PredictionService
from backend.app.services.transaction_feed import TransactionFeed

logger = logging.getLogger("htvex_ai")


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings or Settings.from_environment()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        database = Database(configuration.database_path)
        database.initialize()
        application.state.database = database
        application.state.prediction_service = PredictionService(configuration.model_path)
        application.state.dataset_analytics = DatasetAnalyticsService(
            configuration.dataset_path
        )
        application.state.transaction_feed = TransactionFeed()
        application.state.settings = configuration
        logger.info("HTVEX AI API ready; model version %s", application.state.prediction_service.version)
        yield

    application = FastAPI(
        title="HTVEX AI API",
        description=(
            "Transaction risk scoring, batch CSV analysis, live prediction history, "
            "and PaySim source-dataset analytics."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(configuration.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        expose_headers=[
            "X-Total-Rows",
            "X-Valid-Rows",
            "X-Invalid-Rows",
            "X-Fraud-Count",
            "X-Legitimate-Count",
            "Content-Disposition",
        ],
    )
    application.include_router(prediction_router)
    application.include_router(transactions_router)
    application.include_router(dashboard_router)

    @application.get("/api/health", tags=["health"])
    def health(request: Request) -> dict:
        request.app.state.database.check_connection()
        return {
            "status": "healthy",
            "model": request.app.state.prediction_service.metadata(),
            "database": "connected",
        }

    @application.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, error: Exception) -> JSONResponse:
        logger.exception("Unhandled API error for %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected server error occurred."},
        )

    return application


app = create_app()
