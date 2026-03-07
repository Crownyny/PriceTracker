"""Fuente: Amazon.

Extrae campos de páginas de producto de Amazon usando BeautifulSoup.
Soporta amazon.com, amazon.com.co y otros dominios regionales.

Nota: Amazon usa anti-scraping agresivo. Playwright con user-agent real
y viewport realista mejora significativamente la tasa de éxito.
"""
from typing import Any, Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from .base import BaseSource
from .registry import registry


class AmazonSource(BaseSource):

    @property
    def source_name(self) -> str:
        return "amazon"

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "#productTitle"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.amazon.com/s?k={quote_plus(query)}"

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
        el = soup.select_one("#productTitle, #title")
        return el.get_text(strip=True) if el else None

    def _price(self, soup: BeautifulSoup) -> Optional[str]:
        # Intentar múltiples selectores — Amazon varía por país/tipo de producto
        for sel in [
            ".a-price .a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            "span.a-price-whole",
        ]:
            el = soup.select_one(sel)
            if el:
                text = el.get_text(strip=True)
                if text:
                    return text
        return None

    def _currency(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("span.a-price-symbol")
        symbol = el.get_text(strip=True) if el else None
        _MAP = {"$": "USD", "€": "EUR", "£": "GBP", "₹": "INR"}
        return _MAP.get(symbol, symbol) if symbol else "USD"

    def _availability(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("#availability span, #availability")
        if not el:
            return None
        text = el.get_text(strip=True).lower()
        if "in stock" in text or "en stock" in text:
            return "available"
        if "out of stock" in text or "agotado" in text:
            return "out_of_stock"
        return text[:50] if text else None

    def _category(self, soup: BeautifulSoup) -> Optional[str]:
        crumbs = soup.select(
            "#wayfinding-breadcrumbs_feature_div li a, "
            "ul.a-breadcrumb li a"
        )
        return crumbs[-1].get_text(strip=True) if crumbs else None

    def _image(self, soup: BeautifulSoup) -> Optional[str]:
        for sel in ["#landingImage", "#imgTagWrapperId img", "#main-image"]:
            el = soup.select_one(sel)
            if el:
                # data-old-hires tiene la imagen de mayor resolución
                return el.get("data-old-hires") or el.get("src")
        return None

    def _description(self, soup: BeautifulSoup) -> Optional[str]:
        el = soup.select_one("#productDescription p, #feature-bullets")
        return el.get_text(" ", strip=True)[:500] if el else None


# Auto-registro al importar el módulo
registry.register(AmazonSource())
