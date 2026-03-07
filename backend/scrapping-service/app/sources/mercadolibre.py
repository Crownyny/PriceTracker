"""Fuente: MercadoLibre Colombia.

Extrae campos de páginas de producto de MercadoLibre usando BeautifulSoup.
Los selectores están ajustados a la estructura del DOM actual (marzo 2026).
Si MercadoLibre cambia su HTML, ajustar los selectores en extract_raw_fields.

Páginas soportadas:
  - Páginas de producto: mercadolibre.com.co/MLU-...
  - Páginas de resultado: listado.mercadolibre.com.co/<query>
"""
from typing import Any, Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from .base import BaseSource
from .registry import registry


class MercadoLibreSource(BaseSource):

    @property
    def source_name(self) -> str:
        return "mercadolibre"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Esperar el título antes de extraer — confirma que JS terminó de renderizar
        return "h1.ui-pdp-title, h1.poly-box"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://listado.mercadolibre.com.co/{quote_plus(query)}"

    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        soup = BeautifulSoup(html_content, "lxml")
        return {
            "raw_title":        self._title(soup),
            "raw_price":        self._price(soup),
            "raw_currency":     self._currency(soup),
            "raw_availability": self._availability(soup),
            "raw_category":     self._category(soup),
            "raw_image_url":    self._image(soup),
            "raw_description":  self._description(soup),
        }

    # ── Extractores individuales ──────────────────────────────────────────────

    def _title(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in ["h1.ui-pdp-title", "h1.poly-box", "h1"]:
            el = soup.select_one(sel)
            if el:
                return el.get_text(strip=True)
        return None

    def _price(self, soup: BeautifulSoup) -> Optional[str]:
        # MercadoLibre separa enteros y centavos en spans distintos
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

    def _currency(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("span.andes-money-amount__currency-symbol")
        symbol = el.get_text(strip=True) if el else None
        # Mapeo de símbolo a código ISO
        _MAP = {"$": "COP", "US$": "USD", "R$": "BRL", "€": "EUR"}
        return _MAP.get(symbol, symbol) if symbol else "COP"

    def _availability(self, soup: BeautifulSoup) -> Optional[str]:
        # Botón de compra presente → disponible
        buy_btn = soup.select_one(
            "form.ui-pdp-action-modal-trigger button, "
            "button.ui-pdp-action--primary"
        )
        if buy_btn:
            return "available"
        out = soup.find(string=lambda t: t and "sin stock" in t.lower())
        return "out_of_stock" if out else None

    def _category(self, soup: BeautifulSoup) -> Optional[str]:
        # Último breadcrumb = categoría más específica
        crumbs = soup.select("nav.andes-breadcrumb__item a, ol.andes-breadcrumb li a")
        return crumbs[-1].get_text(strip=True) if crumbs else None

    def _image(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in [
            "figure.ui-pdp-gallery__figure img",
            "img.ui-pdp-image",
            "img.poly-component__picture",
        ]:
            el = soup.select_one(sel)
            if el:
                return el.get("data-zoom") or el.get("src")
        return None

    def _description(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("p.ui-pdp-description__content")
        return el.get_text(" ", strip=True)[:500] if el else None


# Auto-registro al importar el módulo
registry.register(MercadoLibreSource())
