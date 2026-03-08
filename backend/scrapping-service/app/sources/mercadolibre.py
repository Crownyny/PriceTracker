"""Fuente: MercadoLibre Colombia.

Extrae campos de páginas de producto/resultados de MercadoLibre usando
BeautifulSoup sobre el HTML renderizado por Playwright (Chromium headless).

Los selectores están ajustados al DOM de MercadoLibre (marzo 2026).
Si el sitio cambia su estructura, actualizar los _extract_* correspondientes.

Páginas soportadas:
  - Resultados de búsqueda: listado.mercadolibre.com.co/<query>
  - Páginas de producto:    mercadolibre.com.co/MCO-...

Playwright espera h1.ui-pdp-title para confirmar que el JS terminó de renderizar.
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

# Mapeo símbolo → código ISO 4217 para MercadoLibre
_CURRENCY_SYMBOLS: dict[str, str] = {
    "$": "COP",
    "US$": "USD",
    "R$": "BRL",
    "€": "EUR",
}


class MercadoLibreSource(BeautifulSoupSource):
    """
    Fuente MercadoLibre Colombia.
    Playwright espera h1.ui-pdp-title (página de producto) o h1.poly-box
    (listado) para garantizar que el precio dinámico esté en el DOM.
    """

    @property
    def source_name(self) -> str:
        return "mercadolibre"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Esperar el título confirma que el JS de MercadoLibre terminó de renderizar
        return "h1.ui-pdp-title, h1.poly-box"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://listado.mercadolibre.com.co/{quote_plus(query)}"

    # ── Extractores individuales (BeautifulSoupSource template method) ────────

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in ["h1.ui-pdp-title", "h1.poly-box", "h1"]:
            el = soup.select_one(sel)
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_price(self, soup: BeautifulSoup) -> Optional[str]:
        # MercadoLibre separa enteros y centavos en spans distintos;
        # alternativamente usa el meta itemprop=price para el valor canónico.
        fraction = soup.select_one(
            "span.andes-money-amount__fraction, "
            "meta[itemprop='price']"
        )
        if fraction:
            if fraction.name == "meta":
                return fraction.get("content")
            cents_el = soup.select_one("span.andes-money-amount__cents")
            cents = "." + cents_el.get_text(strip=True) if cents_el else ""
            return fraction.get_text(strip=True) + cents
        return None

    def _extract_currency(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("span.andes-money-amount__currency-symbol")
        symbol = el.get_text(strip=True) if el else None
        return _CURRENCY_SYMBOLS.get(symbol, symbol) if symbol else "COP"

    def _extract_availability(self, soup: BeautifulSoup) -> Optional[str]:
        # Página de producto: botón de compra principal
        buy_btn = soup.select_one(
            "form.ui-pdp-action-modal-trigger button, "
            "button.ui-pdp-action--primary"
        )
        if buy_btn:
            return "available"
        # Página de listado: si se renderizó al menos un card de producto → disponible
        first_card = soup.select_one(
            ".poly-card, .ui-search-result__wrapper, .ui-search-layout__item"
        )
        if first_card:
            return "available"
        out = soup.find(string=lambda t: t and "sin stock" in t.lower())
        return "out_of_stock" if out else None

    def _extract_category(self, soup: BeautifulSoup) -> Optional[str]:
        # El último breadcrumb es la categoría más específica
        crumbs = soup.select("nav.andes-breadcrumb__item a, ol.andes-breadcrumb li a")
        return crumbs[-1].get_text(strip=True) if crumbs else None

    def _extract_image(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in [
            "figure.ui-pdp-gallery__figure img",
            "img.ui-pdp-image",
            "img.poly-component__picture",
        ]:
            el = soup.select_one(sel)
            if el:
                return el.get("data-zoom") or el.get("src")
        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("p.ui-pdp-description__content")
        return el.get_text(" ", strip=True)[:500] if el else None


# Auto-registro al importar el módulo
registry.register(MercadoLibreSource())
