"""Fuente: Falabella Colombia.

Extrae resultados de la página de búsqueda de falabella.com.co.

Estrategia (DOM de Falabella CO — marzo 2026):
  - URL de búsqueda: /falabella-co/search?Ntt=<query>
  - wait_for_selector: `[data-pod]`  (cards renderizados por el SPA)
  - Cards: cada elemento con atributo `data-pod`
  - Título:      `b.pod-title, [class*='pod-title']`
  - Precio:      `li.prices-0 span.copy7`  (precio de venta actual)
  - Imagen:      primera `img` dentro del card
  - Disponibil.: presencia del card implica disponibilidad
  - Moneda:      siempre COP (Falabella CO solo opera en Colombia)
"""
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry


class FalabellaSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "falabella"

    @property
    def wait_for_selector(self) -> Optional[str]:
        return "[data-pod]"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.falabella.com.co/falabella-co/search?Ntt={quote_plus(query)}"

    # ── Card discovery ────────────────────────────────────────────────────────

    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        return soup.select("[data-pod]")

    # ── Extractores (BeautifulSoupSource template method) ────────────────────

    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # El `a` contenedor a veces lleva el nombre completo en el atributo `title`
        link = card.select_one("a[title]")
        if link:
            t = link.get("title", "").strip()
            if t:
                return t

        # Fallback: combinar marca (pod-title) + modelo (pod-subTitle)
        parts = []
        for sel in ["b.pod-title", "[class*='pod-title']"]:
            el = card.select_one(sel)
            if el:
                parts.append(el.get_text(strip=True))
                break
        for sel in ["b.pod-subTitle", "[class*='pod-subTitle']", "[class*='pod-subtitle']"]:
            el = card.select_one(sel)
            if el:
                parts.append(el.get_text(strip=True))
                break
        if parts:
            return " ".join(parts)
        return None

    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # li.prices-0 = precio normal/oferta; span.copy7 = monto
        for sel in [
            "li.prices-0 span.copy7",
            "li.prices-0",
            "[class*='prices-0']",
            "[class*='price']",
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
        # Si el card está en el DOM → producto disponible para ver
        agotado = card.find(string=lambda t: t and "agotado" in t.lower())
        return "out_of_stock" if agotado else "available"

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        crumbs = soup.select("ol.breadcrumb a, nav[aria-label*='breadcrumb'] a")
        meaningful = [
            c.get_text(strip=True) for c in crumbs
            if c.get_text(strip=True).lower() not in {"inicio", "home", "falabella"}
        ]
        return meaningful[-1] if meaningful else None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        for sel in ["picture img", "img[src*='falabella']", "img[src*='sodimac']", "img"]:
            el = card.select_one(sel)
            if el:
                return el.get("src") or el.get("data-src")
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        # Falabella muestra specs clave en una lista de features dentro del card
        for sel in ["[class*='pod-features']", "[class*='pod-details']", "ul.pod-features"]:
            el = card.select_one(sel)
            if el:
                items = [li.get_text(strip=True) for li in el.select("li") if li.get_text(strip=True)]
                if items:
                    return " | ".join(items[:5])  # máx 5 características
                # Si no hay <li>, usar el texto directo
                t = el.get_text(" ", strip=True)[:500]
                if t:
                    return t
        return None


registry.register(FalabellaSource())
