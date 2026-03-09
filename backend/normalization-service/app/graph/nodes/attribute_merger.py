"""Node 7 — Attribute Merger

Fusiona heurísticas y LLM. LLM tiene prioridad en conflicto;
heurísticas rellenan campos vacíos.
"""
from ..state import NormalizationState
from .helpers import heuristic_to_merged


async def attribute_merger_node(state: NormalizationState) -> NormalizationState:
    """Fusiona heurísticas y LLM. LLM tiene prioridad en conflicto."""
    if state.get("error"):
        return state

    h = state.get("heuristic_attributes") or {}
    llm_attrs = state.get("llm_attributes") or {}

    # Base: heurísticas convertidas al formato fusionado
    base = heuristic_to_merged(h)

    # LLM sobreescribe valores no nulos
    for key, value in llm_attrs.items():
        if value is not None and str(value).strip():
            base[key] = value

    return {**state, "merged_attributes": base}
