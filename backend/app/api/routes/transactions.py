from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request

from backend.app.schemas.transactions import TransactionPage, TransactionRecord

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=TransactionPage)
def list_transactions(
    request: Request,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: Literal["Fraud", "Legitimate"] | None = None,
    transaction_type: Literal["CASH_OUT", "TRANSFER"] | None = None,
    q: Annotated[str | None, Query(max_length=128)] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: Literal[
        "created_at", "amount", "fraud_probability", "type", "prediction"
    ] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
) -> dict:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to.")
    items, total = request.app.state.database.list_transactions(
        page=page,
        page_size=page_size,
        status=status,
        transaction_type=transaction_type,
        query=q.strip() if q else None,
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{transaction_id}", response_model=TransactionRecord)
def get_transaction(request: Request, transaction_id: int) -> dict:
    transaction = request.app.state.database.get_transaction(transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction was not found.")
    return transaction
