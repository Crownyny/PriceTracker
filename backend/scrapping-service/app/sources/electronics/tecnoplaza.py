"""Fuente: Tecnoplaza Colombia.

Tecnoplaza Colombia (tecnoplaza.com.co) opera sobre Shopify con el tema Dawn.

Estrategia (DOM Shopify Dawn — marzo 2026):
  - URL de búsqueda: /search?q=<query>
  - wait_for_selector: `.product-card-wrapper`
  - Cards: `.product-card-wrapper`
  - Título:      `.card__heading a`  (texto del enlace)
  - Precio:      `.price-item--sale`  (oferta) o `.price-item--regular`
  - Imagen:      `img[src]`  (protocol-relative → prefijo https:)
  - URL:         `a[href]`  (relativa → prefijo https://tecnoplaza.com.co)
  - Moneda:      COP
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from ..base import BeautifulSoupSource
from ..registry import registry

_BASE = "https://tecnoplaza.com.co"


class TecnoplazaSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "tecnoplaza"

    @property
    def wait_for_selector(self) -> Optional[str]:
        return ".product-card-wrapper"

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE}/search?q={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select(".product-card-wrapper")

    # ── Extractores ──────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for sel in [".card__heading a", "h3.card__heading", ".card__heading"]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t:
                    return t
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for sel in [".price-item--sale", ".price-item--regular", ".price-item"]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t and any(c.isdigit() for c in t):
                    return t
        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        sold_out = card.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if sold_out else "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        crumbs = soup.select("nav.breadcrumb a, .breadcrumbs a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home", "tecnoplaza"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        img = card.select_one(".card__media img[src]")
        if not img:
            img = card.select_one("img[src]")
        if img:
            src = img.get("src", "").strip()
            if src:
                # Protocol-relative → prepend https:
                if src.startswith("//"):
                    return f"https:{src}"
                if src.startswith("http"):
                    return src
            # Try srcset (first entry)
            srcset = img.get("srcset", "")
            if srcset:
                first = srcset.split(",")[0].strip().split(" ")[0]
                if first.startswith("//"):
                    return f"https:{first}"
                if first.startswith("http"):
                    return first
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a[href]")
        if a:
            href = a.get("href", "").split("?")[0]  # strip tracking params
            if href.startswith("http"):
                return href
            return f"{_BASE}{href}"
        return None


registry.register(TecnoplazaSource())
