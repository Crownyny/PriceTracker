"""Fuente: Éxito Colombia.

Extrae campos de páginas de producto de exito.com usando BeautifulSoup.
Éxito usa una SPA (React) — Playwright es necesario para renderizar el precio.

Soporta páginas de producto tipo:
  https://www.exito.com/producto/<slug>/<id>/p
"""
from typing import Any, Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from .base import BaseSource
from .registry import registry


class ExitoSource(BaseSource):

    @property
    def source_name(self) -> str:
        return "exito"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Éxito es una SPA — esperar el precio antes de extraer
        return "span[class*='ProductPrice'], h1[class*='ProductName']"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.exito.com/s?q={quote_plus(query)}"

    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        soup = BeautifulSoup(html_content, "lxml")
        return {
            "raw_title":        self._title(soup),
            "raw_price":        self._price(soup),
            "raw_currency":     "COP",
            "raw_availability": self._availability(soup),
            "raw_category":     self._category(soup),
            "raw_image_url":    self._image(soup),
            "raw_description":  self._description(soup),
        }

    # ── Extractores individuales ──────────────────────────────────────────────

    def _title(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in [
            "h1[class*='ProductName']",
            "h1[class*='product-name']",
            "span[class*='ProductName']",
            "h1",
        ]:
            el = soup.select_one(sel)
            if el:
                return el.get_text(strip=True)
        return None

    def _price(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in [
            "span[class*='ProductPrice']",
            "span[class*='product-price']",
            "[data-testid='price-value']",
            "span[class*='Price']",
        ]:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(strip=True)
                if text and any(c.isdigit() for c in text):
                    return text
        return None

    def _availability(self, soup: BeautifulSoup) -> Optional[str]:
        btn = soup.select_one(
            "button[class*='add-to-cart'], "
            "button[class*='AddToCart'], "
            "[data-testid='add-to-cart']"
        )
        if btn and not btn.get("disabled"):
            return "available"
        out = soup.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if out else None

    def _category(self, soup: BeautifulSoup) -> Optional[str]:
        crumbs = soup.select("[class*='Breadcrumb'] a, nav[aria-label*='breadcrumb'] a")
        return crumbs[-1].get_text(strip=True) if crumbs else None

    def _image(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in [
            "img[class*='product-image']",
            "img[class*='ProductImage']",
            "[data-testid='product-image'] img",
            "img[class*='vtex']",
        ]:
            el = soup.select_one(sel)
            if el:
                return el.get("src")
        return None

    def _description(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in ["[class*='ProductDescription']", "[class*='product-description']"]:
            el = soup.select_one(sel)
            if el:
                return el.get_text(" ", strip=True)[:500]
        return None


# Auto-registro al importar el módulo
registry.register(ExitoSource())
