"""Fuente: H&M Colombia (co.hm.com).

H&M Colombia corre sobre VTEX IO (account: hmcolombia).
Si bien la API REST de catálogo VTEX devuelve JSON limpio, el dominio
co.hm.com bloquea Playwright headless. Por eso la extracción se hace
directamente con httpx (mismo patrón que iShop/Alkomprar), ignorando
el html_content que entrega Playwright.

Estrategia (marzo 2026):
  - build_url retorna la URL de búsqueda HTML canónica (usada como raw_url).
  - wait_for_selector: None  (Playwright solo navega, no extrae).
  - extract_all_results llama directamente al endpoint VTEX REST con httpx.

Endpoint VTEX:
  /api/catalog_system/pub/products/search?ft=<query>&_from=0&_to=47&O=OrderByScoreDESC

Campos clave de la respuesta VTEX:
  productName, brand, link, items[0].sellers[0].commertialOffer.Price,
  items[0].images[0].imageUrl, categories[-1]
"""
import logging
from typing import Any, Optional
from urllib.parse import parse_qs, quote, urlparse

import httpx

from shared.model import ScrapingJob

from ..base import BaseSource
from ..registry import registry

logger = logging.getLogger(__name__)

_BASE = "https://co.hm.com"
_VTEX_SEARCH = f"{_BASE}/api/catalog_system/pub/products/search"
_RESULTS_LIMIT = 47

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "es-CO,es;q=0.9",
}


class HMSource(BaseSource):
    """
    Fuente H&M Colombia usando la API REST VTEX catalog_system.
    Mismo patrón que JumboSource, RimaxSource, MinisoSource, etc.
    """

    @property
    def source_name(self) -> str:
        return "hm"

    @property
    def user_agent(self) -> Optional[str]:
        return _HEADERS["User-Agent"]

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Playwright solo navega; la extracción real es via httpx
        return None

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        """URL canónica de búsqueda (usada como raw_url)."""
        return f"{_BASE}/search?q={quote(query, safe='')}"

    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        """Llama directamente a la API VTEX REST vía httpx, ignorando html_content."""
        parsed = urlparse(job.source_url)
        query_params = parse_qs(parsed.query)
        query = query_params.get("q", [""])[0]

        if not query:
            logger.warning("[hm] No se pudo extraer query de %s", job.source_url)
            return []

        params = {
            "ft": query,
            "_from": "0",
            "_to": str(_RESULTS_LIMIT),
            "O": "OrderByScoreDESC",
        }
        try:
            resp = httpx.get(
                _VTEX_SEARCH,
                params=params,
                headers=_HEADERS,
                timeout=15,
                follow_redirects=True,
            )
            resp.raise_for_status()
            products: list[dict] = resp.json()
        except Exception as exc:
            logger.error("[hm] Error API VTEX: %s", exc)
            return []

        if not isinstance(products, list):
            logger.warning("[hm] Respuesta VTEX no es una lista: %s", type(products))
            return []

        results = []
        for p in products:
            try:
                title = p.get("productName") or p.get("name")
                brand = p.get("brand", "")
                if brand and title and not title.lower().startswith(brand.lower()):
                    title = f"{brand} {title}"

                # Precio: primer item → primer seller → oferta comercial
                price: Optional[str] = None
                items = p.get("items", [])
                if items:
                    sellers = items[0].get("sellers", [])
                    if sellers:
                        offer = sellers[0].get("commertialOffer", {})
                        price_val = offer.get("Price") or offer.get("ListPrice")
                        if price_val is not None:
                            price = str(price_val)

                # Imagen
                image_url: Optional[str] = None
                if items:
                    images = items[0].get("images", [])
                    if images:
                        image_url = images[0].get("imageUrl")

                # Categoría: última en la lista (más específica)
                category: Optional[str] = None
                cats = p.get("categories", [])
                if cats:
                    last_cat = cats[-1].strip("/").split("/")[-1]
                    if last_cat:
                        category = last_cat

                # Disponibilidad
                availability = "available"
                if items:
                    sellers = items[0].get("sellers", [])
                    if sellers:
                        offer = sellers[0].get("commertialOffer", {})
                        if offer.get("AvailableQuantity", 1) == 0:
                            availability = "out_of_stock"

                product_url = p.get("link") or (
                    f"{_BASE}/{p['linkText']}/p" if p.get("linkText") else None
                )

                fields = {
                    "raw_title":        title,
                    "raw_price":        price,
                    "raw_currency":     "COP",
                    "raw_availability": availability,
                    "raw_category":     category,
                    "raw_image_url":    image_url,
                    "raw_description":  p.get("description") or None,
                    "raw_url":          product_url,
                }
                if fields["raw_title"] or fields["raw_price"]:
                    results.append(fields)
            except Exception as exc:
                logger.debug("[hm] Error procesando producto: %s", exc)
                continue

        return results


registry.register(HMSource())
