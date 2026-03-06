"""graph/state.py
Estado del grafo LangGraph de normalización.

El estado fluye de nodo en nodo. Cada nodo retorna un dict con SOLO
los campos que modifica; LangGraph hace el merge con el estado anterior.

Convenciones sobre campos:
  - Campos de entrada (job_id, product_ref, source_name, captured_at, raw_fields):
      Populados por el worker antes de invocar al grafo.
      raw_fields viene embebido en el ScrapingMessage (sin MongoDB).
  - Campos de procesamiento (cleaned_product, etc.):
      Populados progresivamente por los nodos.
  - `error`: error fatal → desvía el flujo al nodo error_end.
  - `outcome`: resultado final del pipeline (inicializado pesimistamente).
"""
from typing import Optional
from typing_extensions import TypedDict


class NormalizationState(TypedDict):
    # ── Entrada ───────────────────────────────────────────────────────────────
    job_id: str
    product_ref: str
    source_name: str
    captured_at: str          # ISO-8601 string de la fecha de captura

    # ── Datos del evento (sin MongoDB) ────────────────────────────────────────
    raw_fields: dict          # Campos extraídos por el scraper, del ScrapingMessage

    # ── Campos de procesamiento ───────────────────────────────────────────────
    cleaned_product: Optional[dict]        # NormalizedProduct tras reglas deterministas
    enrichment_updates: Optional[dict]     # Actualizaciones aplicadas por el LLM

    # ── Resultado final ───────────────────────────────────────────────────────
    final_product: Optional[dict]          # NormalizedProduct.model_dump() validado
    validation_errors: list                # Errores de validación de negocio

    # ── Control de flujo ──────────────────────────────────────────────────────
    error: Optional[str]   # Error fatal que aborta el pipeline
    outcome: str           # "normalized" | "normalization_failed"
