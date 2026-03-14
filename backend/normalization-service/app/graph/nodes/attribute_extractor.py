"""Node 4 — Attribute Candidate Extractor (heurístico)

Extrae patrones estructurales mediante regex y heurísticas por dominio:
- Atributos genéricos (todos los dominios): números, colores, condición, marca.
- Atributos específicos por dominio: almacenamiento, talla, potencia, etc.

Para añadir soporte a un nuevo dominio:
  1. Agrega sus palabras clave en DOMAIN_KEYWORDS (constants.py).
  2. Agrega una entrada en _DOMAIN_SPECIFIC_PATTERNS con los patrones del dominio.
"""
import re

from ..state import NormalizationState
from .constants import COLORS, CONDITIONS, KNOWN_BRANDS, NON_MODEL_TOKENS
from .helpers import detect_domain

_KNOWN_BRANDS = KNOWN_BRANDS

# ── Patrones específicos por dominio ──────────────────────────────────────────
# Cada entrada: nombre_campo (sufijo _candidates) → regex con UN grupo de captura.
# re.findall devuelve list[str] con las coincidencias del grupo.
# Para añadir un dominio: agrega una nueva clave con su dict de {campo: regex}.

_DOMAIN_SPECIFIC_PATTERNS: dict[str, dict[str, str]] = {
    "electronics": {
        "network_candidates":    r"\b(4g|5g|lte|wifi|bluetooth|nfc)\b",
        "resolution_candidates": r"\b(\d+)\s?mp\b",
    },
    "fashion": {
        "size_candidates":     r"\btalla\s?(xs|xxl|xxxl|xl|[sml]|\d{1,2})\b",
        "material_candidates": r"\b(algod[oó]n|poli[eé]ster|lino|seda|cuero|denim|lana|viscosa|n[yý]lon|spandex|fleece)\b",
        "gender_candidates":   r"\b(hombre|mujer|ni[ñn][oa]|unisex|dama|caballero|infantil)\b",
    },
    "kitchen": {
        "capacity_candidates": r"\b(\d+[.,]?\d*)\s?(?:litros?|lt?|ml)\b",
        "power_candidates":    r"\b(\d+)\s?w\b",
    },
    "home": {
        "dimension_candidates": r"(\d+\s?[x×]\s?\d+(?:\s?[x×]\s?\d+)?\s?cm)",
        "power_candidates":     r"\b(\d+)\s?w\b",
    },
    "jewelry": {
        "purity_candidates": r"\b(\d+)\s?k\b",
        "stone_candidates":  r"\b(diamante|esmeralda|rub[ií]|zafiro|perla|zirconia?|circón|cuarzo|turmalina)\b",
    },
    "beauty": {
        "volume_candidates": r"\b(\d+[.,]?\d*)\s?(?:ml|oz)\b",
    },
    "sports": {
        "weight_candidates": r"\b(\d+[.,]?\d*)\s?(?:kg|lb)\b",
        "size_candidates":   r"\btalla\s?(xs|xxl|xxxl|xl|[sml]|\d{1,2})\b",
    },
    "health": {
        "dosage_candidates":   r"\b(\d+[.,]?\d*)\s?(?:mg|mcg|ui)\b",
        "quantity_candidates": r"\b(\d+)\s?(?:caps?|comprimidos?|tabletas?|c[áa]psulas?)\b",
    },
    "automotive": {
        "displacement_candidates": r"\b(\d+)\s?cc\b",
        "power_candidates":        r"\b(\d+)\s?(?:hp|cv)\b",
    },
    "baby": {
        "age_candidates": r"\b(\d+)\s?(?:meses?|a[ñn]os?)\b",
    },
    "food": {
        "weight_candidates":  r"\b(\d+[.,]?\d*)\s?(?:kg|g)\b",
        "volume_candidates":  r"\b(\d+[.,]?\d*)\s?(?:ml|lt?)\b",
        "serving_candidates": r"\b(\d+)\s?porciones?\b",
    },
    "tools": {
        "power_candidates":   r"\b(\d+)\s?w\b",
        "voltage_candidates": r"\b(\d+)\s?v\b",
        "speed_candidates":   r"\b(\d+)\s?rpm\b",
    },
    "pet": {
        "weight_candidates": r"\b(\d+[.,]?\d*)\s?(?:kg|g)\b",
    },
    "accessories": {
        "dimension_candidates": r"\b(\d+[.,]?\d*)\s?(?:cm|pulgadas?)\b",
    },
    "stationery": {
        "pages_candidates":    r"\b(\d+)\s?(?:hojas?|p[áa]ginas?)\b",
        "quantity_candidates": r"\b(\d+)\s?unidades?\b",
    },
    "toys": {
        "age_candidates":    r"\b(\d+)\s?(?:\+?\s*a[ñn]os?|years?)\b",
        "pieces_candidates": r"\b(\d+)\s?piezas?\b",
    },
    "games": {
        "network_candidates":    r"\b(wifi|online|multijugador)\b",
        "resolution_candidates": r"\b(\d+p|4k|8k|fhd|hd|uhd)\b",
    },
}


