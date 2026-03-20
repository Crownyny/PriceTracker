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
        return ".poly-card, .ui-search-layout__item"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://listado.mercadolibre.com.co/{quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select(".ui-search-layout__item")

    # ── Extractores (BeautifulSoupSource template method) ─────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("a.poly-component__title, .poly-component__title")
        return el.get_text(strip=True) if el else None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one(
            ".poly-price__current .andes-money-amount__fraction,"
            ".poly-component__price .andes-money-amount__fraction"
        )
        return el.get_text(strip=True) if el else None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("span.andes-money-amount__currency-symbol")
        symbol = el.get_text(strip=True) if el else None
        return _CURRENCY_SYMBOLS.get(symbol, symbol) if symbol else "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Si el card tiene precio visible → disponible; si tiene badge de sin stock → agotado
        out = card.find(string=lambda t: t and "sin stock" in t.lower())
        return "out_of_stock" if out else "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Breadcrumb es dato de página, no de card
        crumbs = soup.select("ol.andes-breadcrumb li a, nav.andes-breadcrumb__item a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for sel in [".poly-component__picture img", "img"]:
            el = card.select_one(sel)
            if el:
                return el.get("data-zoom") or el.get("src")
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a.poly-component__title[href], a[href*='mercadolibre']")
        return a.get("href") if a else None


registry.register(MercadoLibreSource())

