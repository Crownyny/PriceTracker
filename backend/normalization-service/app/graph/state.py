"""graph/state.py
Estado del grafo LangGraph de normalización (v2 — pipeline de 9 nodos).

Flujo:
  input_sanitizer → field_standardizer → text_canonicalizer
  → attribute_extractor → quality_evaluator
  → [llm_extractor → attribute_merger] (solo si confianza baja)
  → semantic_normalizer → validation → save → END

Cada nodo retorna un dict con SOLO los campos que modifica;
LangGraph hace el merge con el estado anterior.
"""
from typing import Optional
from typing_extensions import TypedDict


class NormalizationState(TypedDict):
    # ── Entrada (populados por el worker) ─────────────────────────────────────
    job_id: str
    product_ref: str
    source_name: str
    captured_at: str                         # ISO-8601
    raw_fields: dict                         # Campos crudos del scraper

    # ── Node 1: Input Sanitizer ───────────────────────────────────────────────
    sanitized_product: Optional[dict]        # raw_fields limpiados
    product_invalid: bool                    # True si raw_title es None

    # ── Node 2: Field Standardizer ────────────────────────────────────────────
    standardized_product: Optional[dict]     # Esquema interno unificado

    # ── Node 3: Text Canonicalizer ────────────────────────────────────────────
    canonical_text: Optional[str]            # Texto preparado para extracción

    # ── Node 4: Attribute Candidate Extractor ─────────────────────────────────
    heuristic_attributes: Optional[dict]     # Candidatos heurísticos

    # ── Node 5: Attribute Quality Evaluator ───────────────────────────────────
    heuristic_confidence: Optional[int]      # 0-4

    # ── Node 6: LLM Attribute Extractor ───────────────────────────────────────
    llm_attributes: Optional[dict]           # Atributos extraídos por LLM

    # ── Node 7: Attribute Merger / Node 5 high-confidence ─────────────────────
    merged_attributes: Optional[dict]        # Atributos fusionados

    # ── Node 8: Product Semantic Normalizer ───────────────────────────────────
    normalized_product: Optional[dict]       # Representación canónica

    # ── Node 9: Validation + Confidence ───────────────────────────────────────
    final_confidence: Optional[str]          # "high" | "medium" | "low"
    final_product: Optional[dict]            # NormalizedProduct.model_dump() validado
    validation_errors: list                  # Errores de validación de negocio

    # ── Control de flujo ──────────────────────────────────────────────────────
    error: Optional[str]                     # Error fatal → error_end
    outcome: str                             # "normalized" | "normalization_failed"
