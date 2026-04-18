"""Pruebas unitarias del motor de validación semántica de 2 capas."""
from __future__ import annotations

import numpy as np
import pytest

from app.graph.nodes.semantic_validation_config import (
    SemanticPatternExamples,
    SemanticThresholds,
    SemanticValidationConfig,
)
from app.graph.nodes.semantic_validation_engine import SemanticValidationEngine


class FakeEncoder:
    """Encoder determinista de baja dimensión para pruebas unitarias."""

    def encode(self, texts, normalize_embeddings: bool = True):
        vectors = []
        for text in texts:
            value = (text or "").lower()
            if any(token in value for token in ["iphone", "smartphone", "laptop", "tablet", "samsung", "s23u", "s23"]):
                vec = np.array([1.0, 0.0, 0.0], dtype=np.float32)
            elif any(token in value for token in ["case", "funda", "cargador", "cable"]):
                vec = np.array([0.2, 1.0, 0.0], dtype=np.float32)
            elif any(token in value for token in ["shampoo", "camiseta", "arroz", "crema"]):
                vec = np.array([0.0, 0.0, 1.0], dtype=np.float32)
            else:
                vec = np.array([0.2, 0.1, 0.2], dtype=np.float32)

            if normalize_embeddings:
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
            vectors.append(vec)
        return np.vstack(vectors)


def _config() -> SemanticValidationConfig:
    return SemanticValidationConfig(
        tech_seeds=["smartphone", "laptop", "tablet"],
        non_tech_seeds=["camiseta de algodon", "shampoo hidratante", "arroz integral"],
        accessory_priority=["case", "funda", "cargador", "cable"],
        thresholds=SemanticThresholds(
            domain_threshold=0.05,
            valid_threshold=0.2,
            invalid_threshold=-0.2,
        ),
        query_kb={
            "iphone": SemanticPatternExamples(
                valid=["iphone 15 pro 128gb", "apple iphone pro"],
                invalid=["funda iphone", "cargador iphone"],
            ),
            "case": SemanticPatternExamples(
                valid=["funda para iphone", "case magsafe"],
                invalid=["iphone 15 pro", "smartphone samsung"],
            ),
            "laptop": SemanticPatternExamples(
                valid=["laptop lenovo 16gb", "portatil hp 512gb"],
                invalid=["funda para laptop", "mouse inalambrico"],
            ),
            "samsung s23u": SemanticPatternExamples(
                valid=["Samsung Galaxy S23 Ultra 512GB", "Samsung S23 Ultra 256GB"],
                invalid=["Funda para Samsung S23 Ultra", "Tablet Android S23u"],
            ),
        },
    )


def _engine(**kwargs) -> SemanticValidationEngine:
    return SemanticValidationEngine(
        config=_config(),
        model_name="fake-mini",
        top_k=2,
        encoder=FakeEncoder(),
        **kwargs,
    )


def test_layer1_skip_fuera_de_dominio():
    engine = _engine()

    result = engine.evaluate(query="shampoo hidratante", title="shampoo con keratina")

    assert result.decision == "SKIP"
    assert result.domain_gap < 0


def test_prioridad_accesorios_case_sobre_iphone():
    engine = _engine()

    result = engine.evaluate(query="case para iphone 15", title="funda magsafe transparente")

    assert result.pattern_used == "case"
    assert result.decision in {"VALID", "UNCERTAIN"}


def test_fallback_sin_patron_es_uncertain():
    engine = _engine()

    result = engine.evaluate(query="tablet pro 11", title="tablet profesional 11 pulgadas")

    assert result.decision == "UNCERTAIN"
    assert result.reason == "No KB pattern matched"


def test_umbrales_valid_filtered_uncertain():
    engine = _engine(
        thresholds_override=SemanticThresholds(
            domain_threshold=0.05,
            valid_threshold=0.15,
            invalid_threshold=-0.4,
        )
    )

    valid = engine.evaluate(query="case para iphone", title="funda case magsafe")
    filtered = engine.evaluate(query="case para iphone", title="smartphone iphone 15 pro")
    uncertain = engine.evaluate(query="case para iphone", title="producto premium")

    assert valid.decision == "VALID"
    assert filtered.decision == "FILTERED"
    assert uncertain.decision == "UNCERTAIN"


def test_cache_por_query_capa1():
    engine = _engine()

    first = engine.evaluate(query="iphone 15", title="iphone 15 pro")
    second = engine.evaluate(query="iphone 15", title="iphone 15 pro")

    assert first.decision in {"VALID", "UNCERTAIN", "FILTERED"}
    assert second.decision == first.decision
    assert engine.layer1_cache_size() == 1
    # query + title se cachean una sola vez cada uno
    assert engine.query_cache_size() == 2


def test_modelo_se_carga_una_vez_en_inicializacion(monkeypatch):
    calls = {"count": 0}

    def _fake_loader(_model_name: str):
        calls["count"] += 1
        return FakeEncoder()

    monkeypatch.setattr(SemanticValidationEngine, "_load_encoder", staticmethod(_fake_loader))

    engine = SemanticValidationEngine(
        config=_config(),
        model_name="fake-mini",
        top_k=2,
    )

    engine.evaluate(query="iphone 15", title="iphone 15 pro")
    engine.evaluate(query="iphone 15", title="iphone 15 pro")

    assert calls["count"] == 1


def test_lexical_guard_filtra_accesorio_en_query_telefono():
    engine = _engine()

    result = engine.evaluate(
        query="samsung s23u",
        title="Funda magnetica magsafe para Samsung Galaxy S23 Ultra",
    )

    assert result.decision == "FILTERED"
    assert result.reason.startswith("Accessory keyword guard")


def test_lexical_guard_filtra_dispositivo_fuera_objetivo():
    engine = _engine()

    result = engine.evaluate(
        query="samsung s23u",
        title="Tablet Android 13 10 pulgadas 5G S23u",
    )

    assert result.decision == "FILTERED"
    assert result.reason.startswith("Off-target device guard")


def test_lexical_guard_no_depende_de_accessory_priority_contaminado():
    cfg = _config()
    cfg = SemanticValidationConfig(
        tech_seeds=cfg.tech_seeds,
        non_tech_seeds=cfg.non_tech_seeds,
        accessory_priority=[*cfg.accessory_priority, "samsung s23u"],
        thresholds=cfg.thresholds,
        query_kb=cfg.query_kb,
    )
    engine = SemanticValidationEngine(
        config=cfg,
        model_name="fake-mini",
        top_k=2,
        encoder=FakeEncoder(),
    )

    result = engine.evaluate(
        query="s23u",
        title="Funda para Samsung Galaxy S23 Ultra",
    )

    assert result.decision == "FILTERED"
