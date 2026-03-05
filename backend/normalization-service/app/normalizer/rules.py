"""Reglas deterministas de normalización.

Esta clase es usada por el nodo `clean` del grafo LangGraph.
Recibe raw_fields (dict extraído por el Scraper) y produce un NormalizedProduct
cuya semántica podrá luego ser enriquecida por el nodo `enrich` (LLM).

Sin acceso a red ni a la BD: función pura (async solo por consistencia de la interfaz).
"""
import datetime
import logging
import re
from typing import Any

from shared.model import NormalizedProduct

from .base import BaseNormalizer

logger = logging.getLogger(__name__)

# Indicadores de disponibilidad reconocidos (extensible)
_AVAILABILITY_TRUTHY = frozenset({
    "en stock", "disponible", "available", "in stock",
    "true", "1", "yes", "sí", "si",
})

# Mapa de símbolo/nombre → código ISO 4217 (extensible)
_CURRENCY_MAP: dict[str, str] = {
    "$": "USD", "usd": "USD",
    "cop": "COP", "col$": "COP", "$ cop": "COP",
    "eur": "EUR", "€": "EUR",
    "gbp": "GBP", "£": "GBP",
    "mxn": "MXN",
    "brl": "BRL", "r$": "BRL",
}


class DefaultNormalizer(BaseNormalizer):
    """
    Normalizador por defecto con reglas deterministas.
    Adecuado como base; puede especializarse por fuente sobreescribiendo métodos.
    """

    async def normalize(
        self,
        raw_fields: dict[str, Any],
        product_ref: str,
        source_name: str,
    ) -> NormalizedProduct:
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        return NormalizedProduct(
            product_ref=product_ref,
            source_name=source_name,
            canonical_name=self._clean_text(raw_fields.get("raw_title") or ""),
            price=self._parse_price(raw_fields.get("raw_price") or "0"),
            currency=self._normalize_currency(raw_fields.get("raw_currency") or ""),
            category=self._clean_text(raw_fields.get("raw_category") or "unknown"),
            availability=self._parse_availability(raw_fields.get("raw_availability") or ""),
            updated_at=now,
            image_url=raw_fields.get("raw_image_url"),
            description=self._clean_text(raw_fields.get("raw_description") or ""),
        )

    # ── Helpers de normalización ──────────────────────────────────────────────

    @staticmethod
    def _clean_text(text: str) -> str:
        """Elimina espacios extras, saltos de línea y caracteres de control."""
        return " ".join(text.split()).strip()

    @staticmethod
    def _parse_price(raw_price: str) -> float:
        """
        Extrae el valor numérico de un precio en texto.

        Casos cubiertos:
          "$1.999.000"  → 1999000.0   (punto como separador de miles en COP)
          "1,999.00"    → 1999.0      (coma miles, punto decimal)
          "1.999,00"    → 1999.0      (punto miles, coma decimal — formato europeo)
          "1999"        → 1999.0
        """
        # Eliminar todo excepto dígitos, coma y punto
        cleaned = re.sub(r"[^\d.,]", "", raw_price)
        if not cleaned:
            return 0.0

        comma_count = cleaned.count(",")
        dot_count = cleaned.count(".")

        if comma_count == 1 and dot_count == 1:
            # Determinar cuál es el separador decimal por posición
            if cleaned.index(",") < cleaned.index("."):
                # "1,999.00" → coma = miles, punto = decimal
                cleaned = cleaned.replace(",", "")
            else:
                # "1.999,00" → punto = miles, coma = decimal
                cleaned = cleaned.replace(".", "").replace(",", ".")
        elif dot_count > 1:
            # "1.999.000" → todos los puntos son separadores de miles
            cleaned = cleaned.replace(".", "")
        elif comma_count > 1:
            cleaned = cleaned.replace(",", "")
        else:
            # "1,999" (solo coma) → asumir separador decimal europeo
            cleaned = cleaned.replace(",", ".")

        try:
            return float(cleaned)
        except ValueError:
            logger.warning("No se pudo parsear precio: '%s'", raw_price)
            return 0.0

    @staticmethod
    def _normalize_currency(raw: str) -> str:
        """Normaliza la moneda al código ISO 4217."""
        key = raw.lower().strip()
        return _CURRENCY_MAP.get(key, raw.upper().strip() or "USD")

    @staticmethod
    def _parse_availability(raw: str) -> bool:
        return raw.lower().strip() in _AVAILABILITY_TRUTHY
