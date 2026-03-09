"""Detector de fuente a partir de una URL.

Mapea el dominio de una URL al nombre canónico de su source registrado.
Útil para identificar qué extractor usar cuando se recibe una URL arbitraria.

Cómo añadir soporte para un nuevo sitio:
  1. Crear app/sources/<nombre>.py extendiendo BeautifulSoupSource.
  2. Registrar el source: registry.register(MiNuevoSource()).
  3. Añadir su dominio al _DOMAIN_MAP de este archivo.
"""
import logging
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Mapa de fragmentos de dominio → source_name canónico.
# Order matters: los más específicos deben ir primero.
_DOMAIN_MAP: dict[str, str] = {
    # MercadoLibre (múltiples países)
    "mercadolibre.com.co":  "mercadolibre",
    "mercadolibre.com.mx":  "mercadolibre",
    "mercadolibre.com.ar":  "mercadolibre",
    "mercadolibre.com.cl":  "mercadolibre",
    "mercadolibre.com.pe":  "mercadolibre",
    "mercadolibre.com.ve":  "mercadolibre",
    "mercadolibre.com.br":  "mercadolibre",
    "mercadolibre.com":     "mercadolibre",

    # Amazon (múltiples países)
    "amazon.com.co":        "amazon",
    "amazon.com.mx":        "amazon",
    "amazon.com.br":        "amazon",
    "amazon.co.uk":         "amazon",
    "amazon.de":            "amazon",
    "amazon.es":            "amazon",
    "amazon.com":           "amazon",

    # Global
    "aliexpress.com":       "aliexpress",
    "es.aliexpress.com":    "aliexpress",

    # Colombia
    "exito.com":            "exito",
    "falabella.com.co":     "falabella",
    "olimpica.com":         "olimpica",
    "alkosto.com":          "alkosto",
    "ktronix.com":          "ktronix",
    "homecenter.com.co":    "homecenter",
    "dafiti.com.co":        "dafiti",
    "tecnoplaza.com.co":     "tecnoplaza",
    "alkomprar.com":        "alkomprar",
    "computienda.com.co":   "computienda",
}


class SiteDetector:
    """
    Detecta qué source usar para una URL dada, basándose en su dominio.

    Si el dominio no está registrado, retorna "unknown" y el scraper guardará
    el HTML crudo sin parseo estructurado.
    """

    def detect(self, url: str) -> str:
        """
        Retorna el source_name para la URL dada.
        Retorna "unknown" si no hay coincidencia.
        """
        domain = self._extract_domain(url)
        if not domain:
            return "unknown"

        # Buscar coincidencia (soporta subdominios: "listado.mercadolibre.com.co")
        for known_domain, source_name in _DOMAIN_MAP.items():
            if known_domain in domain:
                return source_name

        logger.debug("Dominio sin source registrado: %s (url=%s)", domain, url)
        return "unknown"

    def is_known(self, url: str) -> bool:
        """Retorna True si el dominio tiene un source registrado."""
        return self.detect(url) != "unknown"

    @staticmethod
    def _extract_domain(url: str) -> Optional[str]:
        try:
            netloc = urlparse(url).netloc.lower()
            return netloc.removeprefix("www.")
        except Exception:
            return None


# Instancia 
detector = SiteDetector()
