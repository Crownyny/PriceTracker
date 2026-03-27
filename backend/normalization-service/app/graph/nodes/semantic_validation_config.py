"""Carga y validación de configuración semántica (JSON/YAML)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class SemanticThresholds:
    domain_threshold: float
    valid_threshold: float
    invalid_threshold: float


@dataclass(frozen=True)
class SemanticPatternExamples:
    valid: list[str]
    invalid: list[str]


@dataclass(frozen=True)
class SemanticValidationConfig:
    tech_seeds: list[str]
    non_tech_seeds: list[str]
    accessory_priority: list[str]
    query_kb: dict[str, SemanticPatternExamples]
    thresholds: SemanticThresholds


def load_semantic_validation_config(path: str | Path) -> SemanticValidationConfig:
    """Lee archivo JSON/YAML y valida la estructura mínima esperada."""
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"Semantic config file not found: {config_path}")

    payload = _read_payload(config_path)

    required = [
        "tech_seeds",
        "non_tech_seeds",
        "query_kb",
        "accessory_priority",
        "thresholds",
    ]
    missing = [key for key in required if key not in payload]
    if missing:
        raise ValueError(f"Missing keys in semantic config: {', '.join(missing)}")

    thresholds_raw = payload["thresholds"]
    for key in ["domain_threshold", "valid_threshold", "invalid_threshold"]:
        if key not in thresholds_raw:
            raise ValueError(f"Missing thresholds.{key} in semantic config")

    query_kb_raw = payload["query_kb"]
    if not isinstance(query_kb_raw, dict) or not query_kb_raw:
        raise ValueError("query_kb must be a non-empty object")

    parsed_kb: dict[str, SemanticPatternExamples] = {}
    for pattern, examples in query_kb_raw.items():
        if not isinstance(examples, dict):
            raise ValueError(f"query_kb.{pattern} must be an object")
        valid_examples = examples.get("valid", [])
        invalid_examples = examples.get("invalid", [])
        if not isinstance(valid_examples, list) or not valid_examples:
            raise ValueError(f"query_kb.{pattern}.valid must be a non-empty list")
        if not isinstance(invalid_examples, list):
            raise ValueError(f"query_kb.{pattern}.invalid must be a list")
        parsed_kb[str(pattern)] = SemanticPatternExamples(
            valid=[str(item) for item in valid_examples if str(item).strip()],
            invalid=[str(item) for item in invalid_examples if str(item).strip()],
        )

    return SemanticValidationConfig(
        tech_seeds=[str(item) for item in payload["tech_seeds"] if str(item).strip()],
        non_tech_seeds=[str(item) for item in payload["non_tech_seeds"] if str(item).strip()],
        accessory_priority=[str(item) for item in payload["accessory_priority"] if str(item).strip()],
        query_kb=parsed_kb,
        thresholds=SemanticThresholds(
            domain_threshold=float(thresholds_raw["domain_threshold"]),
            valid_threshold=float(thresholds_raw["valid_threshold"]),
            invalid_threshold=float(thresholds_raw["invalid_threshold"]),
        ),
    )


def _read_payload(path: Path) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    elif suffix in {".yml", ".yaml"}:
        with path.open("r", encoding="utf-8") as fh:
            payload = yaml.safe_load(fh)
    else:
        raise ValueError(f"Unsupported semantic config extension: {path.suffix}")

    if not isinstance(payload, dict):
        raise ValueError("Semantic config must be a JSON/YAML object")
    return payload
