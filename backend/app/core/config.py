from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")


def _configured_path(name: str, default: str) -> Path:
    value = Path(os.getenv(name, default)).expanduser()
    return value if value.is_absolute() else PROJECT_ROOT / value


@dataclass(frozen=True)
class Settings:
    model_path: Path
    database_path: Path
    dataset_path: Path
    cors_origins: tuple[str, ...]
    max_upload_bytes: int
    max_batch_rows: int

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:4173,http://127.0.0.1:4173",
        )
        return cls(
            model_path=_configured_path("MODEL_PATH", "models/final_model.joblib"),
            database_path=_configured_path(
                "DATABASE_PATH", ".data/fraudguard.sqlite3"
            ),
            dataset_path=_configured_path(
                "PAYSIM_DATA_PATH",
                "data/raw/PS_20174392719_1491204439457_log.csv",
            ),
            cors_origins=tuple(
                origin.strip() for origin in origins.split(",") if origin.strip()
            ),
            max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024))),
            max_batch_rows=int(os.getenv("MAX_BATCH_ROWS", "100000")),
        )
