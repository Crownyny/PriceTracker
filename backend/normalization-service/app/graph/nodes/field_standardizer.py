"""Node 2 — Field Standardizer

Convierte campos al esquema interno independiente de tienda.
"""
from ..state import NormalizationState


async def field_standardizer_node(state: NormalizationState) -> NormalizationState:
    """Convierte campos al esquema interno independiente de tienda."""
    if state.get("error"):
        return state

    s = state.get("sanitized_product") or {}

    standardized = {
        "title": s.get("raw_title", ""),
        "price": s.get("_parsed_price", 0),
        "currency": s.get("_currency", "USD"),
        "availability": s.get("_availability", "in_stock"),
        "category": s.get("raw_category") or "",
        "image_url": s.get("raw_image_url", ""),
        "source_url": s.get("raw_url", ""),
        "description": s.get("raw_description", ""),
        "source": state.get("source_name", ""),
    }

    return {**state, "standardized_product": standardized}
