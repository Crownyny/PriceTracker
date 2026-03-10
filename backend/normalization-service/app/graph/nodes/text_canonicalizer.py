"""Node 3 — Text Canonicalizer

Prepara el texto para extracción semántica:
- Separación de tokens unidos según dominio de categoría (256gb → 256 gb)
- Normalización de símbolos (+ → plus, / → espacio)

Para añadir un nuevo dominio:
  1. Agrega sus palabras clave en DOMAIN_KEYWORDS (constants.py).
  2. Agrega su patrón de unidades en _DOMAIN_UNIT_PATTERNS con la misma clave.
"""
import re
import unicodedata

from ..state import NormalizationState
from .helpers import detect_domain

# ── Patrones de separación de tokens numéricos por dominio ────────────────────
# Formato: r"(\d+[.,]?\d*)\s?(unidad1|unidad2|...)"
# Para añadir un dominio nuevo basta con agregar una entrada aquí.

_DOMAIN_UNIT_PATTERNS: dict[str, str] = {
    "electronics": r"(\d+[.,]?\d*)\s?(gb|tb|mb|ghz|mhz|mp|mah|w|v|hz)",
    "fashion":     r"(\d+[.,]?\d*)\s?(cm|mm|pulgadas?)",
    "kitchen":     r"(\d+[.,]?\d*)\s?(ml|lt?|kg|g|oz|w|v|porciones?)",
    "home":        r"(\d+[.,]?\d*)\s?(cm|mm|m|kg|w|v|pulgadas?)",
    "jewelry":     r"(\d+[.,]?\d*)\s?(k|ct|mm|gr?)",
    "accessories": r"(\d+[.,]?\d*)\s?(cm|mm|pulgadas?|litros?|lt?)",
    "sports":      r"(\d+[.,]?\d*)\s?(kg|g|cm|mm|km|lb)",
    "beauty":      r"(\d+[.,]?\d*)\s?(ml|g|oz|fl\.?\s?oz)",
    "toys":        r"(\d+[.,]?\d*)\s?(cm|mm|kg|g|piezas?|unidades?)",
    "health":      r"(\d+[.,]?\d*)\s?(mg|mcg|ml|g|ui|caps?|comprimidos?)",
    "automotive":  r"(\d+[.,]?\d*)\s?(cc|hp|nm|mm|lt?|amp?|v|w)",
    "stationery":  r"(\d+[.,]?\d*)\s?(cm|mm|hojas?|páginas?|paginas?|unidades?)",
    "baby":        r"(\d+[.,]?\d*)\s?(ml|g|kg|cm|unidades?|pañales?)",
    "food":        r"(\d+[.,]?\d*)\s?(ml|g|kg|oz|lt?|unidades?|porciones?)",
    "tools":       r"(\d+[.,]?\d*)\s?(mm|cm|m|w|v|amp?|rpm)",
    "pet":         r"(\d+[.,]?\d*)\s?(g|kg|ml|lt?|porciones?|unidades?)",
    "games":       r"(\d+[.,]?\d*)\s?(gb|tb|mb|ghz|fps|hz)",
}


# ── Nodo ─────────────────────────────────────────────────────────────────────

async def text_canonicalizer_node(state: NormalizationState) -> NormalizationState:
    """Prepara el texto para extracción semántica."""
    if state.get("error"):
        return state

    std = state.get("standardized_product") or {}
    parts = [std.get("title", ""), std.get("description", ""), std.get("category", "")]
    text = " ".join(p for p in parts if p).lower()

    # Separación de tokens unidos según dominio detectado.
    # Si no se reconoce la categoría, se aplican todos los patrones.
    domain = detect_domain(std.get("category", ""), fallback_text=std.get("title", ""))
    if domain:
        text = re.sub(_DOMAIN_UNIT_PATTERNS[domain], r"\1 \2", text, flags=re.IGNORECASE)
    else:
        for pattern in _DOMAIN_UNIT_PATTERNS.values():
            text = re.sub(pattern, r"\1 \2", text, flags=re.IGNORECASE)

    # Normalización de símbolos
    text = text.replace("+", " plus ")
    text = text.replace("/", " ")

    # Unicode + espacios
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()

    return {**state, "canonical_text": text}
