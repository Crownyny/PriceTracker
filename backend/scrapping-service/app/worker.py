"""Worker principal del Scraper Service.

Flujo por mensaje:
    A) ScrapingJob (job individual):
        1. Recibe ScrapingJob desde la cola.
        2. Ejecuta el scraping (PlaywrightScraper).
        3. Publica ScrapingMessage con raw_fields embebidos → cola de resultados.

    B) SearchRequest (fan-out con SearXNG):
        1. Recibe SearchRequest desde la cola.
        2a. Si request.sources=None: usa SearXNGDiscovery para descubrir URLs
            de producto en e-commerces reales. SiteDetector mapea cada URL al
            source_name correcto.
        2b. Si request.sources=[...]: usa el SourceRegistry como fallback manual
            (build_url por fuente).
        3. Genera N ScrapingJobs y hace fan-out en la misma cola.
        4. Publica SearchCompletedMessage(total_jobs=N) como sentinel.
"""
import logging
from typing import Any

from shared.messaging import (
    BaseConsumer,
    BasePublisher,
    RabbitMQConnection,
    QUEUE_SCRAPING_JOBS,
    QUEUE_SCRAPING_JOBS_DLQ,
)
from shared.model import ScrapingJob, SearchRequest

from .config import settings
from .publisher import ScrapingResultPublisher
from .scraper.playwright_scraper import PlaywrightScraper
from .sources import registry
from .sources.discovery import SearXNGDiscovery
from .sources.detector import detector as site_detector

logger = logging.getLogger(__name__)


class ScraperWorker(BaseConsumer):
    """
    Consumer de ScrapingJob y SearchRequest.
    Orquesta: deserialización → [fan-out | scraping] → evento.
    """

    def __init__(self, connection: RabbitMQConnection) -> None:
        super().__init__(
            connection=connection,
            queue_name=QUEUE_SCRAPING_JOBS,
            dlq_name=QUEUE_SCRAPING_JOBS_DLQ,
        )
        self._scraper = PlaywrightScraper(
            registry=registry,
            user_agent=settings.user_agent,
        )
        self._discovery = SearXNGDiscovery(
            base_url=settings.searxng_url,
            timeout=settings.http_timeout,
        )
        self._publisher = ScrapingResultPublisher(connection)
        self._job_publisher = BasePublisher(connection)

    async def start(self) -> None:
        """Lanza el browser Playwright antes de empezar a consumir mensajes."""
        await self._scraper.start()
        logger.info("PlaywrightScraper iniciado.")

    async def stop(self) -> None:
        """Cierra el browser Playwright al apagar el worker."""
        await self._scraper.stop()
        logger.info("PlaywrightScraper detenido.")

    async def handle(self, payload: dict[str, Any]) -> None:
        # Discriminar tipo de mensaje por la presencia del campo "query"
        if "query" in payload:
            await self._handle_search(payload)
        else:
            await self._handle_job(payload)

    async def _handle_search(self, payload: dict[str, Any]) -> None:
        """Fan-out: genera N ScrapingJobs a partir de un SearchRequest."""
        request = SearchRequest.model_validate(payload)

        if request.sources:
            # ── Modo manual: fuentes explícitas con build_url() ──────────────────
            sources = registry.filter(request.sources)
            jobs = [
                ScrapingJob(
                    search_id=request.search_id,
                    source_url=source.build_url(request.query, request.product_ref),
                    source_name=source.source_name,
                    product_ref=request.product_ref,
                    priority=request.priority,
                    metadata={**request.metadata, "query": request.query},
                )
                for source in sources
            ]
            log_detail = ", ".join(s.source_name for s in sources)
        else:
            # ── Modo auto: SearXNG descubre URLs reales de e-commerce ─────────
            discovered_urls = await self._discovery.discover(
                query=request.query,
                max_results=settings.searxng_max_results,
            )
            jobs = [
                ScrapingJob(
                    search_id=request.search_id,
                    source_url=url,
                    source_name=site_detector.detect(url),
                    product_ref=request.product_ref,
                    priority=request.priority,
                    metadata={**request.metadata, "query": request.query},
                )
                for url in discovered_urls
            ]
            log_detail = " | ".join(
                f"{j.source_name}:{j.source_url[:40]}" for j in jobs
            )

        if not jobs:
            logger.warning(
                "[%s] Sin URLs descubiertas para la búsqueda '%s'",
                request.search_id, request.query,
            )
            await self._publisher.publish_search_completed(
                search_id=request.search_id,
                product_ref=request.product_ref,
                total_jobs=0,
            )
            return

        payloads = [job.model_dump(mode="json") for job in jobs]
        await self._job_publisher.publish_many(QUEUE_SCRAPING_JOBS, payloads)

        await self._publisher.publish_search_completed(
            search_id=request.search_id,
            product_ref=request.product_ref,
            total_jobs=len(jobs),
        )

        logger.info(
            "[%s] Fan-out: %d jobs para '%s' → %s",
            request.search_id, len(jobs), request.query, log_detail,
        )

    async def _handle_job(self, payload: dict[str, Any]) -> None:
        """Procesa un ScrapingJob individual."""
        job = ScrapingJob.model_validate(payload)
        logger.info("[%s] Job recibido: %s / %s", job.job_id, job.source_name, job.source_url)

        # 1. Ejecutar el scraping
        result = await self._scraper.scrape(job)

        # 2. Publicar evento con raw_fields embebidos (sin pasar por MongoDB)
        await self._publisher.publish_result(result)

        logger.info("[%s] Job finalizado con status '%s'", job.job_id, result.status)
