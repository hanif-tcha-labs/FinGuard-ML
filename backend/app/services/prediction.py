from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from backend.app.schemas.transactions import TransactionInput
from src.features.transaction_features import add_transaction_features
from src.models.feature_sets import add_ratio_features


class PredictionService:
    def __init__(self, model_path: Path) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(f"Trained model not found: {model_path}")
        artifact = joblib.load(model_path)
        if not isinstance(artifact, dict):
            raise ValueError("The model artifact must be the saved training bundle.")
        required = {"model", "threshold", "features", "version", "description"}
        missing = required.difference(artifact)
        if missing:
            raise ValueError(f"Model artifact is missing: {', '.join(sorted(missing))}")

        self.model = artifact["model"]
        self.threshold = float(artifact["threshold"])
        self.features = list(artifact["features"])
        self.version = str(artifact["version"])
        self.description = str(artifact["description"])
        if not 0 <= self.threshold <= 1:
            raise ValueError("The saved classification threshold must be between 0 and 1.")
        if self.model.n_features_in_ != len(self.features):
            raise ValueError("The model feature count does not match the saved feature list.")
        if list(self.model.feature_names_in_) != self.features:
            raise ValueError("The model feature order does not match the saved feature list.")
        if 1 not in self.model.classes_:
            raise ValueError("The saved model has no fraud class (1).")

    def metadata(self) -> dict[str, Any]:
        return {
            "available": True,
            "version": self.version,
            "description": self.description,
            "threshold": self.threshold,
            "features": self.features,
        }

    def predict(
        self, transaction: TransactionInput
    ) -> dict[str, Any]:
        return self.predict_many([transaction])[0]

    def predict_many(
        self, transactions: list[TransactionInput]
    ) -> list[dict[str, Any]]:
        if not transactions:
            return []
        raw = pd.DataFrame(
            [
                {
                    "type": transaction.type,
                    "amount": transaction.amount,
                    "oldbalanceOrg": transaction.oldbalanceOrg,
                    "oldbalanceDest": transaction.oldbalanceDest,
                }
                for transaction in transactions
            ]
        )
        features = add_transaction_features(raw)
        features = add_ratio_features(features)
        model_input = features.loc[:, self.features]
        class_one_index = list(self.model.classes_).index(1)
        probabilities = self.model.predict_proba(model_input)[:, class_one_index]
        return [
            {
                "prediction": "Fraud" if probability >= self.threshold else "Legitimate",
                "fraud_probability": float(probability),
                "is_fraud": bool(probability >= self.threshold),
                "risk_level": "High" if probability >= self.threshold else "Low",
                "threshold": self.threshold,
                "model_version": self.version,
            }
            for probability in probabilities
        ]
