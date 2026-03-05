"""Publicador de eventos de scraping hacia el Normalizer Service.

Publica un ScrapingMessage (evento puro, sin raw_fields) después de que
el Scraper haya guardado el RawScrapingResult en MongoDB.
El Normalizer hará lookup en MongoDB usando el job_id del evento.
"""
import logging

from shared.messaging import BasePublisher, RabbitMQConnection, QUEUE_SCRAPING_RESULTS
from shared.model import RawScrapingResult, ScrapingMessage, ScrapingState

logger = logging.getLogger(__name__)


class ScrapingResultPublisher(BasePublisher):
    """
    Transforma RawScrapingResult → ScrapingMessage (evento puro) y publica
    en la cola que consume el Normalizer.
    """

    def __init__(self, connection: RabbitMQConnection) -> None:
        super().__init__(connection)

    async def publish_result(self, result: RawScrapingResult) -> None:
        state = ScrapingState.SCRAPED if result.status == "success" else ScrapingState.FAILED
        message = ScrapingMessage(
            job_id=result.job_id,
            product_ref=result.product_ref,
            source_name=result.source_name,
            captured_at=result.scraped_at,
            state=state,
            error_message=result.error_message,
        )
        await self.publish(QUEUE_SCRAPING_RESULTS, message.model_dump(mode="json"))
        logger.info(
            "[%s] Evento ScrapingMessage publicado en '%s' (state=%s)",
            result.job_id, QUEUE_SCRAPING_RESULTS, state,
        )
