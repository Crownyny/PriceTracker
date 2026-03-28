"""Fuente: Alkomprar Colombia.

Estrategia (marzo 2026):
  Alkomprar usa Algolia InstantSearch para renderizar resultados. El SPA no
  renderiza en Playwright headless (las llamadas a *.algolia.net no se
  ejecutan por restricciones del entorno). En cambio, las credenciales de
  Algolia están embebidas públicamente en el HTML de la página:

    applicationId : QX5IPS1B1Q
    apiKey        : 7a8800d62203ee3a9ff1cdf74f99b268 (search-only key)
    index         : alkomprarIndexAlgoliaPRD

  Se hace un POST directo a la API de Algolia con httpx (síncrono) ignorando
  el html_content que Playwright entrega (que solo contiene el shell del SPA).

  URL canónica: https://www.alkomprar.com/search?q=<query>  (raw_url)
  API Algolia : POST https://QX5IPS1B1Q-dsn.algolia.net/1/indexes/alkomprarIndexAlgoliaPRD/query

  Campos clave del hit Algolia:
    name_text_es            → título del producto
    lowestprice_double      → precio mínimo (oferta), float
    pricevalue_cop_double   → precio regular, float
    url_es_string           → URL relativa del PDP, e.g. /celular…/p/EAN
    img-310wx310h_string    → imagen 310×310, relativa
    brand_string_mv         → lista con la marca, e.g. ["SAMSUNG"]
    categoryName_text_es_mv → lista de categorías
    instockflag_boolean     → True/False
"""
import logging
from typing import Any, Optional
from urllib.parse import parse_qs, quote_plus, urlparse

import httpx

from shared.model import ScrapingJob

from ..base import BaseSource
from ..registry import registry

logger = logging.getLogger(__name__)

_BASE_URL   = "https://www.alkomprar.com"
_APP_ID     = "QX5IPS1B1Q"
_API_KEY    = "7a8800d62203ee3a9ff1cdf74f99b268"
_INDEX      = "alkomprarIndexAlgoliaPRD"
_ALGOLIA_URL = f"https://{_APP_ID}-dsn.algolia.net/1/indexes/{_INDEX}/query"
_ALGOLIA_HEADERS = {
    "X-Algolia-API-Key": _API_KEY,
    "X-Algolia-Application-Id": _APP_ID,
    "Content-Type": "application/json",
}
_HITS_PER_PAGE = 40


class AlkomprarSource(BaseSource):
    """
    Fuente Alkomprar usando la API pública de Algolia (search-only key).
    No usa Playwright para obtener los productos; hace la llamada REST directa.
    """

    @property
    def source_name(self) -> str:
        return "alkomprar"

    @property
    def wait_for_selector(self) -> Optional[str]:
        # No se necesita esperar nada; extract_all_results ignora el HTML.
        return None

    @property
    def scroll_before_extract(self) -> bool:
        return False

    def build_url(self, query: str, product_ref: str) -> str:
        """URL canónica de búsqueda en Alkomprar (usada como raw_url)."""
        return f"{_BASE_URL}/search?q={quote_plus(query)}"

    # ── Extracción principal ──────────────────────────────────────────────────

    def extract_all_results(
        self, html_content: str, job: ScrapingJob
    ) -> list[dict[str, Any]]:
        """
        Ignora html_content (SPA no renderiza en headless).
        Extrae la query de job.source_url y llama directamente a Algolia.
        """
        # Recuperar la query desde la URL del job
        parsed = urlparse(job.source_url)
        query_params = parse_qs(parsed.query)
        query = query_params.get("q", query_params.get("text", [""]))[0]

        if not query:
            logger.warning("[alkomprar] No se pudo extraer query de %s", job.source_url)
            return []

        payload = {
            "query": query,
            "hitsPerPage": _HITS_PER_PAGE,
            "attributesToRetrieve": [
                "name_text_es",
                "lowestprice_double",
                "pricevalue_cop_double",
                "url_es_string",
                "img-310wx310h_string",
                "img-155wx155h_string",
                "brand_string_mv",
                "categoryName_text_es_mv",
                "instockflag_boolean",
                "stocklevelstatus_string",
            ],
        }

        try:
            with httpx.Client(timeout=15) as client:
                resp = client.post(_ALGOLIA_URL, headers=_ALGOLIA_HEADERS, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            logger.error("[alkomprar] Error llamando Algolia: %s", exc)
            return []

        hits = data.get("hits", [])
        logger.info("[alkomprar] %d hits de Algolia para '%s'", len(hits), query)

        results = []
        for hit in hits:
            fields = self._hit_to_fields(hit)
            if fields.get("raw_title") or fields.get("raw_price"):
                results.append(fields)

        return results

    # ── Mapeo de campos Algolia → raw_fields ─────────────────────────────────

    def _hit_to_fields(self, hit: dict) -> dict[str, Any]:
        # Título
        title: Optional[str] = hit.get("name_text_es")

        # Precio: preferir lowestprice (oferta), caer en pricevalue (regular)
        raw_price: Optional[str] = None
        price_val = hit.get("lowestprice_double") or hit.get("pricevalue_cop_double")
        if price_val is not None:
            # Formatear como entero si es un float sin decimales
            raw_price = str(int(price_val)) if float(price_val) == int(price_val) else str(price_val)

        # Imagen (relativa → absoluta)
        image_url: Optional[str] = None
        img_path = hit.get("img-310wx310h_string") or hit.get("img-155wx155h_string")
        if img_path:
            image_url = img_path if img_path.startswith("http") else f"{_BASE_URL}{img_path}"

        # URL del producto (relativa → absoluta)
        raw_url: Optional[str] = None
        url_path = hit.get("url_es_string")
        if url_path:
            raw_url = url_path if url_path.startswith("http") else f"{_BASE_URL}{url_path}"

        # Marca → descripción (short)
        brand_list = hit.get("brand_string_mv") or []
        brand = brand_list[0] if brand_list else None

        # Categoría más específica (último elemento de la lista)
        cat_list = hit.get("categoryName_text_es_mv") or []
        category = cat_list[-1] if cat_list else None

        # Disponibilidad
        in_stock = hit.get("instockflag_boolean", True)
        availability = "available" if in_stock else "out_of_stock"

        return {
            "raw_title":        title,
            "raw_price":        raw_price,
            "raw_currency":     "COP",
            "raw_availability": availability,
            "raw_category":     category,
            "raw_image_url":    image_url,
            "raw_description":  brand,
            "raw_url":          raw_url,
        }


registry.register(AlkomprarSource())
