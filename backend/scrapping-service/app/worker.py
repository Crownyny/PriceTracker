"""Worker principal del Scraper Service.

Flujo por mensaje:
    A) ScrapingJob (job individual):
        1. Recibe ScrapingJob desde la cola.
        2. Ejecuta el scraping (HttpScraper).
        3. Publica ScrapingMessage con raw_fields embebidos → cola de resultados.
           (sin persistencia en MongoDB; los datos viajan en el evento)

    B) SearchRequest (fan-out):
        1. Recibe SearchRequest desde la cola.
        2. Usa el SourceRegistry para determinar las fuentes.
        3. Genera N ScrapingJobs (uno por fuente) con el mismo search_id.
        4. Publica cada job en la misma cola para procesamiento individual.
        5. Publica SearchCompletedMessage(total_jobs=N) como sentinel.
           El Normalizer necesita este mensaje para saber cuándo cerrar la búsqueda.
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
from .scraper.http_scraper import HttpScraper
from .sources import registry

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
        self._scraper = HttpScraper(
            timeout=settings.http_timeout,
            user_agent=settings.user_agent,
        )
        self._publisher = ScrapingResultPublisher(connection)
        self._job_publisher = BasePublisher(connection)

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
            sources = registry.filter(request.sources)
        else:
            sources = registry.all()

        if not sources:
            logger.warning(
                "[%s] Sin fuentes disponibles para la búsqueda '%s'",
                request.search_id, request.query,
            )
            # Sentinel con total_jobs=0 para que el Normalizer cierre de inmediato
            await self._publisher.publish_search_completed(
                search_id=request.search_id,
                product_ref=request.product_ref,
                total_jobs=0,
            )
            return

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

        payloads = [job.model_dump(mode="json") for job in jobs]
        await self._job_publisher.publish_many(QUEUE_SCRAPING_JOBS, payloads)

        # Sentinel: permite al Normalizer saber cuántos ScrapingMessages esperar
        await self._publisher.publish_search_completed(
            search_id=request.search_id,
            product_ref=request.product_ref,
            total_jobs=len(jobs),
        )

        logger.info(
            "[%s] SearchRequest fan-out: %d jobs generados para '%s' → [%s]",
            request.search_id,
            len(jobs),
            request.query,
            ", ".join(s.source_name for s in sources),
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
