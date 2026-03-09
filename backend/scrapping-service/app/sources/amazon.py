"""Fuente: Amazon.

Extrae el campo más relevante de la página de resultados de búsqueda de Amazon.

Estrategia confirmada por inspección de DOM (marzo 2026):
  - Selector de título: `h2 span`  (NOT `h2 a span` — el span está directamente bajo h2).
  - Selector de precio: `.a-price .a-offscreen` dentro de `[data-component-type='s-search-result']`.
  - Amazon CO puede no mostrar precio en listado para productos principales: en ese caso
    se devuelve el primer precio disponible de cualquier resultado orgánico.
  - `wait_for_selector`: `div.s-main-slot` (contenedor principal de resultados).
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

_CURRENCY_SYMBOLS: dict[str, str] = {
    "COP": "COP",
    "US$": "USD",
    "$":   "USD",
    "€":   "EUR",
    "£":   "GBP",
    "₹":   "INR",
}


class AmazonSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "amazon"

    @property
    def user_agent(self) -> Optional[str]:
        # Amazon oculta precios y reduce resultados con UAs tipo bot.
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "div.s-main-slot"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.amazon.com/s?k={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        """Devuelve todos los resultados orgánicos (con ASIN, sin AdHolder)."""
        out = []
        for el in soup.select("[data-component-type='s-search-result']"):
            asin = el.get("data-asin", "").strip()
            if asin and "AdHolder" not in " ".join(el.get("class", [])):
                out.append(el)
        return out

    # ── Extractores (BeautifulSoupSource template method) ────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("h2 span")
        return el.get_text(strip=True) if el else None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one(".a-price .a-offscreen")
        if el:
            raw = el.get_text(strip=True)
            if raw:
                return raw
        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        symbol_el = card.select_one(".a-price-symbol, span.a-price-symbol")
        if symbol_el:
            symbol = symbol_el.get_text(strip=True)
            return _CURRENCY_SYMBOLS.get(symbol, "USD")
        offscreen = card.select_one(".a-price .a-offscreen")
        if offscreen:
            raw = offscreen.get_text(strip=True)
            for code in ("COP", "USD", "EUR", "GBP", "BRL"):
                if raw.startswith(code):
                    return code
        return "USD"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Dato de página, no de card
        el = soup.select_one("#searchDropdownBox option[selected]")
        if el:
            val = el.get_text(strip=True)
            if val.lower() not in {"all departments", "todos los departamentos"}:
                return val
        return None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        img = card.select_one("img.s-image")
        return img.get("src") if img else None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one(".a-row.a-size-base.a-color-secondary")
        if el:
            desc = el.get_text(" ", strip=True)[:500]
            if desc:
                return desc
        return None


registry.register(AmazonSource())
