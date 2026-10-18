from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal["CASH_OUT", "TRANSFER"]


class TransactionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: TransactionType
    amount: float = Field(ge=0, allow_inf_nan=False)
    oldbalanceOrg: float = Field(ge=0, allow_inf_nan=False)
    oldbalanceDest: float = Field(ge=0, allow_inf_nan=False)
    step: int | None = Field(default=None, ge=1)
    nameOrig: str | None = Field(default=None, max_length=128)
    nameDest: str | None = Field(default=None, max_length=128)


class PredictionResult(BaseModel):
    prediction: Literal["Fraud", "Legitimate"]
    fraud_probability: float = Field(ge=0, le=1)
    is_fraud: bool
    risk_level: Literal["High", "Low"]
    threshold: float
    model_version: str


class TransactionRecord(PredictionResult):
    id: int
    created_at: datetime
    type: TransactionType
    amount: float
    oldbalanceOrg: float
    oldbalanceDest: float
    step: int | None
    nameOrig: str | None
    nameDest: str | None


class TransactionPage(BaseModel):
    items: list[TransactionRecord]
    page: int
    page_size: int
    total: int
    total_pages: int


class ModelStatus(BaseModel):
    available: bool
    version: str
    description: str
    threshold: float
    features: list[str]


class HealthResponse(BaseModel):
    status: Literal["healthy"]
    model: ModelStatus
    database: Literal["connected"]
