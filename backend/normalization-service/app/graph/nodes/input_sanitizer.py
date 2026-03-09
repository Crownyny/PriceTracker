"""Node 1 — Input Sanitizer

Limpia errores estructurales antes de cualquier análisis:
- Normalización de strings (unicode, strip, doble espacio)
- Normalización de precio (float + moneda, con contexto de fuente)
- Normalización de availability
- Manejo de nulos (raw_title)
"""
import logging
import re
import unicodedata

from shared.model import ScrapingState

from ..state import NormalizationState
from .constants import AVAILABILITY_MAP, CURRENCY_MAP, SOURCE_DEFAULT_CURRENCY

logger = logging.getLogger(__name__)


async def input_sanitizer_node(state: NormalizationState) -> NormalizationState:
    """Limpia errores estructurales antes de cualquier análisis."""
    if state.get("error"):
        return state

    raw_fields = state.get("raw_fields") or {}

    # Manejo de nulos
    raw_title = raw_fields.get("raw_title")
    if not raw_title:
        return {
            **state,
            "product_invalid": True,
            "error": "raw_title is None or empty",
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }

    # Normalización de strings
    sanitized: dict = {}
    for key, value in raw_fields.items():
        if isinstance(value, str):
            value = unicodedata.normalize("NFKC", value)
            value = value.strip()
            value = re.sub(r"\s+", " ", value)
            sanitized[key] = value
        else:
            sanitized[key] = value

    # Normalización de precio
    source_name = state.get("source_name", "")
    price_value, inferred_currency = _parse_price_full(
        str(sanitized.get("raw_price", "0"))
    )
    sanitized["_parsed_price"] = price_value

    raw_currency = sanitized.get("raw_currency", "")
    if raw_currency:
        sanitized["_currency"] = _normalize_currency(raw_currency)
    elif inferred_currency:
        sanitized["_currency"] = inferred_currency
    else:
        # Usar moneda por defecto de la fuente o USD como fallback
        sanitized["_currency"] = SOURCE_DEFAULT_CURRENCY.get(source_name, "COP")

    # Normalización de availability
    sanitized["_availability"] = _map_availability(
        str(sanitized.get("raw_availability", ""))
    )

    return {**state, "sanitized_product": sanitized, "product_invalid": False}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_price_full(raw_price: str) -> tuple[float, str]:
    """Devuelve (valor_float, moneda_detectada)."""
    currency = ""
    lower = raw_price.lower()
    # Intentar primero prefijos específicos (más largos) para evitar que "$" capture todo
    for symbol, code in sorted(CURRENCY_MAP.items(), key=lambda x: -len(x[0])):
        if symbol in lower:
            currency = code
            break

    cleaned = re.sub(r"[^\d.,]", "", raw_price)
    if not cleaned:
        return 0.0, currency

    comma_count = cleaned.count(",")
    dot_count = cleaned.count(".")

    if comma_count == 1 and dot_count == 1:
        if cleaned.index(",") < cleaned.index("."):
            cleaned = cleaned.replace(",", "")
        else:
            cleaned = cleaned.replace(".", "").replace(",", ".")
    elif dot_count > 1:
        cleaned = cleaned.replace(".", "")
    elif comma_count > 1:
        cleaned = cleaned.replace(",", "")
    elif comma_count == 1:
        parts = cleaned.split(",")
        if len(parts[1]) <= 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif dot_count == 1:
        parts = cleaned.split(".")
        if len(parts[1]) > 2:
            cleaned = cleaned.replace(".", "")

    try:
        return float(cleaned), currency
    except ValueError:
        return 0.0, currency


def _normalize_currency(raw: str) -> str:
    key = raw.lower().strip()
    return CURRENCY_MAP.get(key, raw.upper().strip() or "USD")


def _map_availability(raw: str) -> str:
    key = raw.lower().strip()
    if not key:
        return "unknown"
    return AVAILABILITY_MAP.get(key, "unknown")
