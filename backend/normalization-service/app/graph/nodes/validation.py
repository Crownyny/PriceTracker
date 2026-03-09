"""Node 9 — Validation + Confidence

Valida coherencia (brand/model en canonical_name) y calcula confianza final
(high / medium / low). El swap storage ≥ memory solo aplica a electronics.
"""
import datetime
import logging
import re
from typing import Optional

from shared.model import NormalizedProduct, ScrapingState

from ..state import NormalizationState
from ...validator import ProductValidator, ValidationError
from .helpers import detect_domain

logger = logging.getLogger(__name__)

_validator = ProductValidator()


async def validation_node(state: NormalizationState) -> NormalizationState:
    """Valida coherencia y calcula confianza final."""
    if state.get("error"):
        return state

    normalized = dict(state.get("normalized_product") or {})
    std = state.get("standardized_product") or {}
    domain = detect_domain(std.get("category", ""))

    # Consistencia numérica: storage >= memory (solo electronics)
    if domain == "electronics":
        storage_val = _extract_numeric(normalized.get("storage"))
        memory_val = _extract_numeric(normalized.get("memory"))
        if storage_val and memory_val and storage_val < memory_val:
            normalized["storage"], normalized["memory"] = (
                normalized["memory"],
                normalized["storage"],
            )

    # Coherencia nombre: brand y model presentes en canonical_name
    canonical = normalized.get("canonical_name", "")
    brand = normalized.get("brand") or ""
    model = normalized.get("model") or ""

    if brand and brand.lower() not in canonical.lower():
        canonical = f"{brand.lower()} {canonical}"
    if model and model.lower() not in canonical.lower():
        canonical = f"{canonical} {model.lower()}"

    normalized["canonical_name"] = re.sub(r"\s+", " ", canonical).strip()

    # Confidence final: cuenta todos los atributos no nulos (excepto canonical_name)
    score = sum(
        1
        for key, val in normalized.items()
        if key != "canonical_name" and val
    )
    if score >= 4:
        confidence = "high"
    elif score >= 2:
        confidence = "medium"
    else:
        confidence = "low"

    # Construir NormalizedProduct
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    final_canonical = normalized.get("canonical_name") or std.get("title", "unknown")

    # Extra: todos los atributos normalizados + meta
    extra = {k: v for k, v in normalized.items() if k != "canonical_name"}
    extra["confidence"] = confidence
    extra["heuristic_confidence"] = state.get("heuristic_confidence", 0)

    try:
        product = NormalizedProduct(
            product_ref=state["product_ref"],
            source_name=state["source_name"],
            canonical_name=final_canonical,
            price=float(std.get("price", 0)),
            currency=std.get("currency", "USD"),
            category=std.get("category", "unknown") or "unknown",
            availability=std.get("availability") in ("in_stock", True),
            updated_at=now,
            image_url=std.get("image_url") or None,
            description=std.get("description") or None,
            extra=extra,
        )

        _validator.validate(product)

        return {
            **state,
            "normalized_product": normalized,
            "final_confidence": confidence,
            "final_product": product.model_dump(mode="json"),
            "validation_errors": [],
        }
    except ValidationError as exc:
        logger.warning("[%s] Validation failed: %s", state.get("job_id"), exc)
        return {
            **state,
            "validation_errors": [str(exc)],
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }
    except Exception as exc:
        logger.exception("[%s] Unexpected error in validation", state.get("job_id"))
        return {**state, "error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}


def _extract_numeric(value) -> Optional[int]:
    """Extrae valor numérico de un string como '256gb'."""
    if not value:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group()) if match else None
