"""Save Node — Persistencia en PostgreSQL

Persiste NormalizedProduct y añade historial de precios.
"""
import logging

from shared.model import NormalizedProduct, ScrapingState

from ..state import NormalizationState

logger = logging.getLogger(__name__)


def make_save_node(product_repo):
    """Factoría: persiste NormalizedProduct y añade historial de precios."""

    async def save(state: NormalizationState) -> NormalizationState:
        if state.get("error") or state.get("validation_errors"):
            return state

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
            return {**state, "outcome": ScrapingState.NORMALIZED}
        except Exception as exc:
            logger.exception("[%s] Error saving to PostgreSQL", job_id)
            return {**state, "error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}

    return save
