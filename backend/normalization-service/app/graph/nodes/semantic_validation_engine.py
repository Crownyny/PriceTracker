"""Motor reusable para validación semántica de 2 capas."""
from __future__ import annotations

import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from .semantic_validation_config import SemanticValidationConfig, SemanticThresholds


class EmbeddingsEncoder(Protocol):
    def encode(self, texts, normalize_embeddings: bool = True):
        ...


@dataclass(frozen=True)
class SemanticValidationResult:
    decision: str
    score: float | None
    pattern_used: str | None
    reason: str
    domain_gap: float
    is_tech: bool
    latency_ms: float


@dataclass(frozen=True)
class DomainLayerDecision:
    decision: str
    domain_gap: float
    is_tech: bool


class SemanticValidationEngine:
    """Aplica inferencia semántica con capa de dominio + capa few-shot KB."""

    def __init__(
        self,
        *,
        config: SemanticValidationConfig,
        model_name: str,
        top_k: int,
        thresholds_override: SemanticThresholds | None = None,
        encoder: EmbeddingsEncoder | None = None,
    ) -> None:
        self._config = config
        self._model_name = model_name
        self._top_k = max(1, int(top_k))
        self._thresholds = thresholds_override or config.thresholds
        self._encoder = encoder or self._load_encoder(model_name)

        self._query_embedding_cache: dict[str, np.ndarray] = {}
        self._layer1_cache: dict[str, DomainLayerDecision] = {}

        self._tech_centroid = self._compute_centroid(config.tech_seeds)
        self._non_tech_centroid = self._compute_centroid(config.non_tech_seeds)

        self._kb_embeddings: dict[str, dict[str, np.ndarray]] = {}
        self._kb_patterns_normalized: dict[str, str] = {}
        for pattern, examples in config.query_kb.items():
            normalized_pattern = self._normalize_text(pattern)
            valid_embeddings = self._encode_batch(examples.valid)
            invalid_embeddings = self._encode_batch(examples.invalid)
            self._kb_patterns_normalized[normalized_pattern] = pattern
            self._kb_embeddings[pattern] = {
                "valid": valid_embeddings,
                "invalid": invalid_embeddings,
            }

    def evaluate(self, *, query: str, title: str | None) -> SemanticValidationResult:
        started_at = time.perf_counter()
        normalized_query = self._normalize_text(query)
        if not normalized_query:
            return self._result(
                decision="UNCERTAIN",
                score=None,
                pattern_used=None,
                reason="Empty query",
                domain_gap=0.0,
                is_tech=False,
                started_at=started_at,
            )

        domain = self._run_domain_layer(normalized_query)
        if domain.decision == "SKIP":
            return self._result(
                decision="SKIP",
                score=None,
                pattern_used=None,
                reason="Query out of tech domain",
                domain_gap=domain.domain_gap,
                is_tech=domain.is_tech,
                started_at=started_at,
            )

        normalized_title = self._normalize_text(title or "")
        if not normalized_title:
            return self._result(
                decision="UNCERTAIN",
                score=None,
                pattern_used=None,
                reason="Missing title",
                domain_gap=domain.domain_gap,
                is_tech=domain.is_tech,
                started_at=started_at,
            )

        pattern = self._resolve_pattern(normalized_query)
        if not pattern:
            return self._result(
                decision="UNCERTAIN",
                score=None,
                pattern_used=None,
                reason="No KB pattern matched",
                domain_gap=domain.domain_gap,
                is_tech=domain.is_tech,
                started_at=started_at,
            )

        lexical_decision = self._apply_lexical_guard(
            query=normalized_query,
            title=normalized_title,
            pattern=pattern,
        )
        if lexical_decision is not None:
            return self._result(
                decision="FILTERED",
                score=None,
                pattern_used=pattern,
                reason=lexical_decision,
                domain_gap=domain.domain_gap,
                is_tech=domain.is_tech,
                started_at=started_at,
            )

        title_embedding = self._encode_query(normalized_title)
        valid_scores = self._topk_similarities(title_embedding, self._kb_embeddings[pattern]["valid"])
        invalid_scores = self._topk_similarities(title_embedding, self._kb_embeddings[pattern]["invalid"])

        valid_mean = float(np.mean(valid_scores)) if valid_scores else 0.0
        invalid_mean = float(np.mean(invalid_scores)) if invalid_scores else 0.0
        score = valid_mean - invalid_mean

        decision = "UNCERTAIN"
        reason = "Between thresholds"
        if score >= self._thresholds.valid_threshold:
            decision = "VALID"
            reason = "Above valid threshold"
        elif score <= self._thresholds.invalid_threshold:
            decision = "FILTERED"
            reason = "Below invalid threshold"

        return self._result(
            decision=decision,
            score=score,
            pattern_used=pattern,
            reason=reason,
            domain_gap=domain.domain_gap,
            is_tech=domain.is_tech,
            started_at=started_at,
        )

    def _apply_lexical_guard(self, *, query: str, title: str, pattern: str) -> str | None:
        """Filtra casos obvios por términos de accesorio o categoría errónea."""
        if self._is_accessory_intent(query=query, pattern=pattern):
            return None

        if not self._is_phone_intent(query=query, pattern=pattern):
            return None

        accessory_terms = [
            "funda",
            "case",
            "cover",
            "forro",
            "protector",
            "mica",
            "vidrio templado",
            "cargador",
            "cable",
            "adaptador",
            "magsafe",
            "pantalla",
            "repuesto",
            "digitalizadora",
            "estuche",
            "soporte",
        ]
        for term in accessory_terms:
            if term in title:
                return f"Accessory keyword guard: {term}"

        off_target_terms = ["tablet", "tab ", "ipad", "monitor", "smart tv", "televisor", "tv "]
        for term in off_target_terms:
            if term in title:
                return f"Off-target device guard: {term.strip()}"

        return None

    @staticmethod
    def _is_accessory_intent(*, query: str, pattern: str) -> bool:
        """Determina si la intención de la búsqueda ya es un accesorio."""
        query_text = query
        pattern_text = SemanticValidationEngine._normalize_text(pattern)
        accessory_terms = {
            "funda",
            "case",
            "cover",
            "forro",
            "protector",
            "mica",
            "vidrio templado",
            "cargador",
            "cable",
            "adaptador",
            "magsafe",
            "powerbank",
            "bateria externa",
            "pantalla",
            "repuesto",
            "estuche",
            "soporte",
            "carcasa",
            "cubierta",
        }

        # Solo se considera intención accesorio si la query lo explicita.
        # Evita falsos negativos cuando el KB tenga patrones de teléfono dentro de accessory_priority.
        return any(term in query_text for term in accessory_terms) or any(
            term == pattern_text for term in accessory_terms
        )

    @staticmethod
    def _is_phone_intent(*, query: str, pattern: str) -> bool:
        merged = f"{query} {pattern}"
        phone_hints = [
            "iphone",
            "galaxy",
            "xiaomi",
            "redmi",
            "motorola",
            "pixel",
            "huawei",
            "celular",
            "smartphone",
            "telefono",
            "phone",
        ]
        if any(hint in merged for hint in phone_hints):
            return True

        # Modelos cortos frecuentes: s23u, a55, g85, etc.
        return bool(re.search(r"\b[a-z]{1,3}\d{2,4}[a-z]?\b", merged))

    def query_cache_size(self) -> int:
        return len(self._query_embedding_cache)

    def layer1_cache_size(self) -> int:
        return len(self._layer1_cache)

    def _run_domain_layer(self, normalized_query: str) -> DomainLayerDecision:
        cached = self._layer1_cache.get(normalized_query)
        if cached is not None:
            return cached

        query_embedding = self._encode_query(normalized_query)
        sim_tech = self._cosine_similarity(query_embedding, self._tech_centroid)
        sim_non_tech = self._cosine_similarity(query_embedding, self._non_tech_centroid)
        gap = sim_tech - sim_non_tech

        decision = "CONTINUE"
        if gap < self._thresholds.domain_threshold:
            decision = "SKIP"

        result = DomainLayerDecision(
            decision=decision,
            domain_gap=gap,
            is_tech=sim_tech >= sim_non_tech,
        )
        self._layer1_cache[normalized_query] = result
        return result

    def _resolve_pattern(self, normalized_query: str) -> str | None:
        # 1) Exact match
        if normalized_query in self._kb_patterns_normalized:
            return self._kb_patterns_normalized[normalized_query]

        # 2) Prioridad de accesorios
        accessory_hits = [
            token for token in self._config.accessory_priority if token and token in normalized_query
        ]
        if accessory_hits:
            for token in accessory_hits:
                for normalized_pattern, raw_pattern in self._kb_patterns_normalized.items():
                    if token in normalized_pattern:
                        return raw_pattern

        # 3) Substring por longitud descendente
        substrings = [
            (normalized_pattern, raw_pattern)
            for normalized_pattern, raw_pattern in self._kb_patterns_normalized.items()
            if normalized_pattern in normalized_query
        ]
        if substrings:
            substrings.sort(key=lambda item: len(item[0]), reverse=True)
            return substrings[0][1]

        # 4) Match por tokens
        query_tokens = set(normalized_query.split())
        best_pattern = None
        best_score = 0.0
        for normalized_pattern, raw_pattern in self._kb_patterns_normalized.items():
            pattern_tokens = set(normalized_pattern.split())
            if not pattern_tokens:
                continue
            overlap = len(query_tokens & pattern_tokens) / len(pattern_tokens)
            if overlap > best_score:
                best_score = overlap
                best_pattern = raw_pattern

        if best_score > 0:
            return best_pattern
        return None

    def _encode_query(self, normalized_query: str) -> np.ndarray:
        cached = self._query_embedding_cache.get(normalized_query)
        if cached is not None:
            return cached
        vector = self._encode_batch([normalized_query])[0]
        self._query_embedding_cache[normalized_query] = vector
        return vector

    def _compute_centroid(self, texts: list[str]) -> np.ndarray:
        embeddings = self._encode_batch(texts)
        centroid = np.mean(embeddings, axis=0)
        norm = np.linalg.norm(centroid)
        if norm == 0:
            return centroid
        return centroid / norm

    def _encode_batch(self, texts: list[str]) -> np.ndarray:
        try:
            embeddings = self._encoder.encode(
                texts,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        except TypeError:
            embeddings = self._encoder.encode(texts, normalize_embeddings=True)
        arr = np.asarray(embeddings, dtype=np.float32)
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        return arr

    @staticmethod
    def _load_encoder(model_name: str):
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(model_name, device="cpu")

    @staticmethod
    def _cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        return float(np.dot(vec_a, vec_b))

    def _topk_similarities(self, query_embedding: np.ndarray, candidates: np.ndarray) -> list[float]:
        if candidates.size == 0:
            return []
        sims = np.dot(candidates, query_embedding)
        top_k = min(self._top_k, sims.shape[0])
        idx = np.argpartition(sims, -top_k)[-top_k:]
        selected = np.sort(sims[idx])[::-1]
        return [float(value) for value in selected.tolist()]

    @staticmethod
    def _normalize_text(value: str) -> str:
        value = unicodedata.normalize("NFKC", value.lower().strip())
        value = re.sub(r"[^a-z0-9áéíóúñü\\s]+", " ", value)
        return re.sub(r"\\s+", " ", value).strip()

    def _result(
        self,
        *,
        decision: str,
        score: float | None,
        pattern_used: str | None,
        reason: str,
        domain_gap: float,
        is_tech: bool,
        started_at: float,
    ) -> SemanticValidationResult:
        latency_ms = (time.perf_counter() - started_at) * 1000
        return SemanticValidationResult(
            decision=decision,
            score=score,
            pattern_used=pattern_used,
            reason=reason,
            domain_gap=domain_gap,
            is_tech=is_tech,
            latency_ms=latency_ms,
        )
