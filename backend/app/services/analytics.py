from pathlib import Path
from threading import Lock
from typing import Any

import pandas as pd


class DatasetAnalyticsService:
    def __init__(self, dataset_path: Path) -> None:
        self.dataset_path = dataset_path
        self._summary: dict[str, Any] | None = None
        self._lock = Lock()

    def summary(self) -> dict[str, Any]:
        if self._summary is not None:
            return self._summary
        with self._lock:
            if self._summary is None:
                self._summary = self._read_summary()
        return self._summary

    def _read_summary(self) -> dict[str, Any]:
        if not self.dataset_path.is_file():
            return {
                "available": False,
                "message": "PaySim source CSV is not available; configure PAYSIM_DATA_PATH.",
            }

        required = {"step", "type", "amount", "isFraud"}
        totals = {"transactions": 0, "fraud": 0, "amount": 0.0, "fraud_amount": 0.0}
        type_totals: dict[str, dict[str, float | int]] = {}
        day_totals: dict[int, dict[str, int]] = {}
        for chunk in pd.read_csv(
            self.dataset_path,
            usecols=lambda column: column in required,
            chunksize=250_000,
        ):
            missing = required.difference(chunk.columns)
            if missing:
                raise ValueError(
                    f"PaySim source is missing columns: {', '.join(sorted(missing))}"
                )
            fraud = chunk["isFraud"].astype(bool)
            totals["transactions"] += len(chunk)
            totals["fraud"] += int(fraud.sum())
            totals["amount"] += float(chunk["amount"].sum())
            totals["fraud_amount"] += float(chunk.loc[fraud, "amount"].sum())

            grouped = chunk.assign(_fraud=fraud).groupby("type", observed=True).agg(
                transactions=("_fraud", "size"),
                fraud_transactions=("_fraud", "sum"),
            )
            fraud_amounts = (
                chunk.loc[fraud].groupby("type", observed=True)["amount"].sum()
            )
            for transaction_type, row in grouped.iterrows():
                values = type_totals.setdefault(
                    str(transaction_type),
                    {
                        "total_transactions": 0,
                        "fraud_transactions": 0,
                        "fraud_amount": 0.0,
                    },
                )
                values["total_transactions"] += int(row["transactions"])
                values["fraud_transactions"] += int(row["fraud_transactions"])
                values["fraud_amount"] += float(fraud_amounts.get(transaction_type, 0))

            days = ((chunk["step"].astype("int64") - 1) // 24) + 1
            daily = chunk.assign(_day=days, _fraud=fraud).groupby("_day").agg(
                total_transactions=("_fraud", "size"),
                fraud_transactions=("_fraud", "sum"),
            )
            for day, row in daily.iterrows():
                values = day_totals.setdefault(
                    int(day), {"total_transactions": 0, "fraud_transactions": 0}
                )
                values["total_transactions"] += int(row["total_transactions"])
                values["fraud_transactions"] += int(row["fraud_transactions"])

        count = int(totals["transactions"])
        fraud_count = int(totals["fraud"])
        return {
            "available": True,
            "source": self.dataset_path.name,
            "total_transactions": count,
            "fraud_transactions": fraud_count,
            "legitimate_transactions": count - fraud_count,
            "fraud_rate": fraud_count / count if count else 0.0,
            "average_amount": totals["amount"] / count if count else 0.0,
            "total_fraud_amount": totals["fraud_amount"],
            "fraud_by_type": [
                {"type": transaction_type, **values}
                for transaction_type, values in sorted(type_totals.items())
            ],
            "activity_by_day": [
                {"day": day, **values}
                for day, values in sorted(day_totals.items())
            ],
        }
