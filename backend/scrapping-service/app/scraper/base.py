"""Interfaz abstracta del scraper.

Implementación activa: PlaywrightScraper (Chromium headless vía Playwright).
Adecuado para SPAs y sitios con renderizado JavaScript (Amazon, MercadoLibre, Éxito).
"""
from abc import ABC, abstractmethod
from typing import Any

from shared.model import RawScrapingResult, ScrapingJob


class BaseScraper(ABC):
    """
    Contrato que todo scraper debe cumplir.
    Responsabilidades:
      1. Obtener el contenido crudo de la URL indicada en el job.
      2. Extraer raw_fields directamente del HTML/JSON (sin normalización semántica).
      3. Retornar un RawScrapingResult con el status apropiado.
    """

    @abstractmethod
    async def scrape(self, job: ScrapingJob) -> RawScrapingResult:
        """
        Ejecuta el scraping completo para el job dado.
        Nunca lanza excepciones: los errores se reflejan en result.status y
        result.error_message para permitir trazabilidad en el Normalizer.
        """
        ...

    @abstractmethod
    def extract_raw_fields(self, content: str, job: ScrapingJob) -> dict[str, Any]:
        """
        Extrae campos crudos del contenido HTML/JSON.
        Punto de extensión: cada fuente implementa sus propios selectores.
        No debe aplicar normalización semántica (eso es responsabilidad del Normalizer).
        """
        ...
