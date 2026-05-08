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

    async def publish_result(
        self, 
        result: RawScrapingResult | None, 
        query: str | None = None, 
        store_url: str | None = None,
        job_id: str | None = None,
        search_id: str | None = None,
        product_ref: str | None = None,
        source_name: str | None = None,
        state: str | None = None,
        error_message: str | None = None,
        is_update: bool | None = None
    ) -> None:
        """
        Publica un ScrapingMessage.
        
        Args:
            result: RawScrapingResult con datos del scraping (opcional para fallos)
            query: Query de búsqueda (opcional para scraping documentado)
            store_url: URL de la tienda proporcionada (opcional)
            job_id: ID del job (requerido si result es None)
            search_id: ID de búsqueda (requerido si result es None)
            product_ref: Referencia del producto (requerido si result es None)
            source_name: Nombre de la fuente (requerido si result es None)
            state: Estado del scraping (requerido si result es None)
            error_message: Mensaje de error (opcional)
            is_update: True=actualización, False/None=búsqueda nueva (opcional)
        """
        if result is not None:
            # Caso normal: tenemos un RawScrapingResult
            final_state = ScrapingState.SCRAPED if result.status == "success" else ScrapingState.FAILED
            message = ScrapingMessage(
                job_id=result.job_id,
                search_id=result.search_id,
                product_ref=result.product_ref,
                source_name=result.source_name,
                captured_at=result.scraped_at,
                state=final_state,
                query=query,
                store_url=store_url,
                is_update=is_update,
                raw_fields=result.raw_fields,
                error_message=result.error_message,
            )
            fields_count = len(result.raw_fields)
        else:
            # Caso de fallo: construimos mensaje manualmente
            final_state = ScrapingState.FAILED if state == "failed" else ScrapingState.SCRAPED
            message = ScrapingMessage(
                job_id=job_id or "unknown",
                search_id=search_id,
                product_ref=product_ref,
                source_name=source_name or "unknown",
                captured_at=datetime.datetime.now(tz=datetime.timezone.utc),
                state=final_state,
                query=query,
                store_url=store_url,
                is_update=is_update,
                raw_fields={},
                error_message=error_message,
            )
            fields_count = 0
        
        await self.publish(QUEUE_SCRAPING_RESULTS, message.model_dump(mode="json"))
        logger.info(
            "[%s] ScrapingMessage publicado en '%s' (state=%s, fields=%d, store_url=%s)",
            message.job_id, QUEUE_SCRAPING_RESULTS, final_state, fields_count, store_url or "None",
        )

    async def publish_search_completed(
        self, search_id: str, product_ref: str, total_jobs: int, is_update: bool | None = None
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
            is_update=is_update,
            dispatched_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )
        await self.publish(QUEUE_SCRAPING_RESULTS, message.model_dump(mode="json"))
        logger.info(
            "[%s] SearchCompletedMessage publicado: %d jobs despachados",
            search_id, total_jobs,
        )
