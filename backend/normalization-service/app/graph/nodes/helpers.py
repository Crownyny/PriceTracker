"""Funciones helper compartidas entre nodos."""
import re
from typing import Optional

from .constants import DOMAIN_KEYWORDS


def _kw_in_text(kw: str, text: str) -> bool:
    """Comprueba si kw aparece como palabra(s) completa(s) en text.

    - Palabras compuestas (con espacios): coincidencia de subcadena directa,
      ya que la combinación de tokens es suficientemente específica.
    - Palabras simples: se usan word-boundaries permitiendo plurales estándar
      en español/inglés (+s o +es) para detectar correctamente formas como
      "camisetas" a partir de la keyword "camiseta", pero evitando falsos
      positivos como "gel" dentro de "softgels" o "colchon" en "colchoneta".
    """
    if not text:
        return False
    if " " in kw:
        return kw in text
    # Permite exacto O con sufijo plural (s/es). Word-boundary al inicio y al
    # final del token: evita "colchon" → "colchoneta", "gel" → "softgels",
    # pero sí acepta "camiseta" → "camisetas", "auricular" → "auriculares".
    return bool(re.search(r"\b" + re.escape(kw) + r"(?:s|es)?\b", text))


def detect_domain(category: str, fallback_text: str = "") -> Optional[str]:
    """Detecta el dominio según palabras clave de la categoría (en español).
    Si la categoría no coincide, intenta con fallback_text (ej: título del producto).
    Retorna None si no coincide con ningún dominio conocido."""
    cat = (category or "").lower().strip()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if any(_kw_in_text(kw, cat) for kw in keywords):
            return domain
    if fallback_text:
        text = fallback_text.lower().strip()
        for domain, keywords in DOMAIN_KEYWORDS.items():
            if any(_kw_in_text(kw, text) for kw in keywords):
                return domain
    return None


def heuristic_to_merged(h: dict) -> dict:
    """Convierte candidatos heurísticos al formato de atributos fusionados.

    Recorre todos los campos *_candidates del dict de forma genérica.
    Los campos en _NUMERIC_UNIT almacenan enteros y necesitan unidad explícita;
    el resto se toma como string directamente.
    Para añadir un campo numérico con unidad: agrega una entrada en _NUMERIC_UNIT.
    """
    _NUMERIC_UNIT: dict[str, str] = {
        "storage": "gb",
        "memory": "gb",
    }

    merged: dict = {}
    for key, candidates in h.items():
        if not key.endswith("_candidates") or key == "numbers":
            continue
        field = key[: -len("_candidates")]
        if not candidates:
            merged[field] = None
            continue
        unit = _NUMERIC_UNIT.get(field)
        if len(candidates) == 1:
            first = candidates[0]
            merged[field] = f"{first}{unit}" if unit else first
        else:
            # Multi-valor: unir con ", " para conservar todos los candidatos
            if unit:
                merged[field] = ", ".join(f"{c}{unit}" for c in candidates)
            else:
                merged[field] = ", ".join(str(c) for c in candidates)

    return merged
