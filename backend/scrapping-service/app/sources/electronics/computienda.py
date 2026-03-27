"""Fuente: Computienda Colombia.

Computienda Colombia (computienda.com.co) opera sobre WordPress + WooCommerce.

Estrategia (DOM WooCommerce — marzo 2026):
  - URL de búsqueda: /?post_type=product&s=<query>
  - wait_for_selector: `ul.products, li.product`
  - Cards: `li.product`
  - Título:   `h2.woocommerce-loop-product__title`
  - Precio:   `.price ins .woocommerce-Price-amount bdi`  (oferta)
              `.price .woocommerce-Price-amount bdi`      (regular)
  - Imagen:   `img[data-src]`  (lazy-load)  o  `img[src]`
  - URL:      `a.woocommerce-loop-product__link[href]`
  - Categoría: `.ast-woo-product-category`
  - Moneda:   COP

Casos especiales:
  - Cuando la búsqueda devuelve 1 único resultado WooCommerce redirige
    directamente a la página del producto. Se detecta por la ausencia de
    `li.product` y se extrae desde los selectores de producto individual.
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from ..base import BeautifulSoupSource
from ..registry import registry

_BASE = "https://computienda.com.co"


class ComputiendaSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "computienda"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Espera a que aparezcan los cards de producto o el título de un único producto
        return "li.product, h1.product_title"

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        return f"{_BASE}/?post_type=product&s={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        cards = soup.select("li.product")
        if cards:
            return cards

        # Redirección a producto único: sintetizamos un Tag virtual-like
        # devolviendo el <body> completo como un solo "card" con flag especial
        body = soup.find("body")
        if body and soup.select_one("h1.product_title"):
            return [body]  # type: ignore[list-item]

        return []

    # ── Extractores ──────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Listing card
        for sel in ["h2.woocommerce-loop-product__title", ".woocommerce-loop-product__title"]:
            el = card.select_one(sel)
            if el:
                t = el.get_text(strip=True)
                if t:
                    return t
        # Single product page
        el = card.select_one("h1.product_title")
        if el:
            return el.get_text(strip=True)
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Sale price (ins) takes priority
        for sel in [
            ".price ins .woocommerce-Price-amount bdi",
            ".price ins .woocommerce-Price-amount",
            ".price .woocommerce-Price-amount bdi",
            ".price .woocommerce-Price-amount",
            ".woocommerce-Price-amount bdi",
            ".woocommerce-Price-amount",
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
        # Out of stock button is disabled
        btn = card.select_one("a.add_to_cart_button")
        if btn and "disabled" in btn.get("class", []):
            return "out_of_stock"
        if card.select_one(".out-of-stock, .stock.out-of-stock"):
            return "out_of_stock"
        return "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # In listing cards: .ast-woo-product-category
        cat = card.select_one(".ast-woo-product-category")
        if cat:
            t = cat.get_text(strip=True)
            if t:
                return t
        # Breadcrumb fallback
        crumbs = soup.select(".woocommerce-breadcrumb a, nav.breadcrumb a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower()
            not in {"inicio", "home", "tienda", "computienda"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Lazy-loaded thumbnails use data-src
        img = card.select_one(".astra-shop-thumbnail-wrap img")
        if not img:
            img = card.select_one("img.attachment-woocommerce_thumbnail")
        if not img:
            img = card.select_one(".wp-post-image, img.wp-post-image")
        if not img:
            img = card.select_one("img[data-src]")
        if not img:
            img = card.select_one("img[src]")

        if img:
            src = img.get("data-src") or img.get("src") or ""
            src = str(src).strip()
            if src and src.startswith("http"):
                return src
            # srcset fallback (pick largest or first)
            srcset = img.get("data-srcset") or img.get("srcset") or ""
            if srcset:
                first = str(srcset).split(",")[0].strip().split(" ")[0]
                if first.startswith("http"):
                    return first
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        link = card.select_one("a.woocommerce-loop-product__link")
        if link:
            href = link.get("href", "")
            if href:
                return str(href)
        # Single product page: canonical
        canonical = soup.select_one("link[rel='canonical']")
        if canonical:
            return str(canonical.get("href", ""))
        return None


registry.register(ComputiendaSource())
