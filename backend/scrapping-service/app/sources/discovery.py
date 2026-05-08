"""Cliente de descubrimiento de URLs via SearXNG.

SearXNG es un metabuscador open-source auto-hosteable que agrega resultados
de Google, Bing, DuckDuckGo, etc. Se usa como capa de discovery para encontrar
URLs de producto en e-commerces reales sin depender de APIs de pago.

Estrategia de búsqueda (dos pases sobre categoría general):
  1. Pase 1: "{query}" — resultados amplios, muchos e-commerce aparecen naturalmente.
  2. Pase 2: "comprar {query}" — sesga hacia páginas de producto/tienda.
  3. Combina, filtra dominios no-ecommerce, deduplica por dominio.

Se evita la categoría "shopping" porque Google/Bing Shopping están
con frecuencia bloqueados o no disponibles en instancias self-hosted.

Variables de entorno:
    SEARXNG_URL: URL base del servicio SearXNG (ej: http://searxng:8080)
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Dominios que NO son e-commerce — filtrar siempre
_EXCLUDED_DOMAINS = frozenset([
    "youtube.com", "reddit.com", "wikipedia.org", "twitter.com",
    "facebook.com", "instagram.com", "tiktok.com", "pinterest.com",
    "gsmarena.com", "cnet.com", "techradar.com", "tomsguide.com",
    "xda-developers.com", "9to5mac.com", "macrumors.com", "apple.com",
    "support.apple.com", "zhihu.com", "quora.com", "medium.com",
    "blogspot.com", "wordpress.com", "linkedin.com", "x.com",
])

# Dominios conocidos de e-commerce — siempre aceptar aunque no haya señal en la URL
_ECOMMERCE_DOMAINS = frozenset([
    "amazon.com", "amazon.com.co", "amazon.com.mx", "amazon.com.br",
    "amazon.es", "amazon.co.uk", "amazon.de",
    "mercadolibre.com.co", "mercadolibre.com.mx", "mercadolibre.com.ar",
    "mercadolibre.com.br", "mercadolibre.com",
    "exito.com", "falabella.com.co", "alkosto.com", "linio.com.co",
    "ktronix.com", "homecenter.com.co", "jumbo.com.co",
    "pccomponentes.com", "mediamarkt.es", "elcorteingles.es",
    "walmart.com", "bestbuy.com", "ebay.com",
])

# Señales en la ruta de URL que indican página de producto
_PRODUCT_PATH_SIGNALS = [
    "/dp/", "/product/", "/p/", "/item/", "/articulo/", "/producto/",
    "/MLU", "/MLA", "/MCO", "/MLC", "/MLB",  # IDs de MercadoLibre
    "/comprar/",
]


class SearXNGDiscovery:
    """
    Descubre URLs de producto en e-commerces usando SearXNG.
    Usa dos búsquedas sobre la categoría general para mayor cobertura.
    """

    def __init__(self, base_url: str, timeout: float = 15.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def discover(
        self,
        query: str,
        max_results: int = 10,
        deduplicate_by_domain: bool = True,
    ) -> list[str]:
        """
        Busca en SearXNG y retorna URLs de e-commerce.
        Combina dos pases: búsqueda directa + búsqueda orientada a compra.
        """
        # Pase 1: query exacta
        urls_direct = await self._search(query)

        # Pase 2: query orientada a compra ("comprar iphone 15")
        urls_buy = await self._search(f"comprar {query}")

        # Combinar sin duplicados (pase 1 tiene prioridad)
        combined = urls_direct + [u for u in urls_buy if u not in urls_direct]
        logger.info(
            "SearXNG: '%s' → %d directos + %d compra = %d combinados",
            query, len(urls_direct), len(urls_buy), len(combined),
        )

        # Filtrar: solo e-commerces conocidos o URLs con señal de producto
        ecommerce_urls = [u for u in combined if self._is_ecommerce(u)]

        # Deduplicar por dominio
        if deduplicate_by_domain:
            ecommerce_urls = self._deduplicate_by_domain(ecommerce_urls)

        logger.info(
            "SearXNG discovery: '%s' → %d URLs de e-commerce encontradas",
            query, len(ecommerce_urls),
        )
        return ecommerce_urls[:max_results]

    async def _search(self, query: str) -> list[str]:
        """Ejecuta una búsqueda general en SearXNG y retorna las URLs."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._base_url}/search",
                    params={
                        "q": query,
                        "format": "json",
                        "categories": "general",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("SearXNG no disponible (%s): %s", self._base_url, exc)
            return []

        return [r["url"] for r in data.get("results", []) if r.get("url")]

    def _is_ecommerce(self, url: str) -> bool:
        """Determina si una URL pertenece a un e-commerce."""
        domain = self._base_domain(url)

        # Excluir dominios explícitamente no-ecommerce
        if any(excl in domain for excl in _EXCLUDED_DOMAINS):
            return False

        # Aceptar dominios de e-commerce conocidos
        if any(ecom in domain for ecom in _ECOMMERCE_DOMAINS):
            return True

        # Aceptar URLs con señal de página de producto en la ruta
        if any(signal in url for signal in _PRODUCT_PATH_SIGNALS):
            return True

        return False

    def _deduplicate_by_domain(self, urls: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for url in urls:
            domain = self._base_domain(url)
            if domain not in seen:
                seen.add(domain)
                result.append(url)
        return result

    @staticmethod
    def _base_domain(url: str) -> str:
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc.lower().removeprefix("www.")
        except Exception:
            return url
