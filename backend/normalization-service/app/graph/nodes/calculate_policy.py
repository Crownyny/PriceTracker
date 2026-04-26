"""Node 10 — Calculate Policy

Calcula el proximo ``next_scrape_at`` aplicando la politica dinamica:
  interval = base_interval / (1 + alpha * volatility_score)

Base interval por ``alert_priority``:
  3 -> 5 minutos
  2 -> 12 horas
  1 -> 2 dias
  0 -> 14 dias
"""
import datetime
import logging
import math

from shared.model import ScrapingState

from ...config import settings
from ..state import NormalizationState

logger = logging.getLogger(__name__)

_BASE_INTERVALS = {
    3: datetime.timedelta(minutes=5),
    2: datetime.timedelta(hours=12),
    1: datetime.timedelta(days=2),
    0: datetime.timedelta(days=14),
}


def _safe_priority(value) -> int:
    try:
        priority = int(value)
    except (TypeError, ValueError):
        return 0
    return priority if priority in (0, 1, 2, 3) else 0


def _safe_volatility(value) -> float:
    try:
        volatility = float(value)
    except (TypeError, ValueError):
        return 0.0

    if not math.isfinite(volatility) or volatility < 0:
        return 0.0
    return volatility


def _safe_alpha(value) -> float:
    try:
        alpha = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(alpha) or alpha < 0:
        return 0.0
    return alpha


def _parse_reference_time(raw_value) -> datetime.datetime:
    if isinstance(raw_value, datetime.datetime):
        return raw_value

    if isinstance(raw_value, str):
        try:
            return datetime.datetime.fromisoformat(raw_value)
        except ValueError:
            pass

    return datetime.datetime.now(tz=datetime.timezone.utc)


def _calculate_next_scrape_at(
    now: datetime.datetime,
    priority: int,
    volatility: float,
    alpha: float,
) -> datetime.datetime:
    base_interval = _BASE_INTERVALS.get(priority, _BASE_INTERVALS[0])
    denominator = 1.0 + (alpha * volatility)
    if denominator <= 0:
        denominator = 1.0

    seconds = max(base_interval.total_seconds() / denominator, 1.0)
    return now + datetime.timedelta(seconds=seconds)


async def calculate_policy_node(state: NormalizationState) -> NormalizationState:
    """Calcula la politica de reprogramacion despues de una normalizacion valida."""
    if state.get("error") or state.get("validation_errors"):
        return state

    try:
        raw_fields = state.get("raw_fields") or {}
        final_product = state.get("final_product") or {}
        extra = final_product.get("extra") or {}

        priority = _safe_priority(raw_fields.get("alert_priority", extra.get("alert_priority")))
        volatility = _safe_volatility(raw_fields.get("volatility_score", extra.get("volatility_score")))
        alpha = _safe_alpha(settings.scraping_policy_alpha)

        last_scraped_at = _parse_reference_time(state.get("captured_at"))
        next_scrape_at = _calculate_next_scrape_at(
            now=last_scraped_at,
            priority=priority,
            volatility=volatility,
            alpha=alpha,
        )

        return {
            **state,
            "policy_alert_priority": priority,
            "policy_volatility_score": volatility,
            "policy_alpha": alpha,
            "policy_last_scraped_at": last_scraped_at,
            "policy_next_scrape_at": next_scrape_at,
        }
    except Exception as exc:
        logger.exception("[%s] Error calculating scraping policy", state.get("job_id"))
        return {
            **state,
            "error": str(exc),
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }
