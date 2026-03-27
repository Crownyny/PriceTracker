"""Fuente: Enjoy Video Games Colombia.

Estrategia (DOM estimado — marzo 2026):
  Enjoy Video Games es una tienda especializada en videojuegos y accesorios gaming.
  Asumiendo estructura típica de tienda WooCommerce/e-commerce.

  - URL de búsqueda: /?s=<query>&post_type=product
  - wait_for_selector: ".product, .products li, [class*='product']"
  - Cards: .product, .products li, [class*='product']
  - Título: .woocommerce-loop-product__title, h2.product-title, [class*='title']
  - Precio: .price, .woocommerce-Price-amount, [class*='price']
  - Imagen: img.attachment-woocommerce_thumbnail, img[src]
  - URL: a.woocommerce-loop-product__link, a[href]
  - Moneda: COP
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from ..base import BeautifulSoupSource
from ..registry import registry

_BASE_URL = "https://enjoyvideogames.com.co"


class EnjoyVideoGamesSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "enjoyvideogames"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return ".product, .products li, [class*='product']"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE_URL}/?s={quote_plus(query)}&post_type=product"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        # Buscar productos con varios selectores posibles
        selectors = [
            ".product",
            ".products li",
            "[class*='product']",
            ".woocommerce-loop-product__link",
        ]
        for selector in selectors:
            cards = soup.select(selector)
            if cards:
                return cards
        return []

    # ── Extractores ───────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        selectors = [
            ".woocommerce-loop-product__title",
            "h2.product-title",
            "[class*='title']",
            "h3",
            "h2",
        ]
        for selector in selectors:
            el = card.select_one(selector)
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Buscar precio actual (no tachado) en WooCommerce
        # Primero intentar precio sin descuento (último elemento .woocommerce-Price-amount)
        price_elements = card.select(".woocommerce-Price-amount")
        if price_elements:
            # Tomar el último elemento (precio actual)
            price_text = price_elements[-1].get_text(strip=True)
            if price_text:
                return price_text

        # Si no hay .woocommerce-Price-amount, buscar en .price
        price_el = card.select_one(".price")
        if price_el:
            # Buscar el precio que no esté tachado
            # WooCommerce a veces usa <del> para precios antiguos
            del_elements = price_el.select("del")
            if del_elements:
                # Si hay elementos tachados, buscar el precio que no esté en del
                for amount in price_el.select(".woocommerce-Price-amount, .amount"):
                    if not amount.find_parent("del"):
                        return amount.get_text(strip=True)

            # Si no hay elementos tachados, tomar el primer precio
            amount = price_el.select_one(".woocommerce-Price-amount, .amount")
            if amount:
                return amount.get_text(strip=True)

            # Último recurso: todo el texto pero limpiando
            price_text = price_el.get_text(strip=True)
            # Intentar extraer solo el precio actual (último precio en el texto)
            import re
            prices = re.findall(r'\$[\d\.,]+', price_text)
            if prices:
                return prices[-1]  # Último precio encontrado

        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "COP"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Buscar indicadores de disponibilidad
        if card.select_one("[class*='out-of-stock'], [class*='unavailable']"):
            return "unavailable"
        return "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "Videojuegos"

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        img = card.select_one("img.attachment-woocommerce_thumbnail, img[src]")
        if not img:
            return None
        src = img.get("src", "") or img.get("data-src", "")
        if src.startswith("http"):
            return src
        return f"{_BASE_URL}{src}" if src else None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Intentar extraer marca o descripción breve
        brand_selectors = [
            "[class*='brand']",
            ".product-brand",
            ".marca",
        ]
        for selector in brand_selectors:
            el = card.select_one(selector)
            if el:
                return el.get_text(strip=True)
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a.woocommerce-loop-product__link, a[href]")
        if a:
            href = a.get("href", "")
            return href if href.startswith("http") else f"{_BASE_URL}{href}"
        return None


registry.register(EnjoyVideoGamesSource())