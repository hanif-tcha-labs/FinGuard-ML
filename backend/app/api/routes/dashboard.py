from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(request: Request) -> dict:
    return {
        "live": request.app.state.database.live_statistics(),
        "dataset": request.app.state.dataset_analytics.summary(),
        "model": request.app.state.prediction_service.metadata(),
    }
