"""Fuente: Lenovo Colombia.

Estrategia (DOM estimado — marzo 2026):
  Lenovo tiene un sitio web oficial con productos de computadoras y laptops.
  Asumiendo estructura típica de sitio corporativo con productos.

  - URL de búsqueda: /search?text=<query>
  - wait_for_selector: ".product-card, .product-item, [class*='product']"
  - Cards: .product-card, .product-item, [class*='product']
  - Título: .product-title, .product-name, h3, h4
  - Precio: .product-price, .price, [class*='price']
  - Imagen: img.product-image, img[src]
  - URL: a.product-link, a[href]
  - Moneda: COP
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from ..base import BeautifulSoupSource
from ..registry import registry

_BASE_URL = "https://www.lenovo.com/co/es"


class LenovoSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "lenovo"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return ".product-card, .product-item, [class*='product']"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE_URL}/search?text={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        # Buscar productos con varios selectores posibles
        selectors = [
            ".product-card",
            ".product-item",
            "[class*='product']",
            ".search-result-item",
        ]
        for selector in selectors:
            cards = soup.select(selector)
            if cards:
                return cards
        return []

    # ── Extractores ───────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        selectors = [
            ".product-title",
            ".product-name",
            "h3",
            "h4",
            "[class*='title']",
            ".card-title",
        ]
        for selector in selectors:
            el = card.select_one(selector)
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        selectors = [
            ".product-price",
            ".price",
            "[class*='price']",
            ".current-price",
            ".sale-price",
        ]
        for selector in selectors:
            el = card.select_one(selector)
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Buscar indicadores de disponibilidad
        if card.select_one("[class*='out-of-stock'], [class*='unavailable'], [class*='sold-out']"):
            return "unavailable"
        return "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "Computadoras"

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        img = card.select_one("img.product-image, img.card-image, img[src]")
        if not img:
            return None
        src = img.get("src", "") or img.get("data-src", "")
        if src.startswith("http"):
            return src
        return f"{_BASE_URL}{src}" if src else None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Intentar extraer modelo o descripción breve
        desc_selectors = [
            ".product-description",
            ".product-model",
            ".card-subtitle",
            "[class*='description']",
        ]
        for selector in desc_selectors:
            el = card.select_one(selector)
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a.product-link, a.card-link, a[href]")
        if a:
            href = a.get("href", "")
            return href if href.startswith("http") else f"{_BASE_URL}{href}"
        return None


registry.register(LenovoSource())