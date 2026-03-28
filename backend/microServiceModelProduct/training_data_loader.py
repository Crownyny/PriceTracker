from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass(frozen=True)
class TrainingDataLoader:
    """Loads training samples from a CSV file.

    This keeps I/O and parsing concerns outside of the ML model (SRP).

    Expected CSV headers:
      - label: BUY | NOT_BUY
      - text: query text
    """

    csv_path: Path | str

    def load(self) -> Dict[str, List[str]]:
        path = Path(self.csv_path) if isinstance(self.csv_path, str) else self.csv_path
        if not path.exists():
            raise FileNotFoundError(f"Training dataset not found: {path}")

        data: Dict[str, List[str]] = {"BUY": [], "NOT_BUY": []}

        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or "label" not in reader.fieldnames or "text" not in reader.fieldnames:
                raise ValueError("Invalid CSV format. Expected headers: label,text")

            for row in reader:
                label = (row.get("label") or "").strip().upper()
                text = (row.get("text") or "").strip()
                if not label or not text:
                    continue

                if label not in data:
                    # Ignore unknown labels to keep loader robust.
                    continue

                data[label].append(text)

        if not data["BUY"] and not data["NOT_BUY"]:
            raise ValueError("Training dataset is empty")

        return data
