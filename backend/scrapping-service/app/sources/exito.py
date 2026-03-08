"""Fuente: Éxito Colombia.

Extrae campos de la página de resultados de búsqueda de exito.com usando
BeautifulSoup sobre el HTML renderizado por Playwright (Chromium headless).

Éxito es una SPA construida sobre VTEX Intelligent Search. Playwright es
obligatorio porque el contenido se hidrata en cliente.

Estrategia de extracción (dos niveles, de mayor a menor fiabilidad):
  1. JSON-LD (`<script type="application/ld+json">`): VTEX lo inyecta con
     datos estructurados del primer producto de los resultados. Es la fuente
     más robusta porque no depende de classnames que pueden cambiar.
  2. Selectores HTML: usando los CSS handles de VTEX que siguen un patrón
     predecible (`vtex-<app>-<version>-x-<handle>`).

Moneda: siempre COP (Éxito solo opera en Colombia).
"""
import json
from typing import Any, Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry


class ExitoSource(BeautifulSoupSource):
    """
    Fuente Éxito Colombia (SPA VTEX).
    Playwright espera el grid de resultados antes de extraer.
    Extrae preferentemente desde JSON-LD; HTML como fallback.
    """

    @property
    def source_name(self) -> str:
        return "exito"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # El grid de resultados de VTEX Intelligent Search
        return (
            "[class*='vtex-search-result'], "
            "[class*='galleryItem'], "
            "[class*='productCard'], "
            "[class*='ProductCard']"
        )

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.exito.com/s?q={quote_plus(query)}"

    # ── JSON-LD helper ─────────────────────────────────────────────────

    def _parse_jsonld(self, soup: BeautifulSoup) -> Optional[dict[str, Any]]:
        """
        Busca el primer bloque JSON-LD de tipo Product o el primer item de un
        ItemList. VTEX inyecta este bloque en las páginas de búsqueda.
        Devuelve el dict del primer producto encontrado, o None.
        """
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                data = json.loads(script.string or "")
            except (json.JSONDecodeError, TypeError):
                continue

            if not isinstance(data, dict):
                continue

            if data.get("@type") == "Product":
                return data

            if data.get("@type") == "ItemList":
                items = data.get("itemListElement", [])
                if items:
                    item = items[0].get("item", {})
                    if item.get("@type") == "Product":
                        return item

        return None

    # ── Extractores individuales (BeautifulSoupSource template method) ────────

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        # 1. JSON-LD
        product = self._parse_jsonld(soup)
        if product and product.get("name"):
            return product["name"]
        # 2. HTML: VTEX CSS handles
        for sel in [
            "[class*='productNameContainer']",
            "[class*='productName']",
            "[class*='ProductName']",
            "h2[class*='vtex']",
        ]:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(strip=True)
                # Descartar títulos genéricos de la página
                if text and text.lower() not in {"search results", "resultados"}:
                    return text
        return None

    def _extract_price(self, soup: BeautifulSoup) -> Optional[str]:
        # 1. JSON-LD
        product = self._parse_jsonld(soup)
        if product:
            offers = product.get("offers") or product.get("aggregateOffer", {})
            price = offers.get("lowPrice") or offers.get("price")
            if price is not None:
                return str(price)
        # 2. HTML: VTEX price handles
        for sel in [
            "[class*='sellingPrice']",
            "[class*='selling-price']",
            "[class*='currencyContainer']",
            "[class*='ProductPrice']",
            "[class*='product-price']",
            "[data-testid='price-value']",
        ]:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(strip=True)
                if text and any(c.isdigit() for c in text):
                    return text
        return None

    def _extract_currency(self, soup: BeautifulSoup) -> Optional[str]:
        # Éxito solo opera en Colombia — moneda siempre COP
        return "COP"

    def _extract_availability(self, soup: BeautifulSoup) -> Optional[str]:
        # 1. JSON-LD
        product = self._parse_jsonld(soup)
        if product:
            offers = product.get("offers") or product.get("aggregateOffer", {})
            availability = offers.get("availability", "")
            if "InStock" in availability:
                return "available"
            if "OutOfStock" in availability:
                return "out_of_stock"
        # 2. HTML: si hay al menos un card de producto en el grid → disponible
        grid_item = soup.select_one(
            "[class*='galleryItem'], [class*='productCard'], [class*='ProductCard']"
        )
        if grid_item:
            return "available"
        out = soup.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if out else None

    def _extract_category(self, soup: BeautifulSoup) -> Optional[str]:
        # JSON-LD: breadcrumb list
        product = self._parse_jsonld(soup)
        if product:
            category = product.get("category")
            if category:
                return category.split("/")[-1].strip()
        # HTML: breadcrumb genérico
        crumbs = soup.select("[class*='Breadcrumb'] a, nav[aria-label*='breadcrumb'] a")
        # Saltar "Inicio" / "Home"
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, soup: BeautifulSoup) -> Optional[str]:
        # 1. JSON-LD
        product = self._parse_jsonld(soup)
        if product:
            images = product.get("image")
            if isinstance(images, list) and images:
                return images[0]
            if isinstance(images, str):
                return images
        # 2. HTML: primera imagen de producto en el grid
        for sel in [
            "[class*='galleryItem'] img",
            "[class*='productCard'] img",
            "[class*='ProductImage'] img",
            "img[class*='vtex']",
        ]:
            el = soup.select_one(sel)
            if el:
                return el.get("src")
        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        product = self._parse_jsonld(soup)
        if product and product.get("description"):
            return product["description"][:500]
        return None


# Auto-registro al importar el módulo
registry.register(ExitoSource())
