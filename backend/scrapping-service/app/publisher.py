"""Publicador de eventos de scraping hacia el Normalizer Service.

Publica un ScrapingMessage con raw_fields embebidos después de que
el Scraper haya procesado el job. No se usa MongoDB: los datos viajan
directamente en el evento.

También publica SearchCompletedMessage como sentinel al terminar
el fan-out, para que el Normalizer sepa cuántos resultados esperar.
"""
import datetime
import logging

from shared.messaging import BasePublisher, RabbitMQConnection, QUEUE_SCRAPING_RESULTS
from shared.model import RawScrapingResult, ScrapingMessage, ScrapingState, SearchCompletedMessage

logger = logging.getLogger(__name__)


class ScrapingResultPublisher(BasePublisher):
    """
    Convierte RawScrapingResult → ScrapingMessage (con raw_fields) y publica
    en la cola que consume el Normalizer.
    """

    def __init__(self, connection: RabbitMQConnection) -> None:
        super().__init__(connection)

    async def publish_result(self, result: RawScrapingResult, query: str | None = None) -> None:
        state = ScrapingState.SCRAPED if result.status == "success" else ScrapingState.FAILED
        message = ScrapingMessage(
            job_id=result.job_id,
            search_id=result.search_id,
            product_ref=result.product_ref,
            source_name=result.source_name,
            captured_at=result.scraped_at,
            state=state,
            query=query,
            raw_fields=result.raw_fields,
            error_message=result.error_message,
        )
        await self.publish(QUEUE_SCRAPING_RESULTS, message.model_dump(mode="json"))
        logger.info(
            "[%s] ScrapingMessage publicado en '%s' (state=%s, fields=%d)",
            result.job_id, QUEUE_SCRAPING_RESULTS, state, len(result.raw_fields),
        )

    async def publish_search_completed(
        self, search_id: str, product_ref: str, total_jobs: int
    ) -> None:
        """
        Publica el sentinel SearchCompletedMessage en la misma cola.
        Se llama una vez por SearchRequest, tras el fan-out de todos los jobs.
        `total_jobs` indica cuántos ScrapingMessages llegarán para este search_id.
        """
        message = SearchCompletedMessage(
            search_id=search_id,
            product_ref=product_ref,
            total_jobs=total_jobs,
            dispatched_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )
        await self.publish(QUEUE_SCRAPING_RESULTS, message.model_dump(mode="json"))
        logger.info(
            "[%s] SearchCompletedMessage publicado: %d jobs despachados",
            search_id, total_jobs,
        )
