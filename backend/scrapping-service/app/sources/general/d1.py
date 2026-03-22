"""Fuente: D1 Colombia (domicilios.tiendasd1.com).

D1 es una cadena de tiendas de descuento colombiana. No posee tienda online
propia, pero su plataforma de domicilios (Instaleap/Next.js con SSR) expone
los productos de catálogo con precio.

Estrategia (Next.js SSR + Instaleap — marzo 2026):
  - Dominio:          domicilios.tiendasd1.com
  - URL de búsqueda:  /search?name=<query>  (parámetro "name", no "q")
  - wait_for_selector: [class*='product-wrapper']
  - Cards:            [class*='product-wrapper']
  - Título:           img.ant-image-img[alt]   (alt del producto = nombre limpio)
  - Precio:           p[class*='base__price']   o  [data-testid*='card-base-price']
  - Imagen:           img.ant-image-img[src]
  - URL:              a.containerCard[href]  →  prefijo https://domicilios.tiendasd1.com
  - Moneda:           COP
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from ..base import BeautifulSoupSource
from ..registry import registry

_BASE = "https://domicilios.tiendasd1.com"


class D1Source(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "d1"

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "[class*='product-wrapper']"

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE}/search?name={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select("[class*='product-wrapper']")

    # ── Extractores ──────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # La imagen lleva el nombre del producto como alt (texto limpio en mayúsculas)
        img = card.select_one("img.ant-image-img")
        if img:
            alt = img.get("alt", "").strip()
            if alt:
                return alt.title()  # LECHE LATTI → Leche Latti
        # Fallback: cualquier elemento con clase *name*
        for sel in ["[class*='product-name']", "[class*='ProductName']", "p[class*='name']"]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t:
                    return t
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Selector primario: p con clase base__price (CardBasePrice) o data-testid
        for sel in [
            "p[class*='base__price']",
            "[data-testid*='card-base-price']",
            "[class*='CardBasePrice']",
            "[class*='price']",
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
        sold_out = card.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if sold_out else "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        img = card.select_one("img.ant-image-img")
        if not img:
            img = card.select_one("img[src]")
        if img:
            src = str(img.get("src", "")).strip()
            if src.startswith("http"):
                return src
            if src.startswith("//"):
                return f"https:{src}"
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a.containerCard")
        if not a:
            a = card.select_one("a[href]")
        if a:
            href = str(a.get("href", "")).strip()
            if href.startswith("http"):
                return href
            if href:
                return f"{_BASE}{href}"
        return None


registry.register(D1Source())
