"""Interfaz abstracta del scraper.

Implementación activa: PlaywrightScraper (Chromium headless vía Playwright).
Adecuado para SPAs y sitios con renderizado JavaScript (Amazon, MercadoLibre, Éxito).
"""
from abc import ABC, abstractmethod

from shared.model import RawScrapingResult, ScrapingJob


class BaseScraper(ABC):
    """
    Contrato que todo scraper debe cumplir.
    Responsabilidades:
      1. Obtener el contenido crudo de la URL indicada en el job.
      2. Extraer raw_fields por cada producto encontrado (sin normalización semántica).
      3. Retornar una lista de RawScrapingResult — uno por producto — todos con el
         mismo job_id (pertenecen a la misma búsqueda).
    """

    @abstractmethod
    async def scrape(self, job: ScrapingJob) -> list[RawScrapingResult]:
        """
        Ejecuta el scraping completo para el job dado.
        Devuelve una lista con un RawScrapingResult por producto encontrado.
        Nunca lanza excepciones: los errores se reflejan en result.status y
        result.error_message para permitir trazabilidad en el Normalizer.
        """
        ...
