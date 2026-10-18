from contextlib import contextmanager
import sqlite3
from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from backend.app.schemas.transactions import TransactionInput

_SORT_COLUMNS = {
    "created_at": "created_at",
    "amount": "amount",
    "fraud_probability": "fraud_probability",
    "type": "type",
    "prediction": "is_fraud",
}


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path

    @contextmanager
    def _connect(self) -> Generator[sqlite3.Connection, None, None]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    oldbalance_org REAL NOT NULL,
                    oldbalance_dest REAL NOT NULL,
                    step INTEGER,
                    sender TEXT,
                    receiver TEXT,
                    prediction TEXT NOT NULL,
                    fraud_probability REAL NOT NULL,
                    is_fraud INTEGER NOT NULL,
                    risk_level TEXT NOT NULL,
                    threshold REAL NOT NULL DEFAULT 0.5,
                    model_version TEXT NOT NULL DEFAULT '1.0'
                )
                """
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(transactions)")
            }
            if "threshold" not in columns:
                connection.execute(
                    "ALTER TABLE transactions ADD COLUMN threshold REAL NOT NULL DEFAULT 0.5"
                )
            if "model_version" not in columns:
                connection.execute(
                    "ALTER TABLE transactions ADD COLUMN model_version TEXT NOT NULL DEFAULT '1.0'"
                )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_transactions_created_at "
                "ON transactions(created_at)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS ix_transactions_is_fraud "
                "ON transactions(is_fraud)"
            )

    def check_connection(self) -> None:
        with self._connect() as connection:
            connection.execute("SELECT 1").fetchone()

    def add_prediction(
        self, transaction: TransactionInput, result: dict[str, Any]
    ) -> dict[str, Any]:
        created_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO transactions (
                    created_at, type, amount, oldbalance_org, oldbalance_dest,
                    step, sender, receiver, prediction, fraud_probability,
                    is_fraud, risk_level, threshold, model_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    created_at,
                    transaction.type,
                    transaction.amount,
                    transaction.oldbalanceOrg,
                    transaction.oldbalanceDest,
                    transaction.step,
                    transaction.nameOrig,
                    transaction.nameDest,
                    result["prediction"],
                    result["fraud_probability"],
                    int(result["is_fraud"]),
                    result["risk_level"],
                    result["threshold"],
                    result["model_version"],
                ),
            )
            row = connection.execute(
                "SELECT * FROM transactions WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        return self._record(row)

    def add_predictions(
        self,
        transactions: list[TransactionInput],
        results: list[dict[str, Any]],
    ) -> None:
        if len(transactions) != len(results):
            raise ValueError("Transaction and prediction counts must match.")
        created_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO transactions (
                    created_at, type, amount, oldbalance_org, oldbalance_dest,
                    step, sender, receiver, prediction, fraud_probability,
                    is_fraud, risk_level, threshold, model_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        created_at,
                        transaction.type,
                        transaction.amount,
                        transaction.oldbalanceOrg,
                        transaction.oldbalanceDest,
                        transaction.step,
                        transaction.nameOrig,
                        transaction.nameDest,
                        result["prediction"],
                        result["fraud_probability"],
                        int(result["is_fraud"]),
                        result["risk_level"],
                        result["threshold"],
                        result["model_version"],
                    )
                    for transaction, result in zip(transactions, results, strict=True)
                ],
            )

    def get_transaction(self, transaction_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM transactions WHERE id = ?", (transaction_id,)
            ).fetchone()
        return self._record(row) if row else None

    def list_transactions(
        self,
        *,
        page: int,
        page_size: int,
        status: str | None,
        transaction_type: str | None,
        query: str | None,
        date_from: str | None,
        date_to: str | None,
        sort_by: str,
        sort_order: str,
    ) -> tuple[list[dict[str, Any]], int]:
        clauses: list[str] = []
        parameters: list[Any] = []
        if status:
            clauses.append("is_fraud = ?")
            parameters.append(1 if status == "Fraud" else 0)
        if transaction_type:
            clauses.append("type = ?")
            parameters.append(transaction_type)
        if query:
            pattern = f"%{query}%"
            clauses.append(
                "(CAST(id AS TEXT) LIKE ? OR COALESCE(sender, '') LIKE ? "
                "OR COALESCE(receiver, '') LIKE ? OR type LIKE ?)"
            )
            parameters.extend([pattern] * 4)
        if date_from:
            clauses.append("date(created_at) >= date(?)")
            parameters.append(date_from)
        if date_to:
            clauses.append("date(created_at) <= date(?)")
            parameters.append(date_to)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        column = _SORT_COLUMNS[sort_by]
        direction = "ASC" if sort_order == "asc" else "DESC"
        with self._connect() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM transactions{where}", parameters
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT * FROM transactions{where} "
                f"ORDER BY {column} {direction}, id DESC LIMIT ? OFFSET ?",
                [*parameters, page_size, (page - 1) * page_size],
            ).fetchall()
        return [self._record(row) for row in rows], total

    def live_statistics(self) -> dict[str, Any]:
        with self._connect() as connection:
            totals = connection.execute(
                """
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(is_fraud), 0) AS fraud,
                       COALESCE(AVG(amount), 0) AS average_amount,
                       COALESCE(SUM(CASE WHEN is_fraud = 1 THEN amount ELSE 0 END), 0)
                           AS fraud_amount
                FROM transactions
                """
            ).fetchone()
            daily = connection.execute(
                """
                SELECT date(created_at) AS date, COUNT(*) AS total,
                       SUM(is_fraud) AS fraud, SUM(amount) AS amount,
                       SUM(CASE WHEN is_fraud = 1 THEN amount ELSE 0 END)
                           AS fraud_amount
                FROM transactions
                WHERE date(created_at) >= date('now', '-13 days')
                GROUP BY date(created_at)
                ORDER BY date
                """
            ).fetchall()
            by_type = connection.execute(
                """
                SELECT type, COUNT(*) AS total, SUM(is_fraud) AS fraud,
                       SUM(CASE WHEN is_fraud = 1 THEN amount ELSE 0 END)
                           AS fraud_amount
                FROM transactions
                GROUP BY type
                ORDER BY type
                """
            ).fetchall()
            suspicious = connection.execute(
                """
                SELECT * FROM transactions WHERE is_fraud = 1
                ORDER BY created_at DESC, id DESC LIMIT 5
                """
            ).fetchall()

        total = int(totals["total"])
        fraud = int(totals["fraud"])
        daily_by_date = {row["date"]: row for row in daily}
        today = datetime.now(timezone.utc).date()
        activity = []
        periods: list[list[sqlite3.Row | None]] = [[], []]
        for offset in range(13, -1, -1):
            date_key = (today - timedelta(days=offset)).isoformat()
            row = daily_by_date.get(date_key)
            activity.append(
                {
                    "date": date_key,
                    "total_transactions": int(row["total"]) if row else 0,
                    "fraud_transactions": int(row["fraud"]) if row else 0,
                }
            )
            periods[0 if offset >= 7 else 1].append(row)

        def period_totals(rows: list[sqlite3.Row | None]) -> dict[str, float]:
            return {
                "transactions": sum(int(row["total"]) for row in rows if row),
                "fraud": sum(int(row["fraud"]) for row in rows if row),
                "amount": sum(float(row["amount"]) for row in rows if row),
                "fraud_amount": sum(
                    float(row["fraud_amount"] or 0) for row in rows if row
                ),
            }

        previous_week, current_week = (period_totals(rows) for rows in periods)

        def percent_change(previous: float, current: float) -> float | None:
            return (current - previous) / previous * 100 if previous else None

        previous_rate = (
            previous_week["fraud"] / previous_week["transactions"]
            if previous_week["transactions"]
            else 0.0
        )
        current_rate = (
            current_week["fraud"] / current_week["transactions"]
            if current_week["transactions"]
            else 0.0
        )
        trends = {
            "transactions_change_pct": percent_change(
                previous_week["transactions"], current_week["transactions"]
            ),
            "fraud_change_pct": percent_change(
                previous_week["fraud"], current_week["fraud"]
            ),
            "legitimate_change_pct": percent_change(
                previous_week["transactions"] - previous_week["fraud"],
                current_week["transactions"] - current_week["fraud"],
            ),
            "fraud_rate_change_pp": (
                (current_rate - previous_rate) * 100
                if previous_week["transactions"]
                else None
            ),
            "fraud_amount_change_pct": percent_change(
                previous_week["fraud_amount"], current_week["fraud_amount"]
            ),
        }
        return {
            "total_transactions": total,
            "fraud_transactions": fraud,
            "legitimate_transactions": total - fraud,
            "fraud_rate": fraud / total if total else 0.0,
            "average_amount": float(totals["average_amount"]),
            "total_fraud_amount": float(totals["fraud_amount"]),
            "recent_activity": activity,
            "weekly_trends": trends,
            "fraud_by_type": [
                {
                    "type": row["type"],
                    "total_transactions": int(row["total"]),
                    "fraud_transactions": int(row["fraud"]),
                    "legitimate_transactions": int(row["total"] - row["fraud"]),
                    "fraud_amount": float(row["fraud_amount"] or 0),
                }
                for row in by_type
            ],
            "recent_suspicious": [self._record(row) for row in suspicious],
        }

    @staticmethod
    def _record(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"],
            "created_at": row["created_at"],
            "type": row["type"],
            "amount": row["amount"],
            "oldbalanceOrg": row["oldbalance_org"],
            "oldbalanceDest": row["oldbalance_dest"],
            "step": row["step"],
            "nameOrig": row["sender"],
            "nameDest": row["receiver"],
            "prediction": row["prediction"],
            "fraud_probability": row["fraud_probability"],
            "is_fraud": bool(row["is_fraud"]),
            "risk_level": row["risk_level"],
            "threshold": row["threshold"],
            "model_version": row["model_version"],
        }
