"""Fuente: AliExpress (global, interfaz en español para Colombia).

Estrategia (DOM confirmado por inspección — marzo 2026):
  AliExpress renderiza los resultados de búsqueda en un SPA con SSR parcial.
  60 cards por página en el selector `.search-item-card-wrapper-gallery`.

  - URL de búsqueda: /w/wholesale-<query-con-guiones>.html
  - wait_for_selector: ".search-item-card-wrapper-gallery"
  - Título:  h3 dentro del card (texto directo)
  - Precio:  div[tabindex="0"][aria-label^="$"] → el aria-label contiene
             el precio formateado, ej: "$1.755.236"
  - Imagen:  primer img[src^="//"] → URL protocol-relative, se prefija https:
  - Link:    a[href*="/item/"] → URL protocol-relative, se prefija https:,
             se eliminan los query params de tracking de Algolia
  - Moneda:  USD (precio en dólares por defecto); si la URL indica COP se
             puede detectar por el prefijo "$" pero AliExpress suele usar USD.
             Se guarda como USD para que el normalizador lo convierta.
"""
from typing import Optional
from urllib.parse import quote_plus, urlparse, urlunparse

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

_BASE_URL = "https://www.aliexpress.com"


class AliexpressSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "aliexpress"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return ".search-item-card-wrapper-gallery"

    def build_url(self, query: str, product_ref: str) -> str:
        slug = quote_plus(query).replace("+", "-")
        return f"{_BASE_URL}/w/wholesale-{slug}.html"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select(".search-item-card-wrapper-gallery")

    # ── Extractores ───────────────────────────────────────────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        el = card.select_one("h3")
        return el.get_text(strip=True) if el else None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # El precio está en el atributo aria-label del contenedor de precio
        # que empieza con el símbolo de moneda
        for el in card.select("div[tabindex='0'][aria-label]"):
            label = el.get("aria-label", "").strip()
            if label and (label[0] in ("$", "€", "£", "¥") or label[:2] in ("US", "CO")):
                return label
        return None

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for el in card.select("div[tabindex='0'][aria-label]"):
            label = el.get("aria-label", "").strip()
            if label.startswith("US$"):
                return "USD"
            if label.startswith("$"):
                return "USD"
        return "USD"

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for img in card.select("img[src]"):
            src = img.get("src", "")
            if src.startswith("//"):
                return f"https:{src}"
            if src.startswith("http") and "alicdn" in src or "aliexpress-media" in src:
                return src
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        return None

    def _extract_url(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        a = card.select_one("a[href*='/item/']")
        if not a:
            return None
        href = a.get("href", "")
        # Normalizar URL protocol-relative y eliminar tracking params
        if href.startswith("//"):
            href = f"https:{href}"
        parsed = urlparse(href)
        # Conservar solo el path limpio (sin query string de tracking)
        clean = urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))
        return clean


registry.register(AliexpressSource())
