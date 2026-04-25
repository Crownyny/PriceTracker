"""Save Node — Persistencia en PostgreSQL

Persiste NormalizedProduct, añade historial de precios y libera lock de scraping.
"""
import logging

from shared.model import NormalizedProduct, ScrapingState

from ..state import NormalizationState

logger = logging.getLogger(__name__)


def make_save_node(product_repo):
    """Factoría: persiste NormalizedProduct, historial y metadatos de scheduling."""

    async def save(state: NormalizationState) -> NormalizationState:
        if state.get("error") or state.get("validation_errors"):
            return state

        product = NormalizedProduct.model_validate(state["final_product"])
        job_id = state["job_id"]
        policy_next_scrape_at = state.get("policy_next_scrape_at")
        policy_last_scraped_at = state.get("policy_last_scraped_at")
        try:
            product_id = await product_repo.upsert_product(
                product,
                next_scrape_at=policy_next_scrape_at,
                last_scraped_at=policy_last_scraped_at,
                release_lock=True,
            )
            await product_repo.append_price_history(
                product_id=product_id,
                price=product.price,
                currency=product.currency,
                job_id=job_id,
            )
            return {**state, "outcome": ScrapingState.NORMALIZED}
        except Exception as exc:
            logger.exception("[%s] Error saving to PostgreSQL", job_id)
            return {**state, "error": str(exc), "outcome": ScrapingState.NORMALIZATION_FAILED}

    return save
