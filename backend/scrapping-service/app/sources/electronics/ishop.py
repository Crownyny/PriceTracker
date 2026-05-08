"""Fuente: iShop Colombia (co.tiendasishop.com).

Estrategia:
  iShop usa Shopify. Los resultados de búsqueda se obtienen directamente
  desde la API de sugerencias de Shopify, que devuelve JSON sin necesidad
  de ejecutar JavaScript.

  URL canónica: https://co.tiendasishop.com/search?q=<query>  (raw_url)
  API Shopify  : GET /search/suggest.json?q=<query>&resources[type]=product&resources[limit]=48

  Campos del producto (suggest API):
    title    → nombre del producto
    vendor   → marca
    price    → precio en COP (string float, e.g. "4699000.00")
    url      → URL relativa del PDP (se prefija con _BASE)
    image    → CDN URL de la imagen
    type     → tipo/categoría del producto
    available → disponibilidad
"""
import logging
from typing import Any, Optional
from urllib.parse import parse_qs, quote_plus, urlparse

import httpx

from shared.model import ScrapingJob

from ..base import BaseSource
from ..registry import registry

logger = logging.getLogger(__name__)

_BASE = "https://co.tiendasishop.com"
_SUGGEST_URL = f"{_BASE}/search/suggest.json"
_RESULTS_LIMIT = 48

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class IShopSource(BaseSource):
    """
    Fuente iShop usando la API de sugerencias de Shopify.
    No se usa Playwright para obtener los productos; la extracción es REST.
    """

    @property
    def source_name(self) -> str:
        return "ishop"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # No se necesita esperar nada; extract_all_results ignora el HTML.
        return "body"

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        """URL canónica de búsqueda en iShop (usada como raw_url)."""
        return f"{_BASE}/search?q={quote_plus(query)}"

    # ── Extracción principal ──────────────────────────────────────────────────

    def extract_all_results(
        self,
        html_content: str,
        job: ScrapingJob,
    ) -> list[dict[str, Any]]:
        """Llama a la API Shopify suggest e ignora el html_content."""
        parsed = urlparse(job.source_url)
        query_params = parse_qs(parsed.query)
        query = query_params.get("q", [""])[0]

        if not query:
            logger.warning("[ishop] No se pudo extraer query de %s", job.source_url)
            return []

        params = {
            "q": query,
            "resources[type]": "product",
            "resources[limit]": str(_RESULTS_LIMIT),
        }

        try:
            resp = httpx.get(
                _SUGGEST_URL,
                params=params,
                headers=_HEADERS,
                timeout=15,
                follow_redirects=True,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error("[ishop] Error API Shopify suggest: %s", exc)
            return []

        try:
            products = data["resources"]["results"]["products"]
        except (KeyError, TypeError):
            logger.warning("[ishop] Estructura inesperada en suggest API")
            return []

        results: list[dict[str, Any]] = []
        for item in products:
            if not item.get("available", True):
                continue

            title = item.get("title", "").strip()
            if not title:
                continue

            raw_price = item.get("price", "0")
            try:
                price = float(raw_price)
            except (ValueError, TypeError):
                price = None

            url_path = item.get("url", "")
            # Strip query params from URL for cleaner product link
            clean_path = url_path.split("?")[0] if url_path else ""
            product_url = f"{_BASE}{clean_path}" if clean_path.startswith("/") else url_path

            image_url = item.get("image", "")

            results.append({
                "title": title,
                "price": price,
                "raw_currency": "COP",
                "url": product_url,
                "image_url": image_url,
                "brand": item.get("vendor", ""),
                "category": item.get("type", ""),
                "source": "ishop",
            })

        logger.info("[ishop] %d productos para '%s'", len(results), query)
        return results


registry.register(IShopSource())
