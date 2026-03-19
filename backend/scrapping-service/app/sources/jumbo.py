"""Fuente: Jumbo Colombia (jumbocolombia.com).

Jumbo Colombia (Cencosud) corre sobre VTEX IO (account: jumbocolombiaio).
Aplica la misma estrategia que Olimpica, Rimax y Miniso: se consulta
directamente la API REST de catálogo VTEX, que devuelve JSON limpio sin
necesidad de esperar el render SPA de React.

Estrategia (marzo 2026):
  - URL de búsqueda: /api/catalog_system/pub/products/search?ft=<query>&_from=0&_to=47
  - El browser carga la URL de la API; Playwright recibe JSON envuelto en
    <html><body><pre>...</pre></body></html>.
  - wait_for_selector: "pre"  (siempre presente en respuestas JSON del browser)
  - extract_all_results parsea el texto de <pre> como JSON directamente.

Campos clave de la respuesta VTEX:
  productName, brand, link, items[0].sellers[0].commertialOffer.Price,
  items[0].images[0].imageUrl, categories[-1]
"""
import json
import logging
from typing import Any, Optional
from urllib.parse import quote

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from .base import BaseSource
from .registry import registry

logger = logging.getLogger(__name__)

_BASE = "https://www.jumbocolombia.com"


class JumboSource(BaseSource):
    """
    Fuente Jumbo Colombia usando la API REST VTEX catalog_system.
    Mismo patrón que OlimpicaSource, RimaxSource y MinisoSource.
    """

    @property
    def source_name(self) -> str:
        return "jumbo"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "pre"

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        return (
            f"{_BASE}/api/catalog_system/pub/products/search"
            f"?ft={quote(query, safe='')}&_from=0&_to=47&O=OrderByScoreDESC"
        )

    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html_content, "lxml")

        pre = soup.find("pre")
        raw_text = pre.get_text() if pre else html_content.strip()

        try:
            products: list[dict] = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.warning("[jumbo] No se pudo parsear JSON de la respuesta VTEX")
            return []

        if not isinstance(products, list):
            logger.warning("[jumbo] Respuesta VTEX no es una lista: %s", type(products))
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
                logger.debug("[jumbo] Error procesando producto: %s", exc)
                continue

        return results


registry.register(JumboSource())
