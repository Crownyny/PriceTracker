"""Fuente: MercadoLibre Colombia.

Extrae el primer resultado de la página de listado de MercadoLibre.

Estrategia confirmada por inspección de DOM (marzo 2026):
  - URL de búsqueda: listado.mercadolibre.com.co/<query>
  - wait_for_selector: `.poly-card` (48 cards renderizados en listado)
  - Título: `a.poly-component__title` dentro del primer `.ui-search-layout__item`
  - Precio: `.poly-price__current .andes-money-amount__fraction`
  - Moneda: `span.andes-money-amount__currency-symbol` (`$` → COP en Colombia)
  - Imagen: primera `img` en el card (`.poly-component__picture img`)
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

_CURRENCY_SYMBOLS: dict[str, str] = {
    "$":   "COP",
    "US$": "USD",
    "R$":  "BRL",
    "€":   "EUR",
}


class MercadoLibreSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "mercadolibre"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Cards de listado — presentes en la página de búsqueda
        return ".poly-card, .ui-search-layout__item"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://listado.mercadolibre.com.co/{quote_plus(query)}"

    # ── Helper ───────────────────────────────────────────────────────

    def _first_card(self, soup: BeautifulSoup) -> Optional[Tag]:
        return soup.select_one(".ui-search-layout__item")

    # ── Extractores (BeautifulSoupSource template method) ────────────────

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        card = self._first_card(soup)
        if card:
            el = card.select_one("a.poly-component__title, .poly-component__title")
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_price(self, soup: BeautifulSoup) -> Optional[str]:
        card = self._first_card(soup)
        if card:
            # Precio actual (sin cuotas)
            el = card.select_one(
                ".poly-price__current .andes-money-amount__fraction,"
                ".poly-component__price .andes-money-amount__fraction"
            )
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_currency(self, soup: BeautifulSoup) -> Optional[str]:
        card = self._first_card(soup)
        if card:
            el = card.select_one("span.andes-money-amount__currency-symbol")
            symbol = el.get_text(strip=True) if el else None
            return _CURRENCY_SYMBOLS.get(symbol, symbol) if symbol else "COP"
        return "COP"

    def _extract_availability(self, soup: BeautifulSoup) -> Optional[str]:
        if self._first_card(soup):
            return "available"
        out = soup.find(string=lambda t: t and "sin stock" in t.lower())
        return "out_of_stock" if out else None

    def _extract_category(self, soup: BeautifulSoup) -> Optional[str]:
        # Breadcrumb de la página de resultados
        crumbs = soup.select("ol.andes-breadcrumb li a, nav.andes-breadcrumb__item a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, soup: BeautifulSoup) -> Optional[str]:
        card = self._first_card(soup)
        if card:
            for sel in [".poly-component__picture img", "img"]:
                el = card.select_one(sel)
                if el:
                    return el.get("data-zoom") or el.get("src")
        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        # Las páginas de listado no tienen descripción del producto
        return None


registry.register(MercadoLibreSource())

