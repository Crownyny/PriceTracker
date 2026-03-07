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
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Mínimo de resultados de shopping antes de activar fallback a general
_MIN_SHOPPING_RESULTS = 3

# Dominios que definitivamente NO son e-commerce (filtrar de resultados)
_EXCLUDED_DOMAINS = frozenset([
    "youtube.com", "reddit.com", "wikipedia.org", "twitter.com",
    "facebook.com", "instagram.com", "tiktok.com", "pinterest.com",
    "gsmarena.com", "cnet.com", "techradar.com", "tomsguide.com",
    "xda-developers.com", "9to5mac.com", "macrumors.com",
    "apple.com", "support.apple.com", "zhihu.com", "quora.com",
    "medium.com", "blogspot.com", "wordpress.com",
])

# Señales de que una URL es de e-commerce (al menos una debe estar presente)
_ECOMMERCE_SIGNALS = [
    "/dp/", "/product/", "/p/", "/item/", "/articulo/",
    "/MLU", "/MLA", "/MCO", "/MLC", "/MLB",   # IDs de MercadoLibre
    "amazon.", "mercadolibre.", "exito.com", "falabella.", "alkosto.",
    "linio.", "ktronix.", "homecenter.", "jumbo.", "tiendasjumbo.",
]


class SearXNGDiscovery:
    """
    Descubre URLs de producto en e-commerces usando SearXNG como intermediario.
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
        Estrategia: shopping → si insuficiente, fallback a general.
        """
        # 1. Intentar con shopping
        shopping_urls = await self._search(query, category="shopping")
        logger.info("SearXNG shopping: %d resultados para '%s'", len(shopping_urls), query)

        # 2. Fallback a general si shopping no trajo suficiente
        general_urls: list[str] = []
        if len(shopping_urls) < _MIN_SHOPPING_RESULTS:
            # Enriquecer query con términos de compra para sesgar hacia e-commerce
            enriched_query = f"comprar {query} precio"
            general_urls = await self._search(enriched_query, category="general")
            logger.info(
                "SearXNG general fallback: %d resultados para '%s'",
                len(general_urls), enriched_query,
            )

        # 3. Combinar: shopping primero (más relevante), luego general
        combined = shopping_urls + [u for u in general_urls if u not in shopping_urls]

        # 4. Filtrar solo URLs con señales de e-commerce
        ecommerce_urls = self._filter_ecommerce(combined)

        # 5. Deduplicar por dominio si está habilitado
        if deduplicate_by_domain:
            ecommerce_urls = self._deduplicate_by_domain(ecommerce_urls)

        logger.info(
            "SearXNG discovery: query='%s' → %d URLs de e-commerce",
            query, len(ecommerce_urls),
        )
        return ecommerce_urls[:max_results]

    async def _search(self, query: str, category: str) -> list[str]:
        """Ejecuta una búsqueda en SearXNG y retorna las URLs de resultados."""
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._base_url}/search",
                    params={
                        "q": query,
                        "format": "json",
                        "categories": category,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error(
                "SearXNG no disponible (%s, category=%s): %s",
                self._base_url, category, exc,
            )
            return []

        return [r["url"] for r in data.get("results", []) if r.get("url")]

    def _filter_ecommerce(self, urls: list[str]) -> list[str]:
        """Conserva solo URLs con señales de ser páginas de e-commerce."""
        filtered = []
        for url in urls:
            domain = self._base_domain(url)

            # Descartar dominios excluidos explícitamente
            if any(excl in domain for excl in _EXCLUDED_DOMAINS):
                continue

            # Aceptar si tiene señal de e-commerce en URL o dominio
            if any(signal in url for signal in _ECOMMERCE_SIGNALS):
                filtered.append(url)
                continue

            # Aceptar si el dominio termina en patrón de tienda (.com, .co, etc.)
            # y no está en la lista de excluidos — criterio permisivo para sitios nuevos
            if domain and "." in domain:
                filtered.append(url)

        return filtered

    def _deduplicate_by_domain(self, urls: list[str]) -> list[str]:
        """Retorna máximo 1 URL por dominio base."""
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
            netloc = urlparse(url).netloc.lower().removeprefix("www.")
            return netloc
        except Exception:
            return url

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Dominios que definitivamente NO son e-commerce (filtrar de resultados)
_EXCLUDED_DOMAINS = frozenset([
    "youtube.com", "reddit.com", "wikipedia.org", "twitter.com",
    "facebook.com", "instagram.com", "tiktok.com", "pinterest.com",
    "gsmarena.com", "cnet.com", "techradar.com", "tomsguide.com",
    "xda-developers.com", "9to5mac.com", "macrumors.com",
])


class SearXNGDiscovery:
    """
    Descubre URLs de producto en e-commerces usando SearXNG como intermediario.

    Estrategia:
      1. Busca en la categoría "shopping" y "general" de SearXNG.
      2. Filtra dominios que no son e-commerce (redes sociales, blogs, etc.).
      3. Deduplica por dominio base para evitar múltiples URLs del mismo sitio.
      4. Retorna hasta max_results URLs listas para generar ScrapingJobs.
    """

    def __init__(self, base_url: str, timeout: float = 15.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def discover(
        self,
        query: str,
        max_results: int = 10,
        language: str = "es-CO",
        deduplicate_by_domain: bool = True,
    ) -> list[str]:
        """
        Busca en SearXNG y retorna URLs de producto descubiertas.

        Args:
            query: Texto de búsqueda (ej: "iPhone 15 Pro 128GB")
            max_results: Máximo número de URLs a retornar
            language: Idioma/región para la búsqueda
            deduplicate_by_domain: Si True, retorna máx 1 URL por dominio

        Returns:
            Lista de URLs de producto (puede estar vacía si SearXNG no responde)
        """
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._base_url}/search",
                    params={
                        "q": query,
                        "format": "json",
                        "categories": "shopping,general",
                        "language": language,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("SearXNG no disponible (%s): %s", self._base_url, exc)
            return []

        results = data.get("results", [])
        urls = self._filter_and_deduplicate(results, deduplicate_by_domain)

        logger.info(
            "SearXNG: query='%s' → %d resultados → %d URLs de e-commerce",
            query, len(results), len(urls),
        )
        return urls[:max_results]

    def _filter_and_deduplicate(
        self, results: list[dict], deduplicate_by_domain: bool
    ) -> list[str]:
        """Filtra dominios no-ecommerce y deduplica por dominio base."""
        seen_domains: set[str] = set()
        filtered: list[str] = []

        for r in results:
            url: Optional[str] = r.get("url")
            if not url:
                continue

            domain = self._base_domain(url)

            # Descartar dominios que no son e-commerce
            if any(excl in domain for excl in _EXCLUDED_DOMAINS):
                continue

            # Deduplicar por dominio si está habilitado
            if deduplicate_by_domain:
                if domain in seen_domains:
                    continue
                seen_domains.add(domain)

            filtered.append(url)

        return filtered

    @staticmethod
    def _base_domain(url: str) -> str:
        """Extrae el dominio base de una URL (sin www. ni subdominio)."""
        try:
            from urllib.parse import urlparse
            netloc = urlparse(url).netloc.lower()
            # Eliminar www.
            if netloc.startswith("www."):
                netloc = netloc[4:]
            return netloc
        except Exception:
            return url
