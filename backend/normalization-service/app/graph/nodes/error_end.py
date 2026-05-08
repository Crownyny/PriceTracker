"""Error End Node

Nodo terminal de error: registra y cierra el pipeline.
"""
import logging

from ..state import NormalizationState

logger = logging.getLogger(__name__)


async def error_end_node(state: NormalizationState) -> NormalizationState:
    """Nodo terminal de error: registra y cierra el pipeline."""
    logger.error(
        "[%s] Pipeline failed. outcome=%s error=%s validation_errors=%s",
        state.get("job_id"),
        state.get("outcome"),
        state.get("error"),
        state.get("validation_errors"),
    )
    return state
