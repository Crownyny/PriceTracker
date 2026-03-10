"""Fuente: Éxito Colombia.

Extrae el primer resultado de la página de resultados de búsqueda de exito.com.

Estrategia confirmada por inspección de DOM (marzo 2026):
  - El JSON-LD solo contiene datos de WebSite, no de productos → se usa HTML.
  - wait_for_selector: `[class*='productCard']` (42 cards en la página observada).
  - Classnames relevantes (VTEX genera classnames hasheados pero con prefijo fijo):
      - Contenedor:  `productCard_contentInfo__*`
      - Título:      `styles_name__*`        (primer h3 dentro del card)
      - Marca:       `styles_brand__*`       (segundo h3 dentro del card)
      - Precio:      `ProductPrice_container__*`  (contiene `[class*='Price']`)
  - Moneda: siempre COP (Éxito solo opera en Colombia).
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry


class ExitoSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "exito"

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "[class*='productCard']"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.exito.com/s?q={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select("[class*='productCard']")

    # ── Extractores (BeautifulSoupSource template method) ─────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("[class*='name']")
        if el:
            t = el.get_text(strip=True)
            if t and t.lower() not in {"resultados", "search results"}:
                return t
        h3 = card.select_one("h3")
        return h3.get_text(strip=True) if h3 else None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for sel in [
            "[class*='ProductPrice']",
            "[class*='sellingPrice']",
            "[class*='price__selling']",
            "[class*='currencyContainer']",
        ]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t and any(c.isdigit() for c in t):
                    return t
        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        out = card.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if out else "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        crumbs = soup.select("[class*='Breadcrumb'] a, nav[aria-label*='breadcrumb'] a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for sel in ["img[src*='vtexassets']", "img[src*='exito']", "img"]:
            el = card.select_one(sel)
            if el:
                return el.get("src")
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a[href]")
        if a:
            href = a.get("href", "")
            return href if href.startswith("http") else f"https://www.exito.com{href}"
        return None


registry.register(ExitoSource())
