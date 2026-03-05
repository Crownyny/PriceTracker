"""graph/pipeline.py
Construcción y compilación del grafo LangGraph de normalización.

Topología sin enriquecimiento LLM (enable_enricher=False):
    START
      └─ fetch_raw ──(error)──► error_end ──► END
                   └─(ok)──► clean ──► validate ──(error/invalid)──► error_end ──► END
                                                └─(ok)──► save ──► END

Con enriquecimiento LLM (enable_enricher=True):
    START
      └─ fetch_raw ──(error)──► error_end ──► END
                   └─(ok)──► clean ──► enrich ──► validate ──(error/invalid)──► error_end ──► END
                                                                └─(ok)──► save ──► END

Convención de routing:
  - Si state["error"] está poblado → error_end
  - Si state["validation_errors"] tiene items → error_end
  - En caso contrario → siguiente nodo del happy path
"""
import logging

from langgraph.graph import END, StateGraph

from shared.model import ScrapingState

from .nodes import (
    clean_node,
    make_enrich_node,
    make_fetch_raw_node,
    make_save_node,
    validate_node,
)
from .state import NormalizationState

logger = logging.getLogger(__name__)


# ── Funciones de routing (conditional edges) ─────────────────────────────────

def _route_after_fetch(state: dict) -> str:
    return "error_end" if state.get("error") else "clean"


def _route_after_validate(state: dict) -> str:
    if state.get("error") or state.get("validation_errors"):
        return "error_end"
    return "save"


async def _error_end_node(state: dict) -> dict:
    """Nodo terminal de error: solo registra y cierra el pipeline."""
    logger.error(
        "[%s] Pipeline fallido. outcome=%s error=%s validation_errors=%s",
        state.get("job_id"),
        state.get("outcome"),
        state.get("error"),
        state.get("validation_errors"),
    )
    return {}


# ── Factory del pipeline ──────────────────────────────────────────────────────

def build_pipeline(raw_repo, product_repo, llm=None, enable_enricher: bool = False):
    """
    Construye y compila el grafo de normalización.

    Args:
        raw_repo:        MongoRawRepository — lectura de datos crudos.
        product_repo:    ProductRepository  — escritura de productos normalizados.
        llm:             Instancia de BaseChatModel (LangChain). Opcional.
        enable_enricher: Si True y llm no es None, añade el nodo de enriquecimiento LLM.

    Returns:
        CompiledStateGraph listo para llamar con `await pipeline.ainvoke(initial_state)`.
    """
    graph = StateGraph(NormalizationState)

    # ── Nodos ─────────────────────────────────────────────────────────────────
    graph.add_node("fetch_raw", make_fetch_raw_node(raw_repo))
    graph.add_node("clean", clean_node)
    graph.add_node("validate", validate_node)
    graph.add_node("save", make_save_node(product_repo))
    graph.add_node("error_end", _error_end_node)

    if enable_enricher and llm is not None:
        graph.add_node("enrich", make_enrich_node(llm))

    # ── Entry point ───────────────────────────────────────────────────────────
    graph.set_entry_point("fetch_raw")

    # ── Aristas ───────────────────────────────────────────────────────────────
    graph.add_conditional_edges(
        "fetch_raw",
        _route_after_fetch,
        {"error_end": "error_end", "clean": "clean"},
    )

    if enable_enricher and llm is not None:
        graph.add_edge("clean", "enrich")
        graph.add_edge("enrich", "validate")
    else:
        graph.add_edge("clean", "validate")

    graph.add_conditional_edges(
        "validate",
        _route_after_validate,
        {"error_end": "error_end", "save": "save"},
    )

    graph.add_edge("save", END)
    graph.add_edge("error_end", END)

    compiled = graph.compile()
    logger.info(
        "Pipeline LangGraph compilado (enriquecimiento LLM: %s)",
        enable_enricher and llm is not None,
    )
    return compiled
