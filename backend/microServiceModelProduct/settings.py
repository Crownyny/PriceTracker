from __future__ import annotations

from pydantic import BaseModel


class Settings(BaseModel):
    """App settings.

    Keeping settings in one place helps configuration and testability.
    """

    training_data_path: str = "training_data.csv"
    alpha: float = 1.0
    decision_threshold: float = 0.7
