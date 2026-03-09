"""graph/pipeline.py
Construcción y compilación del grafo LangGraph de normalización (v2 — 9 nodos).

Topología:

    START
      └─ input_sanitizer ──(invalid)──► error_end ──► END
                         └─(ok)──► field_standardizer
                                    └─► text_canonicalizer
                                         └─► attribute_extractor
                                              └─► quality_evaluator
                                                   ├─(score ≥ 3)──► semantic_normalizer
                                                   └─(score < 3)──► llm_extractor
                                                                      └─► attribute_merger
                                                                           └─► semantic_normalizer
                                                                                └─► validation
                                                                                     ├─(error)──► error_end ──► END
                                                                                     └─(ok)──► save ──► END
"""
import logging

from langgraph.graph import END, StateGraph

from .nodes import (
    input_sanitizer_node,
    field_standardizer_node,
    text_canonicalizer_node,
    attribute_extractor_node,
    quality_evaluator_node,
    make_llm_extractor_node,
    attribute_merger_node,
    make_semantic_normalizer_node,
    validation_node,
    make_save_node,
    error_end_node,
)
from .state import NormalizationState

logger = logging.getLogger(__name__)


# ── Funciones de routing (conditional edges) ─────────────────────────────────

def _route_after_sanitizer(state: NormalizationState) -> str:
    """Desvía a error_end si el producto es inválido (ej. título nulo)."""
    if state.get("error") or state.get("product_invalid"):
        return "error_end"
    return "field_standardizer"


def _route_after_quality(state: NormalizationState) -> str:
    """Si confianza heurística ≥ 4: skip LLM → semantic_normalizer."""
    if state.get("heuristic_confidence", 0) >= 4:
        return "semantic_normalizer"
    return "llm_extractor"


def _route_after_validation(state: NormalizationState) -> str:
    """Desvía a error_end si hay errores de validación."""
    if state.get("error") or state.get("validation_errors"):
        return "error_end"
    return "save"


# ── Factory del pipeline ──────────────────────────────────────────────────────

def build_pipeline(product_repo, llm=None, enable_enricher: bool = False):
    """
    Construye y compila el grafo de normalización de 9 nodos.

    Args:
        product_repo:    ProductRepository — escritura de productos normalizados.
        llm:             Instancia de BaseChatModel (LangChain). Opcional.
        enable_enricher: Si True y llm no es None, los nodos LLM usarán el modelo.

    Returns:
        CompiledStateGraph listo para llamar con ``await pipeline.ainvoke(state)``.
    """
    active_llm = llm if (enable_enricher and llm is not None) else None

    graph = StateGraph(NormalizationState)

    # ── Nodos ───────────────────────────────────────────────────────────────
    graph.add_node("input_sanitizer", input_sanitizer_node)
    graph.add_node("field_standardizer", field_standardizer_node)
    graph.add_node("text_canonicalizer", text_canonicalizer_node)
    graph.add_node("attribute_extractor", attribute_extractor_node)
    graph.add_node("quality_evaluator", quality_evaluator_node)
    graph.add_node("llm_extractor", make_llm_extractor_node(active_llm))
    graph.add_node("attribute_merger", attribute_merger_node)
    graph.add_node("semantic_normalizer", make_semantic_normalizer_node(active_llm))
    graph.add_node("validation", validation_node)
    graph.add_node("save", make_save_node(product_repo))
    graph.add_node("error_end", error_end_node)

    # ── Entry point ─────────────────────────────────────────────────────────
    graph.set_entry_point("input_sanitizer")

    # ── Aristas ─────────────────────────────────────────────────────────────
    graph.add_conditional_edges(
        "input_sanitizer",
        _route_after_sanitizer,
        {"error_end": "error_end", "field_standardizer": "field_standardizer"},
    )

    graph.add_edge("field_standardizer", "text_canonicalizer")
    graph.add_edge("text_canonicalizer", "attribute_extractor")
    graph.add_edge("attribute_extractor", "quality_evaluator")

    # Bifurcación: confianza alta → skip LLM, baja → llm_extractor
    graph.add_conditional_edges(
        "quality_evaluator",
        _route_after_quality,
        {"semantic_normalizer": "semantic_normalizer", "llm_extractor": "llm_extractor"},
    )

    graph.add_edge("llm_extractor", "attribute_merger")
    graph.add_edge("attribute_merger", "semantic_normalizer")

    graph.add_edge("semantic_normalizer", "validation")

    graph.add_conditional_edges(
        "validation",
        _route_after_validation,
        {"error_end": "error_end", "save": "save"},
    )

    graph.add_edge("save", END)
    graph.add_edge("error_end", END)

    compiled = graph.compile()
    logger.info(
        "Pipeline LangGraph v2 compiled (LLM enrichment: %s)",
        active_llm is not None,
    )
    return compiled
