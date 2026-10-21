import csv
import io
import logging
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from backend.app.schemas.transactions import (
    PredictionResult,
    TransactionInput,
    TransactionRecord,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["predictions"])
_OUTPUT_COLUMNS = {
    "prediction",
    "fraud_probability",
    "is_fraud",
    "risk_level",
    "error",
}
_MODEL_COLUMNS = (
    "type",
    "amount",
    "oldbalanceOrg",
    "oldbalanceDest",
    "step",
    "nameOrig",
    "nameDest",
)


@router.post("/predict", response_model=PredictionResult)
def predict(transaction: TransactionInput, request: Request) -> dict:
    service = request.app.state.prediction_service
    result = service.predict(transaction)
    request.app.state.database.add_prediction(transaction, result)
    return result


@router.post("/live/next", response_model=TransactionRecord, tags=["live monitoring"])
def predict_next_live_transaction(request: Request) -> dict:
    transaction, result = request.app.state.transaction_feed.next_prediction(
        request.app.state.prediction_service
    )
    return request.app.state.database.add_prediction(transaction, result)


@router.post("/predict/batch", responses={200: {"content": {"text/csv": {}}}})
async def predict_batch(
    request: Request,
    file: Annotated[UploadFile, File(description="PaySim-compatible transaction CSV")],
) -> StreamingResponse:
    settings = request.app.state.settings
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Upload a .csv file.")
    content = await file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="CSV exceeds the configured size limit.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=400, detail="CSV must use UTF-8 encoding.") from error

    reader = csv.DictReader(io.StringIO(text, newline=""))
    headers = reader.fieldnames or []
    required = {"type", "amount", "oldbalanceOrg", "oldbalanceDest"}
    missing = required.difference(headers)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing))}",
        )
    if len(headers) != len(set(headers)) or any(not name for name in headers):
        raise HTTPException(status_code=422, detail="CSV headers must be unique and non-empty.")
    collisions = _OUTPUT_COLUMNS.intersection(headers)
    if collisions:
        raise HTTPException(
            status_code=422,
            detail=f"CSV uses reserved output columns: {', '.join(sorted(collisions))}",
        )

    rows = list(reader)
    if len(rows) > settings.max_batch_rows:
        raise HTTPException(
            status_code=413,
            detail=f"CSV exceeds the {settings.max_batch_rows:,}-row limit.",
        )
    valid_rows: list[tuple[int, dict[str, str], TransactionInput]] = []
    errors: dict[int, str] = {}
    for row_number, row in enumerate(rows, start=2):
        if None in row:
            errors[row_number] = "Row contains more values than the header."
            continue
        values = {key: value for key, value in row.items() if key in _MODEL_COLUMNS}
        for optional in ("step", "nameOrig", "nameDest"):
            if values.get(optional) == "":
                values[optional] = None
        try:
            transaction = TransactionInput.model_validate(values)
        except ValidationError as error:
            errors[row_number] = "; ".join(
                f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}"
                for item in error.errors()
            )
            continue
        valid_rows.append((row_number, row, transaction))

    if not rows:
        raise HTTPException(status_code=422, detail="CSV contains no transaction rows.")
    predictions = request.app.state.prediction_service.predict_many(
        [transaction for _, _, transaction in valid_rows]
    )
    request.app.state.database.add_predictions(
        [transaction for _, _, transaction in valid_rows], predictions
    )
    prediction_by_line: dict[int, dict] = {}
    for (line_number, _, _), result in zip(
        valid_rows, predictions, strict=True
    ):
        prediction_by_line[line_number] = result

    output = io.StringIO(newline="")
    writer = csv.DictWriter(
        output,
        fieldnames=[
            *headers,
            "prediction",
            "fraud_probability",
            "is_fraud",
            "risk_level",
            "error",
        ],
        extrasaction="ignore",
    )
    writer.writeheader()
    fraud_count = 0
    legitimate_count = 0
    for line_number, row in enumerate(rows, start=2):
        result = prediction_by_line.get(line_number)
        if result:
            fraud_count += int(result["is_fraud"])
            legitimate_count += int(not result["is_fraud"])
        writer.writerow(
            {
                **row,
                **(
                    {
                        "prediction": result["prediction"],
                        "fraud_probability": result["fraud_probability"],
                        "is_fraud": result["is_fraud"],
                        "risk_level": result["risk_level"],
                        "error": "",
                    }
                    if result
                    else {
                        "prediction": "",
                        "fraud_probability": "",
                        "is_fraud": "",
                        "risk_level": "",
                        "error": errors[line_number],
                    }
                ),
            }
        )

    valid_count = len(valid_rows)
    logger.info(
        "Batch analyzed: rows=%d valid=%d invalid=%d fraud=%d",
        len(rows),
        valid_count,
        len(errors),
        fraud_count,
    )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="htvex-ai-results.csv"',
            "X-Total-Rows": str(len(rows)),
            "X-Valid-Rows": str(valid_count),
            "X-Invalid-Rows": str(len(errors)),
            "X-Fraud-Count": str(fraud_count),
            "X-Legitimate-Count": str(legitimate_count),
        },
    )
