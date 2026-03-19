"""Fuente: Alkosto Colombia.

Estrategia (DOM confirmado por inspección — marzo 2026):
  Alkosto usa Algolia InstantSearch para renderizar sus resultados.
  Los cards aparecen como <li class="ais-InfiniteHits-item ..."> y están
  completamente presentes en el HTML tras el primer render JS.

  - URL de búsqueda: /search?text=<query>
  - wait_for_selector: "li.ais-InfiniteHits-item"
  - Título:    h3.js-algolia-product-title
  - Precio:    .product__item__information__base-price  (texto: "$ 4.799.990")
  - Imagen:    img[src]  → URL relativa, se prefija con https://www.alkosto.com
  - Marca:     [class*='brand']
  - Moneda:    siempre COP (solo opera en Colombia)
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

_BASE_URL = "https://www.alkosto.com"


class AlkostoSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "alkosto"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "li.ais-InfiniteHits-item"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE_URL}/search?text={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select("li.ais-InfiniteHits-item")

    # ── Extractores ───────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("h3.js-algolia-product-title")
        return el.get_text(strip=True) if el else None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one(".product__item__information__base-price")
        return el.get_text(strip=True) if el else None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        img = card.select_one("img[src]")
        if not img:
            return None
        src = img.get("src", "")
        if src.startswith("http"):
            return src
        return f"{_BASE_URL}{src}" if src else None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        brand = card.select_one("[class*='brand']")
        return brand.get_text(strip=True) if brand else None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a.product__item__top__link[href], a[href]")
        if a:
            href = a.get("href", "").split("?")[0]  # quitar parámetros algolia
            return href if href.startswith("http") else f"{_BASE_URL}{href}"
        return None


registry.register(AlkostoSource())
