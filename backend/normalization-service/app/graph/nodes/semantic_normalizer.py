"""Node 8 — Product Semantic Normalizer

Construye representación canónica del producto (LLM o fallback determinista).
"""
import json
import logging
from typing import Optional

from ..state import NormalizationState
from .constants import HEURISTIC_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)


def make_semantic_normalizer_node(llm=None):
    """Factoría: construye representación canónica (LLM o determinista).

    Solo usa LLM cuando la confianza heurística es baja (ruta LLM activa).
    """

    async def semantic_normalizer(state: NormalizationState) -> NormalizationState:
        if state.get("error"):
            return state

        merged = state.get("merged_attributes") or {}

        # Solo usar LLM si la confianza heurística fue baja (el flujo pasó por llm_extractor)
        if llm is not None and state.get("heuristic_confidence", 0) < HEURISTIC_CONFIDENCE_THRESHOLD:
            result = await _semantic_normalize_with_llm(llm, merged, state.get("job_id"))
            if result is not None:
                return {**state, "normalized_product": result}

        # Ruta rápida determinista (confianza alta o LLM no disponible)
        return {**state, "normalized_product": _build_canonical_deterministic(merged)}

    return semantic_normalizer


async def _semantic_normalize_with_llm(llm, merged: dict, job_id: Optional[str]) -> Optional[dict]:
    """Intenta normalización semántica con LLM; retorna None si falla."""
    prompt = (
        "You normalize ecommerce product attributes.\n\n"
        "Create a canonical product representation.\n\n"
        "Rules:\n\n"
        "1. Do not invent attributes.\n"
        "2. Canonical name: concatenate all non-null attributes in order, lowercase, no duplicate tokens.\n"
        "3. Use lowercase for all values.\n\n"
        f"ATTRIBUTES:\n{json.dumps(merged, default=str)}\n\n"
        "Return the same attributes normalized plus a 'canonical_name' field. Return JSON only."
    )

    try:
        from langchain_core.messages import HumanMessage

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        text = response.content.strip()

        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        result = json.loads(text)
        # qwen2 a veces devuelve una lista en lugar de un objeto
        if isinstance(result, list):
            result = result[0] if result else {}
        if not isinstance(result, dict):
            result = {}
        # Garantizar canonical_name si el LLM no lo devolvió
        if not result.get("canonical_name"):
            result["canonical_name"] = _build_canonical_name(result)
        return result

    except Exception as exc:
        logger.warning(
            "[%s] Semantic normalizer LLM failed, using deterministic: %s",
            job_id, exc,
        )
        return None


def _build_canonical_name(merged: dict) -> str:
    """Genera canonical_name a partir de todos los valores no nulos de merged."""
    seen: set[str] = set()
    unique: list[str] = []
    for val in merged.values():
        if not val or not str(val).strip():
            continue
        for token in str(val).lower().strip().split():
            if token not in seen:
                seen.add(token)
                unique.append(token)
    return " ".join(unique)


def _build_canonical_deterministic(merged: dict) -> dict:
    """Construye representación canónica sin LLM.
    Itera todos los campos de merged dinámicamente, sin asumir un dominio concreto.
    """
    return {**merged, "canonical_name": _build_canonical_name(merged)}
