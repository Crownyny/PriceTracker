"""Fuente: Dafiti Colombia.

Extrae resultados de la página de búsqueda de dafiti.com.co.

Estrategia (DOM de Dafiti CO — marzo 2026):
  - URL de búsqueda: /catalogsearch/result/?q=<query>
  - wait_for_selector: `li[class*='card-content']`
  - Cards: `li[class*='card-content']` (~48 por página)
  - Título:      `a.itm-link[title]` (atributo title del enlace)
  - Precio:      `.specialPriceText` (oferta) o `.price` (precio normal)
  - Imagen:      `data-src-default` attr en el <li> card (lazy-load)
  - URL:         `a.itm-link[href]`
  - Moneda:      COP
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from .base import BeautifulSoupSource
from .registry import registry

_BASE = "https://www.dafiti.com.co"


class DafitiSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "dafiti"

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "li[class*='card-content']"

    @property
    def scroll_before_extract(self) -> bool:
        return True

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE}/catalogsearch/result/?q={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select("li[class*='card-content']")

    # ── Extractores ──────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # El atributo title del enlace contiene el nombre completo sin brand pegado
        a = card.select_one("a.itm-link[title]")
        if a:
            t = a.get("title", "").strip()
            if t:
                return t
        # Fallback: data-alt attribute on the card li
        alt = card.get("data-alt", "").strip()
        if alt:
            return alt
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Precio especial (descuento)
        for sel in [".specialPriceText", ".specialPrices", ".discount-price"]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t and any(c.isdigit() for c in t):
                    return t
        # Precio normal
        for sel in [".itm-price", ".price"]:
            el = card.select_one(sel)
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
        cats = card.get("data-categories", "").strip()
        if cats:
            # e.g. "Vestuario|Femenino|Skinny y jeggings" → last segment
            parts = [p.strip() for p in cats.split("|") if p.strip()]
            return parts[-1] if parts else None
        return None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Dafiti lazy-loads images; the real URL is in data-src-default on the <li>
        src = card.get("data-src-default", "").strip()
        if src and src.startswith("http"):
            return src
        # Fallback: img[data-src] inside the card
        img = card.select_one("img[data-src]")
        if img:
            dsc = img.get("data-src", "").strip()
            if dsc and dsc.startswith("http"):
                return dsc
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        brand_el = card.select_one(".card-description [class*='brand'], .brand-name")
        if brand_el:
            return f"Marca: {brand_el.get_text(strip=True)}"
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a.itm-link[href]")
        if a:
            href = a.get("href", "")
            return href if href.startswith("http") else f"{_BASE}{href}"
        return None


registry.register(DafitiSource())
