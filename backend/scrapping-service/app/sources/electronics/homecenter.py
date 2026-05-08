"""Fuente: Homecenter Colombia.

Estrategia (DOM confirmado por inspección — marzo 2026):
  Homecenter (operado por Falabella) usa un SPA Next.js con SSR parcial.
  Los cards de producto están presentes en el HTML del servidor como
  <div class="product-wrapper ..."> con 28 productos por página.

  - URL de búsqueda: /homecenter-co/search?Ntt=<query>
  - wait_for_selector: ".product-wrapper"
  - Título:  h2.product-title
  - Precio:  .parsedPrice  (texto: "$50.900")
  - Marca:   .product-brand
  - Imagen:  img.image-base  (la primera <img> es un SVG placeholder)
  - Link:    a#title-pdp-link[href]  → relativo, se prefija con base URL
  - Moneda:  siempre COP (solo opera en Colombia)
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from ..base import BeautifulSoupSource
from ..registry import registry

_BASE_URL = "https://www.homecenter.com.co"


class HomecenterSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "homecenter"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return ".product-wrapper"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE_URL}/homecenter-co/search?Ntt={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select(".product-wrapper")

    # ── Extractores ───────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("h2.product-title, [class*='product-title']")
        return el.get_text(strip=True) if el else None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one(".parsedPrice, [class*='parsedPrice']")
        if el:
            t = el.get_text(strip=True)
            if t and any(c.isdigit() for c in t):
                return t
        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        agotado = card.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if agotado else "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        crumbs = soup.select("ol.breadcrumb a, [class*='breadcrumb'] a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home", "homecenter"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # La primera img es un SVG placeholder; buscar src http sin svg
        for img in card.select("img"):
            src = img.get("src", "")
            if src.startswith("http") and "svg" not in src:
                return src
            for attr in ("data-src", "data-lazy-src", "data-original"):
                val = img.get(attr, "")
                if val and val.startswith("http"):
                    return val
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        brand = card.select_one(".product-brand, [class*='product-brand']")
        return brand.get_text(strip=True) if brand else None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a#title-pdp-link[href], a[href*='/product/']")
        if a:
            href = a.get("href", "")
            return href if href.startswith("http") else f"{_BASE_URL}{href}"
        return None


registry.register(HomecenterSource())
