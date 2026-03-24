"""Node 2.5 — Semantic Validation (domain + few-shot KB)."""
from __future__ import annotations

import logging

from .semantic_validation_engine import SemanticValidationEngine
from ..state import NormalizationState


logger = logging.getLogger(__name__)


def make_semantic_validation_node(engine: SemanticValidationEngine | None = None):
    async def semantic_validation_node(state: NormalizationState) -> NormalizationState:
        if state.get("error"):
            return state

        query = str(state.get("query") or "").strip()
        if not query:
            # No debería ocurrir: el worker hace short-circuit para query faltante.
            logger.info(
                "SemanticValidation product_ref=%s source=%s title=%s query=%s decision=%s score=%s pattern=%s reason=%s gap=%.4f tech=%s latency_ms=%.2f",
                state.get("product_ref"),
                state.get("source_name"),
                "",
                query,
                "UNCERTAIN",
                None,
                None,
                "Missing query",
                0.0,
                False,
                0.0,
            )
            return {
                **state,
                "semantic_decision": "UNCERTAIN",
                "semantic_score": None,
                "semantic_pattern_used": None,
                "semantic_reason": "Missing query",
                "semantic_domain_gap": 0.0,
                "semantic_is_tech": False,
                "semantic_latency_ms": 0.0,
            }

        std = state.get("standardized_product") or {}
        sanitized = state.get("sanitized_product") or {}
        raw = state.get("raw_fields") or {}
        title = (
            std.get("title")
            or sanitized.get("raw_title")
            or raw.get("raw_title")
            or ""
        )

        if engine is None:
            logger.info(
                "SemanticValidation product_ref=%s source=%s title=%s query=%s decision=%s score=%s pattern=%s reason=%s gap=%.4f tech=%s latency_ms=%.2f",
                state.get("product_ref"),
                state.get("source_name"),
                title,
                query,
                "SKIP",
                None,
                None,
                "Semantic validator disabled",
                0.0,
                False,
                0.0,
            )
            return {
                **state,
                "semantic_decision": "SKIP",
                "semantic_score": None,
                "semantic_pattern_used": None,
                "semantic_reason": "Semantic validator disabled",
                "semantic_domain_gap": 0.0,
                "semantic_is_tech": False,
                "semantic_latency_ms": 0.0,
            }

        result = engine.evaluate(query=query, title=title)
        logger.info(
            "SemanticValidation product_ref=%s source=%s title=%s query=%s decision=%s score=%s pattern=%s reason=%s gap=%.4f tech=%s latency_ms=%.2f",
            state.get("product_ref"),
            state.get("source_name"),
            title,
            query,
            result.decision,
            result.score,
            result.pattern_used,
            result.reason,
            result.domain_gap,
            result.is_tech,
            result.latency_ms,
        )
        return {
            **state,
            "semantic_decision": result.decision,
            "semantic_score": result.score,
            "semantic_pattern_used": result.pattern_used,
            "semantic_reason": result.reason,
            "semantic_domain_gap": result.domain_gap,
            "semantic_is_tech": result.is_tech,
            "semantic_latency_ms": result.latency_ms,
        }

    return semantic_validation_node
