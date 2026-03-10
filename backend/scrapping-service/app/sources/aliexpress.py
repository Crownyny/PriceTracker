"""Fuente: AliExpress (global, interfaz en español para Colombia).

Estrategia (DOM confirmado por inspección — marzo 2026):
  AliExpress renderiza los resultados de búsqueda en un SPA con SSR parcial.
  60 cards por página en el selector `.search-item-card-wrapper-gallery`.

  ⚠ NOTA: AliExpress usa el sistema anti-bot Tongdun/BX (Alibaba) que incluye
  un módulo WebAssembly (`g.alicdn.com/sd/punish/…/program.wasm`) capaz de
  detectar Chromium headless a nivel de IP + fingerprinting. Esto no puede
  bypassarse con stealth de JavaScript puro. Se necesita un proxy residencial.

  Cuando el CAPTCHA es detectado, extract_all_results devuelve [] y emite
  un WARNING claro. El resto de fuentes sigue funcionando normalmente.

  - URL de búsqueda: /w/wholesale-<query-con-guiones>.html
  - wait_for_selector: ".search-item-card-wrapper-gallery"
  - Título:  h3 dentro del card
  - Precio:  div[tabindex="0"][aria-label^="$"]
  - Imagen:  primer img[src^="//"] → prefijo https:
  - Link:    a[href*="/item/"] → limpiado de tracking params
  - Moneda:  USD
"""
from typing import Any, Optional
from urllib.parse import quote_plus, urlparse, urlunparse
import logging

from bs4 import BeautifulSoup, Tag

from shared.model import ScrapingJob

from .base import BeautifulSoupSource
from .registry import registry

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.aliexpress.com"

# Texto que aparece en la página de CAPTCHA de AliExpress
_CAPTCHA_SIGNALS = (
    "Captcha Interception",
    "unusual traffic",
    "slide to verify",
    "punishTextFetch",
)


class AliexpressSource(BeautifulSoupSource):

    @property
    def source_name(self) -> str:
        return "aliexpress"

    @property
    def use_proxy(self) -> bool:
        """Requiere proxy residencial para evadir el bot-check Tongdun/BX de Alibaba."""
        return True

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        return ".search-item-card-wrapper-gallery"

    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        """Detecta el CAPTCHA de AliExpress y lo reporta con un WARNING claro."""
        if any(signal in html_content for signal in _CAPTCHA_SIGNALS):
            logger.warning(
                "[aliexpress] CAPTCHA / bot-block detectado. "
                "AliExpress bloquea scraping headless via Tongdun/BX WASM fingerprinting. "
                "Se requiere un proxy residencial para obtener resultados."
            )
            return []
        return super().extract_all_results(html_content, job)

    @property
    def extra_http_headers(self) -> dict:
        return {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-CO,es;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.google.com/",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Sec-CH-UA": '"Chromium";v="123", "Google Chrome";v="123", "Not:A-Brand";v="99"',
            "Sec-CH-UA-Mobile": "?0",
            "Sec-CH-UA-Platform": '"Linux"',
        }

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
