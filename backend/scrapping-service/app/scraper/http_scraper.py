"""Implementación de scraper basada en peticiones HTTP async (httpx).

Adecuada para páginas con HTML estático o APIs REST/JSON.
Para sitios con renderizado JavaScript, sustituir por PlaywrightScraper:

    class PlaywrightScraper(BaseScraper):
        async def scrape(self, job: ScrapingJob) -> RawScrapingResult:
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                page = await browser.new_page()
                await page.goto(job.source_url)
                content = await page.content()
                ...
"""
import datetime
import logging
from typing import Any

import httpx

from shared.model import RawScrapingResult, ScrapingJob

from .base import BaseScraper

logger = logging.getLogger(__name__)


class HttpScraper(BaseScraper):
    """
    Scraper HTTP/S basado en httpx.
    Configurable mediante timeout y user_agent inyectados en el constructor.
    """

    def __init__(
        self,
        timeout: float = 30.0,
        user_agent: str = "PriceTrackerBot/1.0",
    ) -> None:
        self._timeout = timeout
        self._headers = {"User-Agent": user_agent}

    async def scrape(self, job: ScrapingJob) -> RawScrapingResult:
        logger.info("[%s] Scraping %s (%s)", job.job_id, job.source_url, job.source_name)
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout,
                headers=self._headers,
                follow_redirects=True,
            ) as client:
                response = await client.get(job.source_url)
                response.raise_for_status()
                html_content = response.text

            raw_fields = self.extract_raw_fields(html_content, job)
            return RawScrapingResult(
                job_id=job.job_id,
                product_ref=job.product_ref,
                source_name=job.source_name,
                scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
                raw_fields=raw_fields,
                html_content=html_content,
                status="success",
            )

        except httpx.HTTPStatusError as exc:
            logger.error("[%s] HTTP %s en %s", job.job_id, exc.response.status_code, job.source_url)
            return self._failed_result(job, str(exc))

        except Exception as exc:
            logger.exception("[%s] Error inesperado en scraping", job.job_id)
            return self._failed_result(job, str(exc))

    def extract_raw_fields(self, content: str, job: ScrapingJob) -> dict[str, Any]:
        """
        Punto de extensión principal: despacha al extractor específico de la fuente.

        TODO: añadir extractores por fuente, por ejemplo:
            from .extractors import get_extractor
            return get_extractor(job.source_name).extract(content)

        Por ahora devuelve un diccionario con las claves esperadas vacías,
        para que el Normalizer pueda recibir el mensaje con estructura conocida.
        """
        logger.debug("[%s] extract_raw_fields stub para fuente '%s'", job.job_id, job.source_name)
        return {
            "raw_title": None,          # Ejemplo: parsed via BeautifulSoup/lxml
            "raw_price": None,          # Ejemplo: "$1.999.000"
            "raw_currency": None,       # Ejemplo: "COP"
            "raw_availability": None,   # Ejemplo: "En stock"
            "raw_category": None,
            "raw_image_url": None,
            "raw_description": None,
        }

    @staticmethod
    def _failed_result(job: ScrapingJob, error: str) -> RawScrapingResult:
        return RawScrapingResult(
            job_id=job.job_id,
            product_ref=job.product_ref,
            source_name=job.source_name,
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
            raw_fields={},
            status="failed",
            error_message=error,
        )
