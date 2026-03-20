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
    # kitchen: + qt/qts (cuartos galón), onzas (variante en español de oz)
    "kitchen":     r"(\d+[.,]?\d*)\s?(ml|lt?|kg|g|gr|gramos?|oz|onzas?|qt|qts|cuartos?|w|v|porciones?|pack|unidades?)",
    "home":        r"(\d+[.,]?\d*)\s?(cm|mm|m|kg|w|v|pulgadas?|in|inches?)",
    "jewelry":     r"(\d+[.,]?\d*)\s?(k|ct|mm|gr?)",
    # accessories: + pies/pie/ft (longitud de cables), w (potencia de cargadores)
    "accessories": r"(\d+[.,]?\d*)\s?(cm|mm|pulgadas?|litros?|lt?|in|inches?|pies?|pie|ft|feet|w)",
    # sports: + libras/lbs (variante en español de lb), mm (grosor de tapetes)
    "sports":      r"(\d+[.,]?\d*)\s?(kg|g|gr|cm|mm|km|lb|libras?|lbs?)",
    # beauty: + onzas (variante en español de oz)
    "beauty":      r"(\d+[.,]?\d*)\s?(ml|g|gr|gramos?|oz|onzas?|fl\.?\s?oz|pack|unidades?)",
    "toys":        r"(\d+[.,]?\d*)\s?(cm|mm|kg|g|piezas?|unidades?|pack)",
    # health: + iu (International Units, inglés de ui)
    "health":      r"(\d+[.,]?\d*)\s?(mg|mcg|ml|g|gr|ui|iu|caps?|comprimidos?|pack|unidades?)",
    "automotive":  r"(\d+[.,]?\d*)\s?(cc|hp|nm|mm|lt?|amp?|v|w)",
    "stationery":  r"(\d+[.,]?\d*)\s?(cm|mm|hojas?|p[áa]ginas?|paginas?|unidades?)",
    "baby":        r"(\d+[.,]?\d*)\s?(ml|g|kg|cm|unidades?|pa[ñn]ales?|pack)",
    # food: + onzas (variante en español de oz)
    "food":        r"(\d+[.,]?\d*)\s?(ml|g|gr|gramos?|kg|oz|onzas?|lt?|unidades?|porciones?|pack)",
    "tools":       r"(\d+[.,]?\d*)\s?(mm|cm|m|w|v|amp?|rpm|piezas?)",
    "pet":         r"(\d+[.,]?\d*)\s?(g|gr|kg|ml|lt?|porciones?|unidades?|pack)",
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

    # Normalización de símbolos
    text = text.replace("+", " plus ")
    text = text.replace("/", " ")
    
    # Normalizar comillas de pulgadas (ej: 55", 15.6”) -> 55 pulgadas
    # Se hace antes de la separación de unidades para que entre en el regex de \s?(pulgadas)
    text = re.sub(r'(\d+[.,]?\d*)\s?["”]', r'\1 pulgadas ', text)

    # Unicode + espacios
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Separación de tokens unidos según dominio detectado.
    # Si no se reconoce la categoría, se aplican todos los patrones.
    domain = detect_domain(std.get("category", ""), fallback_text=std.get("title", ""))
    patterns = _DOMAIN_UNIT_PATTERNS
    
    if domain and domain in patterns:
         text = re.sub(patterns[domain], r"\1 \2", text, flags=re.IGNORECASE)
    else:
        # Si no hay dominio, intentar patrones generales de unidades físicas comunes
        # para evitar corromper texto con falsos positivos de dominios muy específicos
        common_units = r"(\d+[.,]?\d*)\s?(cm|mm|m|kg|g|ml|lt?|oz|onzas?|lb|libras?|w|v|mah|gb|tb|pulgadas?|in|inches?)"
        text = re.sub(common_units, r"\1 \2", text, flags=re.IGNORECASE)

    return {**state, "canonical_text": text}
