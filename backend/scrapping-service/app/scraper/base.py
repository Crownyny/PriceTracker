"""Interfaz abstracta del scraper.

Implementación activa: PlaywrightScraper (Chromium headless vía Playwright).
Adecuado para SPAs y sitios con renderizado JavaScript (Amazon, MercadoLibre, Éxito).
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator

from shared.model import RawScrapingResult, ScrapingJob


class BaseScraper(ABC):
    """
    Contrato que todo scraper debe cumplir.
    Responsabilidades:
      1. Obtener el contenido crudo de la URL indicada en el job.
      2. Extraer raw_fields por cada producto encontrado (sin normalización semántica).
      3. Hacer yield de cada RawScrapingResult en cuanto se extrae, sin acumular.
    """

    @abstractmethod
    async def scrape(self, job: ScrapingJob) -> AsyncGenerator[RawScrapingResult, None]:
        """
        Async generator: hace yield de un RawScrapingResult por cada producto
        encontrado en cuanto está disponible.
        Nunca lanza excepciones: los errores los emite como un único resultado
        con status='failed' para permitir trazabilidad en el Normalizer.
        """
        ...  # type: ignore[return]
        yield  # hace que Python la trate como generator aunque sea abstracto
