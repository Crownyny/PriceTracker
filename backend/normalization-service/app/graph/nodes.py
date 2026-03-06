"""graph/nodes.py
Nodos del grafo LangGraph de normalización.

Cada nodo es una función async que recibe el estado completo y devuelve
un dict con SOLO los campos que modifica (LangGraph hace el merge).
Si retorna {} no se modifica ningún campo.

Cada nodo que necesita una dependencia externa (repositorios, LLM) se
construye con una factoría (patrón closure) para evitar estado global.

Topología:
    fetch_raw → clean → [enrich] → validate → save → (END)
                                      ↘ error_end → (END)
"""
import datetime
import json
import logging

from shared.model import NormalizedProduct, ScrapingState

from ..normalizer.rules import DefaultNormalizer
from ..validator import ProductValidator, ValidationError

logger = logging.getLogger(__name__)

_normalizer = DefaultNormalizer()
_validator = ProductValidator()


# ── Nodo 1: fetch_raw ─────────────────────────────────────────────────────────
def make_fetch_raw_node(raw_repo):
    """
    Factoría del nodo fetch_raw.
    Recupera el documento RawScrapingResult de MongoDB usando job_id.
    Si no existe o el scraping había fallado, registra el error y
    desvía el flujo hacia error_end.
    """

    async def fetch_raw(state: dict) -> dict:
        job_id = state["job_id"]
        try:
            doc = await raw_repo.find_by_job_id(job_id)

            if not doc:
                return {
                    "error": f"No se encontró documento raw para job_id={job_id}",
                    "outcome": ScrapingState.NORMALIZATION_FAILED,
                }
            if doc.get("status") == "failed":
                return {
                    "error": f"El scraping del job {job_id} había fallado: {doc.get('error_message')}",
                    "outcome": ScrapingState.NORMALIZATION_FAILED,
                }
            return {"raw_document": doc}

        except Exception as exc:
            logger.exception("[%s] Error al leer de MongoDB", job_id)
            return {"error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}

    return fetch_raw


# ── Nodo 2: clean ─────────────────────────────────────────────────────────────
async def clean_node(state: dict) -> dict:
    """
    Aplica DefaultNormalizer (reglas deterministas) sobre raw_fields del estado.
    raw_fields viene del ScrapingMessage embebido en el evento (sin MongoDB).
    Si hay error previo, no hace nada (el grafo redirigirá a error_end).
    """
    if state.get("error"):
        return {}

    raw_fields = state.get("raw_fields") or {}
    try:
        product = await _normalizer.normalize(
            raw_fields=raw_fields,
            product_ref=state["product_ref"],
            source_name=state["source_name"],
        )
        return {"cleaned_product": product.model_dump(mode="json")}
    except Exception as exc:
        logger.exception("[%s] Error en clean_node", state["job_id"])
        return {"error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}


# ── Nodo 3 (opcional): enrich ─────────────────────────────────────────────────
def make_enrich_node(llm):
    """
    Nodo de enriquecimiento semántico con LLM.
    Solo se añade al grafo si settings.enable_enricher=True.

    Usa structured output vía LangChain para obtener:
      - canonical_name: nombre estandarizado y limpio del producto
      - category: categoría canónica de la plataforma

    Degradación elegante: si el LLM falla, retorna {} (sin aplicar cambios).
    El pipeline continúa con los valores deterministas del nodo clean.

    El LLM esperado cumple la interfaz langchain_core.language_models.BaseChatModel
    (ChatOpenAI, ChatAnthropic, ChatGoogleGenerativeAI, etc.).
    """
    from langchain_core.messages import HumanMessage
    from langchain_core.output_parsers import JsonOutputParser

    _parser = JsonOutputParser()

    async def enrich(state: dict) -> dict:
        if state.get("error") or not state.get("cleaned_product"):
            return {}

        cp = state["cleaned_product"]
        prompt = (
            "You are a product catalog assistant. "
            "Standardize the following product information and return a JSON object.\n\n"
            f"Input:\n"
            f"  name: {cp.get('canonical_name', '')}\n"
            f"  category: {cp.get('category', '')}\n"
            f"  description: {(cp.get('description') or '')[:300]}\n"
            f"  source: {state['source_name']}\n\n"
            "Return ONLY a JSON object with exactly these two keys:\n"
            '  "canonical_name": a clean, standardized product name (string)\n'
            '  "category": one of [Electronics, Clothing, Home, Food, Health, Sports, Toys, Books, Other]'
        )

        try:
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            text = response.content.strip()
            # Extraer bloque JSON si viene envuelto en markdown
            if "```" in text:
                text = text.split("```")[1].lstrip("json").strip()
            updates: dict = json.loads(text)
            valid = {
                k: v for k, v in updates.items()
                if k in {"canonical_name", "category"} and isinstance(v, str) and v.strip()
            }
            return {"enrichment_updates": valid} if valid else {}

        except Exception as exc:
            logger.warning(
                "[%s] Enriquecimiento LLM fallido (continuando sin él): %s",
                state["job_id"], exc,
            )
            return {}

    return enrich


# ── Nodo 4: validate ──────────────────────────────────────────────────────────
async def validate_node(state: dict) -> dict:
    """
    Combina cleaned_product + enrichment_updates y valida el NormalizedProduct
    contra las reglas de negocio del ProductValidator.
    """
    if state.get("error"):
        return {}

    base = dict(state.get("cleaned_product") or {})
    updates = state.get("enrichment_updates") or {}
    base.update(updates)
    # Refrescar timestamp de actualización
    base["updated_at"] = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()

    try:
        product = NormalizedProduct.model_validate(base)
        _validator.validate(product)
        return {
            "final_product": product.model_dump(mode="json"),
            "validation_errors": [],
        }
    except ValidationError as exc:
        logger.warning("[%s] Validación fallida: %s", state["job_id"], exc)
        return {
            "validation_errors": [str(exc)],
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }
    except Exception as exc:
        logger.exception("[%s] Error inesperado en validate_node", state["job_id"])
        return {"error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}


# ── Nodo 5: save ──────────────────────────────────────────────────────────────
def make_save_node(product_repo):
    """
    Factoría del nodo save.
    Persiste el NormalizedProduct en PostgreSQL y añade entrada al historial.
    """

    async def save(state: dict) -> dict:
        if state.get("error") or state.get("validation_errors"):
            return {}

        product = NormalizedProduct.model_validate(state["final_product"])
        job_id = state["job_id"]
        try:
            await product_repo.upsert_product(product)
            await product_repo.append_price_history(
                product_ref=product.product_ref,
                source_name=product.source_name,
                price=product.price,
                currency=product.currency,
                job_id=job_id,
            )
            return {"outcome": ScrapingState.NORMALIZED}
        except Exception as exc:
            logger.exception("[%s] Error al guardar en PostgreSQL", job_id)
            return {"error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}

    return save
