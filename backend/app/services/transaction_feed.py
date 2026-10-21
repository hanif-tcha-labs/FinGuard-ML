import csv
from collections import deque
from pathlib import Path
from threading import Lock
from typing import TextIO

from pydantic import ValidationError

from backend.app.core.config import PROJECT_ROOT
from backend.app.schemas.transactions import TransactionInput
from backend.app.services.prediction import PredictionService

_FEED_PATH = PROJECT_ROOT / "tests" / "fixtures" / "htvex_ai_90000_transactions.csv"
_REQUIRED_COLUMNS = {"type", "amount", "oldbalanceOrg", "oldbalanceDest"}
_INPUT_COLUMNS = _REQUIRED_COLUMNS | {"step", "nameOrig", "nameDest"}
_PREFETCH_SIZE = 2048


class TransactionFeed:
    def __init__(self, path: Path = _FEED_PATH) -> None:
        if not path.is_file():
            raise FileNotFoundError(f"Transaction feed file not found: {path}")
        self._path = path
        self._lock = Lock()
        self._file: TextIO | None = None
        self._reader: csv.DictReader | None = None
        self._row_number = 1
        self._pending: deque[tuple[TransactionInput, dict]] = deque()
        self._open()

    def _open(self) -> None:
        self._file = self._path.open(encoding="utf-8-sig", newline="")
        reader = csv.DictReader(self._file)
        headers = reader.fieldnames or []
        missing = _REQUIRED_COLUMNS.difference(headers)
        if missing:
            self._file.close()
            raise ValueError(
                f"Transaction feed is missing required columns: {', '.join(sorted(missing))}"
            )
        self._reader = reader
        self._row_number = 1

    def _read_transaction(self) -> TransactionInput | None:
        if self._reader is None:
            self._open()
        row = next(self._reader, None)
        if row is None:
            return None

        self._row_number += 1
        if None in row:
            raise ValueError(
                f"Transaction feed row {self._row_number} has more values than its header."
            )
        values = {
            key: value or None
            for key, value in row.items()
            if key in _INPUT_COLUMNS
        }
        try:
            return TransactionInput.model_validate(values)
        except ValidationError as error:
            raise ValueError(
                f"Transaction feed row {self._row_number} is invalid: {error}"
            ) from error

    def _fill_initial_queue(self, prediction_service: PredictionService) -> None:
        transactions: list[TransactionInput] = []
        results: list[dict] = []
        while True:
            transaction = self._read_transaction()
            if transaction is None:
                if transactions:
                    break
                self._file.close()
                self._open()
                transaction = self._read_transaction()
                if transaction is None:
                    raise ValueError(f"Transaction feed is empty: {self._path}")

            transactions.append(transaction)
            if len(transactions) < _PREFETCH_SIZE:
                continue
            results.extend(prediction_service.predict_many(transactions[len(results):]))
            fraud_index = next(
                (index for index, result in enumerate(results) if result["is_fraud"]),
                None,
            )
            if fraud_index is not None:
                if fraud_index >= 10:
                    transactions.insert(10, transactions.pop(fraud_index))
                    results.insert(10, results.pop(fraud_index))
                self._pending.extend(zip(transactions, results, strict=True))
                return

        results.extend(prediction_service.predict_many(transactions[len(results):]))
        self._pending.extend(zip(transactions, results, strict=True))

    def next_prediction(
        self, prediction_service: PredictionService
    ) -> tuple[TransactionInput, dict]:
        with self._lock:
            if not self._pending:
                self._fill_initial_queue(prediction_service)
            if self._pending:
                return self._pending.popleft()

            transaction = self._read_transaction()
            if transaction is None:
                self._file.close()
                self._open()
                transaction = self._read_transaction()
            if transaction is None:
                raise ValueError(f"Transaction feed is empty: {self._path}")
            return transaction, prediction_service.predict(transaction)
