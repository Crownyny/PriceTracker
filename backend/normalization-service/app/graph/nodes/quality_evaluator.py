"""Node 5 — Attribute Quality Evaluator

Determina si las heurísticas son suficientes para evitar LLM.
Score ≥ 4 → skip LLM, score < 4 → usar LLM.

El score cuenta cualquier campo *_candidates no vacío (excepto 'numbers'),
por lo que funciona automáticamente con cualquier dominio de producto.
"""
from ..state import NormalizationState
from .helpers import heuristic_to_merged


async def quality_evaluator_node(state: NormalizationState) -> NormalizationState:
    """Determina si las heurísticas son suficientes (score ≥ 4 → skip LLM)."""
    if state.get("error"):
        return state

    h = state.get("heuristic_attributes") or {}

    # Cuenta cada campo *_candidates no vacío (genéricos + específicos del dominio)
    score = sum(
        1
        for key, val in h.items()
        if key != "numbers" and key.endswith("_candidates") and val
    )

    result: NormalizationState = {**state, "heuristic_confidence": score}

    # Si confianza alta, preparar merged_attributes directamente
    if score >= 4:
        result["merged_attributes"] = heuristic_to_merged(h)

    return result
