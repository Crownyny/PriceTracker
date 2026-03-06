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
from ..sources.registry import registry

logger = logging.getLogger(__name__)


class HttpScraper(BaseScraper):
    """
    Scraper HTTP/S basado en httpx.
    Delega la extracción de campos al source registrado en el SourceRegistry.
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
                search_id=job.search_id,
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
        Delega la extracción al source registrado en el SourceRegistry.
        Si no existe source para el job, devuelve campos vacíos.
        """
        source = registry.get(job.source_name)
        if source:
            return source.extract_raw_fields(content, job)

        logger.warning(
            "[%s] Sin extractor registrado para '%s', devolviendo campos vacíos",
            job.job_id, job.source_name,
        )
        return {
            "raw_title": None,
            "raw_price": None,
            "raw_currency": None,
            "raw_availability": None,
            "raw_category": None,
            "raw_image_url": None,
            "raw_description": None,
        }

    @staticmethod
    def _failed_result(job: ScrapingJob, error: str) -> RawScrapingResult:
        return RawScrapingResult(
            job_id=job.job_id,
            search_id=job.search_id,
            product_ref=job.product_ref,
            source_name=job.source_name,
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
            raw_fields={},
            status="failed",
            error_message=error,
        )
