"""Fuente: Seven Seven Colombia (www.sevenseven.com).

Seven Seven Colombia corre sobre Salesforce Commerce Cloud (SFCC / Demandware),
identificado por el patrón '/on/demandware.static/Sites-SevenSeven-Site/...'
en los assets y el encabezado de servidor
'bhfm-008.dx.commercecloud.salesforce.com'.

Estrategia (marzo 2026):
  - URL de búsqueda: /buscar?q=<query>
    La página es una SPA que carga los productos vía JS, por lo que se
    necesita Playwright para obtener el HTML renderizado.
  - wait_for_selector: ".js-shelf-product"
    SFCC inyecta las tarjetas de producto con la clase .js-shelf-product
    una vez que el catálogo ha sido cargado por el JS del storefront.
  - extract_all_results parsea las tarjetas con BeautifulSoup.

Estructura de las tarjetas (.js-shelf-product):
  - Nombre:   .product-name__link (o .product-name a)
  - URL:      a[href] en .product-name__link  →  relativa, se prefija con BASE
  - Precio:   .price--best .value[content]   →  contenido numérico limpio
                (ej. content="62930.00")
  - Precio original: .price--base[content]   (opcional)
  - Imagen:   primer <img> dentro del tile
"""
import logging
import re
from typing import Any, Optional
from urllib.parse import parse_qs, quote, urlparse

from bs4 import BeautifulSoup

from shared.model import ScrapingJob

from ..base import BaseSource
from ..registry import registry

logger = logging.getLogger(__name__)

_BASE = "https://www.sevenseven.com"


class SevenSevenSource(BaseSource):
    """
    Fuente Seven Seven Colombia usando Playwright + BeautifulSoup
    sobre el storefront SFCC/Demandware.
    """

    @property
    def source_name(self) -> str:
        return "sevenseven"

    @property
    def user_agent(self) -> Optional[str]:
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        )

    @property
    def wait_for_selector(self) -> Optional[str]:
        # Aparece cuando SFCC inyecta las tarjetas de producto
        return ".js-shelf-product"

    @property
    def scroll_before_extract(self) -> bool:
        return True

    def build_url(self, query: str, product_ref: str) -> str:
        # Extraer el término de búsqueda desde la URL del job si viene codificada,
        # o usar el parámetro query directamente
        return f"{_BASE}/buscar?q={quote(query, safe='')}"

    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        # Extraer query desde la source_url del job para contexto
        try:
            parsed = urlparse(job.source_url)
            query = parse_qs(parsed.query).get("q", [""])[0]
        except Exception:
            query = ""

        soup = BeautifulSoup(html_content, "lxml")

        tiles = soup.find_all(class_="js-shelf-product")
        if not tiles:
            logger.warning("[sevenseven] No se encontraron tarjetas .js-shelf-product")
            return []

        results = []
        for tile in tiles:
            try:
                # ── Nombre ──────────────────────────────────────────────────────
                name_el = (
                    tile.find(class_="product-name__link")
                    or tile.find(class_="product-name")
                )
                if name_el and name_el.name != "a":
                    name_el = name_el.find("a") or name_el
                title = name_el.get_text(strip=True) if name_el else ""
                if not title:
                    continue

                # ── URL ─────────────────────────────────────────────────────────
                href = name_el.get("href", "") if name_el else ""
                if not href:
                    link = tile.find("a", href=True)
                    href = link["href"] if link else ""
                if href and not href.startswith("http"):
                    href = _BASE + href
                # Strip color variant query param for canonical URL
                product_url = href.split("?")[0] if href else ""

                # ── Precio actual ────────────────────────────────────────────────
                # .price--best .value tiene el atributo content="NNNN.00"
                price_str: Optional[str] = None
                best_div = tile.find(class_="price--best")
                if best_div:
                    value_el = best_div.find(class_="value")
                    if value_el:
                        content = value_el.get("content")
                        if content:
                            price_str = content
                        else:
                            raw = value_el.get_text(strip=True)
                            m = re.search(r"[\d.,]+", raw.replace(".", "").replace(",", "."))
                            price_str = m.group() if m else None

                if price_str is None:
                    # Fallback: primer número en la sección de precios
                    price_section = tile.find(class_=re.compile(r"shelf-product__prices"))
                    if price_section:
                        raw = price_section.get_text(strip=True)
                        m = re.search(r"\$([\d.]+)", raw)
                        price_str = m.group(1).replace(".", "") if m else None

                # Convertir de pesos (sin decimales, separador de miles = punto)
                # "62930.00" → 62930.0
                if price_str:
                    try:
                        price_val = float(price_str)
                    except ValueError:
                        # "62.930" → quitar puntos de miles
                        price_val_clean = price_str.replace(".", "")
                        price_val = float(price_val_clean) if price_val_clean.isdigit() else None
                else:
                    price_val = None

                # ── Precio original (opcional) ───────────────────────────────────
                original_price: Optional[str] = None
                base_div = tile.find(class_="price--base")
                if base_div:
                    content = base_div.get("content")
                    if content:
                        original_price = content
                    else:
                        value_el = base_div.find(class_="value")
                        if value_el:
                            original_price = value_el.get_text(strip=True)

                # ── Imagen ───────────────────────────────────────────────────────
                img_el = tile.find("img")
                img_url = ""
                if img_el:
                    img_url = (
                        img_el.get("src")
                        or img_el.get("data-src")
                        or img_el.get("data-lazy")
                        or ""
                    )

                result: dict[str, Any] = {
                    "title": title,
                    "url": product_url or href,
                    "source": self.source_name,
                    "query": query,
                }
                if price_val is not None:
                    result["price"] = str(price_val)
                if original_price:
                    result["original_price"] = original_price
                if img_url:
                    result["image_url"] = img_url

                results.append(result)

            except Exception as exc:
                logger.debug("[sevenseven] Error procesando tarjeta: %s", exc, exc_info=True)
                continue

        logger.info("[sevenseven] %d productos extraídos para '%s'", len(results), query)
        return results


registry.register(SevenSevenSource())
