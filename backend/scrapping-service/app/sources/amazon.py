"""Fuente: Amazon.

Extrae el primer resultado de una página de búsqueda de Amazon usando
BeautifulSoup sobre el HTML renderizado por Playwright (Chromium headless).

Flujo:
  build_url() → /s?k=<query>  (página de resultados de búsqueda)
  Playwright espera `div.s-main-slot` (contenedor principal de resultados).
  Los extractores localizan el PRIMER resultado orgánico con data-asin
  y extraen su título, precio, imagen, etc.

Nota: Amazon usa anti-scraping agresivo; Playwright con user-agent real
y viewport realista mejora significativamente la tasa de éxito.
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

# Mapeo símbolo → código ISO 4217
_CURRENCY_SYMBOLS: dict[str, str] = {
    "US$": "USD",
    "$":   "USD",
    "€":  "EUR",
    "£":  "GBP",
    "₹":  "INR",
}


class AmazonSource(BeautifulSoupSource):
    """
    Fuente Amazon.
    Scraping sobre página de resultados (/s?k=...).
    Playwright espera div.s-main-slot antes de extraer el DOM.
    """

    @property
    def source_name(self) -> str:
        return "amazon"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # El contenedor principal de resultados de búsqueda
        return "div.s-main-slot"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.amazon.com/s?k={quote_plus(query)}"

    # ── Helper ─────────────────────────────────────────────────────────────

    def _first_result(self, soup: BeautifulSoup) -> Optional[Tag]:
        """
        Devuelve el primer resultado orgánico (con data-asin no vacío).
        Saltamos items patrocinados que no tienen ASIN real o están marcados
        como AdHolder.
        """
        for el in soup.select("[data-component-type='s-search-result']"):
            asin = el.get("data-asin", "").strip()
            # Items sin ASIN o con clase de anuncio se descartan
            if asin and "AdHolder" not in el.get("class", []):
                return el
        return None

    # ── Extractores individuales (BeautifulSoupSource template method) ────────

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        result = self._first_result(soup)
        if result:
            el = result.select_one("h2 a span, h2 span.a-text-normal")
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_price(self, soup: BeautifulSoup) -> Optional[str]:
        result = self._first_result(soup)
        if result:
            for sel in [".a-price .a-offscreen", ".a-price-whole"]:
                el = result.select_one(sel)
                if el:
                    text = el.get_text(strip=True)
                    if text:
                        return text
        return None

    def _extract_currency(self, soup: BeautifulSoup) -> Optional[str]:
        result = self._first_result(soup)
        if result:
            el = result.select_one("span.a-price-symbol")
            symbol = el.get_text(strip=True) if el else None
            if symbol:
                return _CURRENCY_SYMBOLS.get(symbol, "USD")
        return "USD"

    def _extract_availability(self, soup: BeautifulSoup) -> Optional[str]:
        # Si se renderizó al menos un resultado con ASIN → producto disponible
        return "available" if self._first_result(soup) else None

    def _extract_category(self, soup: BeautifulSoup) -> Optional[str]:
        # Departamento seleccionado en el dropdown de búsqueda
        el = soup.select_one("#searchDropdownBox option[selected]")
        return el.get_text(strip=True) if el else None

    def _extract_image(self, soup: BeautifulSoup) -> Optional[str]:
        result = self._first_result(soup)
        if result:
            el = result.select_one("img.s-image")
            if el:
                return el.get("src")
        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        result = self._first_result(soup)
        if result:
            el = result.select_one(".a-row.a-size-base.a-color-secondary")
            if el:
                return el.get_text(" ", strip=True)[:500]
        return None


# Auto-registro al importar el módulo
registry.register(AmazonSource())