async def attribute_extractor_node(state: NormalizationState) -> NormalizationState:
    """Extrae patrones estructurales mediante regex y heurísticas."""
    if state.get("error"):
        return state

    canonical = state.get("canonical_text", "")
    std = state.get("standardized_product") or {}
    title = std.get("title", "").lower()

    # ── Atributos genéricos (aplican a todos los dominios) ────────────────────
    numbers = [int(m) for m in re.findall(r"\d+", canonical)]

    # Deduplicar preservando orden (el canonical_text repite título+descripción)
    _seen_colors: set[str] = set()
    color_candidates = [
        w for w in canonical.split()
        if w in COLORS and not _seen_colors.__contains__(w) and not _seen_colors.add(w)  # type: ignore[func-returns-value]
    ]

    condition_candidates: list[str] = []
    for term, normalized in CONDITIONS.items():
        if term in canonical:
            condition_candidates.append(normalized)
            break

    brand_candidates: list[str] = []
    if title:
        # Buscar marcas conocidas en el título
        for token in title.split():
            if token.isalpha() and len(token) >= 2 and token in _KNOWN_BRANDS:
                brand_candidates.append(token)
                break

    # Modelo (letter + number) — útil en electrónica, herramientas y otros
    # Deduplicar preservando orden para evitar repeticiones por título+descripción
    model_candidates = list(dict.fromkeys(
        m for m in re.findall(r"\b[a-z]+\d+[a-z0-9]*\b", canonical)
        if m not in NON_MODEL_TOKENS and len(m) >= 2
    ))

    # ── Almacenamiento + memoria (electrónica / games / dominio desconocido) ──
    domain = detect_domain(std.get("category", ""), fallback_text=std.get("title", ""))
    storage_candidates: list[int] = []
    memory_candidates: list[int] = []

    if domain in ("electronics", "games", None):
        storage_matches = re.findall(r"(\d+)\s?(gb|tb)", canonical, flags=re.IGNORECASE)
        raw_storage: list[int] = []
        for val, unit in storage_matches:
            num = int(val)
            if unit.lower() == "tb":
                num *= 1024
            raw_storage.append(num)
        # Deduplicar antes del split: si título y descripción son iguales, los
        # mismos valores aparecen dos veces y el split min/max daría memoria=storage.
        raw_storage = list(dict.fromkeys(raw_storage))
        if len(raw_storage) >= 2:
            sorted_vals = sorted(raw_storage)
            memory_candidates = [sorted_vals[0]]
            storage_candidates = [sorted_vals[-1]]
        else:
            storage_candidates = raw_storage

    heuristic_attrs: dict = {
        "numbers": numbers,
        "storage_candidates": storage_candidates,
        "memory_candidates": memory_candidates,
        "model_candidates": model_candidates,
        "color_candidates": color_candidates,
        "condition_candidates": condition_candidates,
        "brand_candidates": brand_candidates,
    }

    # ── Atributos específicos del dominio detectado ───────────────────────────
    if domain:
        for field, pattern in _DOMAIN_SPECIFIC_PATTERNS.get(domain, {}).items():
            matches = re.findall(pattern, canonical, flags=re.IGNORECASE)
            if matches:
                heuristic_attrs[field] = [
                    m if isinstance(m, str) else m[0] for m in matches
                ]

    return {**state, "heuristic_attributes": heuristic_attrs}
