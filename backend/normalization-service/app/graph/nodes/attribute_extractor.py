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
        "network_candidates":     r"\b(4g|5g|lte|wifi|bluetooth|nfc)\b",
        "resolution_candidates":  r"\b(\d+)\s?(mp)\b",
        # Tamaño de pantalla: "15.6 pulgadas", "55 pulgadas", "6.7 in"
        "screen_size_candidates": r"\b(\d+[.,]?\d*)\s?(pulgadas?|pulg\.?|in|inches?)\b",
        "power_candidates":       r"\b(\d+[.,]?\d*)\s?(w|watt)\b",
        # Tipo de conector para gadgets y accesorios de electrónica
        "connector_candidates":   r"\b(usb[-\s]?c|tipo[-\s]?c|type[-\s]?c|usb[-\s]?a|micro[-\s]?usb|lightning|thunderbolt)\b",
        # Longitud de cables: "6.6 pies", "2 metros", "3 ft"
        "length_candidates":      r"\b(\d+[.,]?\d*)\s?(pies?|pie|ft|feet|metros?|m)\b",
    },
    "fashion": {
        # Talla con o sin prefijo "talla", soporta XS-XXXL, S, M, L, XL y números
        "size_candidates":     r"\b(?:talla\s+)?(xs|xxl|xxxl|xl|[sml]|\d{1,2}(?:[.,]\d)?)\b",
        "material_candidates": r"\b(algod[oó]n|poli[eé]ster|lino|seda|cuero|denim|lana|viscosa|n[yý]lon|spandex|fleece)\b",
        "gender_candidates":   r"\b(hombre|mujer|ni[ñn][oa]|unisex|dama|caballero|infantil)\b",
    },
    "kitchen": {
        # Capacidad: litros, ml, qt (cuartos de galón), oz/onzas
        "capacity_candidates": r"\b(\d+[.,]?\d*)\s?(litros?|lt?|ml|qt|qts|cuartos?|oz|onzas?)\b",
        "power_candidates":    r"\b(\d+)\s?(w)\b",
        # Temperatura para hornos y freidoras
        "temperature_candidates": r"\b(\d+)\s*°?\s*(f|c|fahrenheit|celsius)\b",
    },
    "home": {
        # Soporta: "120 x 80 cm", "55 x 24 pulgadas", "48x24 in", "120x80"
        "dimension_candidates": r"(\d+[.,]?\d*\s?[x×]\s?\d+[.,]?\d*(?:\s?[x×]\s?\d+[.,]?\d*)?(?:\s?(?:cm|mm|m|in|pulgadas?|inches?))?)",
        "power_candidates":     r"\b(\d+)\s?(w)\b",
        "material_candidates":  r"\b(madera|metal|vidrio|plastic[oa]|melamina|roble|pino|cedro|acero|aluminio|tela|cuero|marmol|granito|fresno|nogal|wengue)\b",
        "weight_candidates":    r"\b(\d+[.,]?\d*)\s?(kg|lb|libras?)\b",
    },
    "jewelry": {
        "purity_candidates": r"\b(\d+)\s?(k)\b",
        "stone_candidates":  r"\b(diamante|esmeralda|rub[ií]|zafiro|perla|zirconia?|circón|cuarzo|turmalina)\b",
    },
    "beauty": {
        # Volumen: ml, oz, onzas (variante en español)
        "volume_candidates":     r"\b(\d+[.,]?\d*)\s?(ml|oz|fl\.?\s?oz|onzas?)\b",
        "weight_candidates":     r"\b(\d+[.,]?\d*)\s?(g|gr|gramos?)\b",
        "quantity_candidates":   r"\b(\d+)\s?(unidades?|pack|piezas?)\b",
        # Ingredientes activos clave en productos de belleza/skincare
        "ingredient_candidates": r"\b(retinol|ceramida|niacinamida|hialur[oó]nico|col[aá]geno|spf\s?\d+|vitamina\s[ace]\d*)\b",
    },
    "sports": {
        # Peso: kg, lb, libras (plural español)
        "weight_candidates":   r"\b(\d+[.,]?\d*)\s?(kg|lb|libras?|lbs?)\b",
        "size_candidates":     r"\btalla\s?(xs|xxl|xxxl|xl|[sml]|\d{1,2})\b",
        # Materiales comunes en deportes: neopreno, EVA, TPU, caucho, espuma...
        "material_candidates": r"\b(neopreno|eva|tpu|goma|espuma|caucho|n[yý]lon|poliéster|poliester|spandex|algod[oó]n)\b",
        # Grosor de colchonetas y tapetes
        "thickness_candidates": r"\b(\d+[.,]?\d*)\s?(mm)\b",
    },
    "health": {
        "dosage_candidates":   r"\b(\d+[.,]?\d*)\s?(mg|mcg|ui|iu)\b",
        # Cantidad: cápsulas, tabletas, softgels, count (inglés)
        "quantity_candidates": r"\b(\d+)\s?(caps?|comprimidos?|tabletas?|c[áa]psulas?|softgels?|count|unidades?)\b",
    },
    "automotive": {
        "displacement_candidates": r"\b(\d+)\s?(cc)\b",
        "power_candidates":        r"\b(\d+)\s?(hp|cv)\b",
    },
    "baby": {
        "age_candidates": r"\b(\d+)\s?(meses?|a[ñn]os?)\b",
    },
    "food": {
        # Peso con variantes en español e inglés
        "weight_candidates":  r"\b(\d+[.,]?\d*)\s?(kg|g|gr|gramos?|lb|libras?|oz|onzas?)\b",
        # Volumen: ml, litros, oz líquidos
        "volume_candidates":  r"\b(\d+[.,]?\d*)\s?(ml|lt?|oz|onzas?|fl\.?\s?oz)\b",
        "serving_candidates": r"\b(\d+)\s?(porciones?)\b",
        # Sabor para bebidas y comidas
        "flavor_candidates":  r"\b(?:sabor|flavor)\s+([a-záéíóúñü\w]+(?:\s+[a-záéíóúñü\w]+)?)\b",
    },
    "tools": {
        "power_candidates":   r"\b(\d+)\s?(w)\b",
        "voltage_candidates": r"\b(\d+)\s?(v)\b",
        "speed_candidates":   r"\b(\d+)\s?(rpm)\b",
    },
    "pet": {
        "weight_candidates": r"\b(\d+[.,]?\d*)\s?(kg|g|lb|libras?|oz)\b",
    },
    "accessories": {
        # Dimensiones complejas (40x30x10) o simples (15 pulgadas)
        "dimension_candidates": r"(\d+[.,]?\d*\s?[x×]\s?\d+[.,]?\d*(?:\s?[x×]\s?\d+[.,]?\d*)?(?:\s?(?:cm|mm|m|in|pulgadas?|inches?))?)",
        "material_candidates":  r"\b(cuero|piel|tela|lona|nylon|poliéster|poliester|algodón|algodon|sintético|sintetico|impermeable|neopreno|eva|rígido|rigido)\b",
        "gender_candidates":    r"\b(hombre|mujer|ni[ñn][oa]|unisex|dama|caballero)\b",
        # Capacidad para mochilas de viaje
        "capacity_candidates":  r"\b(\d+[.,]?\d*)\s?(litros?|lt?)\b",
        # Potencia para cargadores (W), corriente para cables (A)
        "power_candidates":     r"\b(\d+[.,]?\d*)\s?(w|watt)\b",
        "ampere_candidates":    r"\b(\d+[.,]?\d*)\s?a\b",
        # Longitud de cables: pies, metros
        "length_candidates":    r"\b(\d+[.,]?\d*)\s?(pies?|pie|ft|feet|metros?)\b",
        # Tipo de conector USB
        "connector_candidates": r"\b(usb[-\s]?c|tipo[-\s]?c|type[-\s]?c|usb[-\s]?a|micro[-\s]?usb|lightning|thunderbolt)\b",
    },
    "stationery": {
        "pages_candidates":    r"\b(\d+)\s?(hojas?|p[áa]ginas?)\b",
        "quantity_candidates": r"\b(\d+)\s?unidades?\b",
    },
    "toys": {
        "age_candidates":     r"\b(\d+)\s?(?:\+?\s*a[ñn]os?|years?)\b",
        "pieces_candidates":  r"\b(\d+)\s?(piezas?)\b",
        # Número de jugadores para juegos de mesa
        "players_candidates": r"\b(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:jugadores?|players?)\b",
    },
    "games": {
        "network_candidates":    r"\b(wifi|online|multijugador)\b",
        "resolution_candidates": r"\b(\d+p|4k|8k|fhd|hd|uhd)\b",
        # Edición de consola o videojuego
        "edition_candidates":    r"\b(digital|standard|deluxe|slim|pro|plus)\s+edition\b",
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

    # Pattern genérico de "pack" o cantidad, útil para todos los dominios
    # Soporta español ("Pack de 2", "Paquete x6", "2 unidades") e inglés ("Pack of 24")
    pack_matches = re.findall(r"(?:pack|paquete|caja)\s?(?:de|of|x)?\s?(\d+)|(\d+)\s?(?:unidades?|unid|unds?)", canonical, flags=re.IGNORECASE)
    quantity_candidates: list[int] = []
    for m in pack_matches:
        # m es una tupla, tomar el grupo que no sea vacío
        val = next((g for g in m if g), None)
        if val:
            quantity_candidates.append(int(val))

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
        "quantity_candidates": quantity_candidates,
    }

    # ── Atributos específicos del dominio detectado ───────────────────────────
    if domain:
        for field, pattern in _DOMAIN_SPECIFIC_PATTERNS.get(domain, {}).items():
            matches = re.findall(pattern, canonical, flags=re.IGNORECASE)
            if matches:
                processed_matches = []
                for m in matches:
                    if isinstance(m, str):
                        processed_matches.append(m.lower())
                    elif isinstance(m, tuple):
                        # Concatenar todos los grupos capturados no vacíos (valor + unidad)
                        parts = [p for p in m if p]
                        if parts:
                            processed_matches.append(" ".join(parts).lower())

                # Deduplicar preservando orden (el canonical_text repite título+descripción)
                processed_matches = list(dict.fromkeys(processed_matches))
                if processed_matches:
                    heuristic_attrs[field] = processed_matches

    return {**state, "heuristic_attributes": heuristic_attrs}
