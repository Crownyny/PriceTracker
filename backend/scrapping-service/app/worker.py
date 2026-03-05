"""Worker principal del Scraper Service.

Flujo por mensaje:
    1. Recibe ScrapingJob desde la cola.
    2. Ejecuta el scraping (HttpScraper).
    3. Guarda RawScrapingResult en MongoDB (MongoRawRepository).
    4. Publica ScrapingMessage (evento puro) → cola de resultados.
       El Normalizer leerá el documento de MongoDB usando job_id.
"""
import logging
from typing import Any

from shared.messaging import (
    BaseConsumer,
    RabbitMQConnection,
    QUEUE_SCRAPING_JOBS,
    QUEUE_SCRAPING_JOBS_DLQ,
)
from shared.model import ScrapingJob

from .config import settings
from .publisher import ScrapingResultPublisher
from .scraper.http_scraper import HttpScraper
from .storage import MongoRawRepository

logger = logging.getLogger(__name__)


class ScraperWorker(BaseConsumer):
    """
    Consumer de ScrapingJob.
    Orquesta: deserialización → scraping → MongoDB → evento.
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
        self._repository = MongoRawRepository(
            mongo_url=settings.mongodb_url,
            db_name=settings.mongodb_db,
        )
        self._publisher = ScrapingResultPublisher(connection)

    async def handle(self, payload: dict[str, Any]) -> None:
        job = ScrapingJob.model_validate(payload)
        logger.info("[%s] Job recibido: %s / %s", job.job_id, job.source_name, job.source_url)

        # 1. Ejecutar el scraping
        result = await self._scraper.scrape(job)

        # 2. Persistir en MongoDB (siempre, incluso si falló, para trazabilidad)
        await self._repository.save(result)

        # 3. Publicar evento hacia el Normalizer
        await self._publisher.publish_result(result)

        logger.info("[%s] Job finalizado con status '%s'", job.job_id, result.status)
