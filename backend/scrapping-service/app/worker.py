"""Worker principal del Scraper Service.

Flujo por mensaje:
    1. Recibe SearchRequest desde la cola (cadena de búsqueda del usuario).
    2. Selecciona las fuentes a usar: las indicadas en `sources` o TODAS las registradas.
    3. Construye un ScrapingJob por fuente con la URL correspondiente (build_url).
    4. Ejecuta el scraping en PARALELO sobre todas las fuentes (asyncio.gather).
    5. Publica cada ScrapingMessage en JSON hacia la cola del Normalizer Service.
    6. Publica SearchCompletedMessage como sentinel con el total de resultados enviados.
"""
import asyncio
import logging
from typing import Any

from shared.messaging import (
    BaseConsumer,
    RabbitMQConnection,
    QUEUE_SCRAPING_JOBS,
    QUEUE_SCRAPING_JOBS_DLQ,
)
from shared.model import RawScrapingResult, ScrapingJob, SearchRequest

from .config import settings
from .publisher import ScrapingResultPublisher
from .scraper.playwright_scraper import PlaywrightScraper
from .sources import registry

logger = logging.getLogger(__name__)


class ScraperWorker(BaseConsumer):
    """
    Consumer de SearchRequest.
    Orquesta: deserialización → scraping paralelo en todas las fuentes → publicación JSON.
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
        self._publisher = ScrapingResultPublisher(connection)

    async def start(self) -> None:
        """Lanza el browser Playwright antes de empezar a consumir mensajes."""
        await self._scraper.start()
        logger.info("PlaywrightScraper iniciado.")

    async def stop(self) -> None:
        """Cierra el browser Playwright al apagar el worker."""
        await self._scraper.stop()
        logger.info("PlaywrightScraper detenido.")

    async def handle(self, payload: dict[str, Any]) -> None:
        await self._handle_search(payload)

    async def _handle_search(self, payload: dict[str, Any]) -> None:
        """
        Recibe un SearchRequest, lanza el scraping en paralelo en todas las fuentes
        y publica cada resultado como ScrapingMessage (JSON) hacia el Normalizer.
        """
        request = SearchRequest.model_validate(payload)

        # Seleccionar fuentes: explícitas o todas las registradas
        sources = registry.filter(request.sources) if request.sources else registry.all()

        if not sources:
            logger.warning(
                "[%s] Sin fuentes registradas para la búsqueda '%s'",
                request.search_id, request.query,
            )
            await self._publisher.publish_search_completed(
                search_id=request.search_id,
                product_ref=request.product_ref,
                total_jobs=0,
            )
            return

        # Construir un ScrapingJob por fuente
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

        logger.info(
            "[%s] Iniciando scraping paralelo de '%s' en %d fuentes: %s",
            request.search_id, request.query, len(jobs),
            ", ".join(j.source_name for j in jobs),
        )

        # Scraping paralelo — return_exceptions=True evita que un fallo aislado
        # cancele los demás; PlaywrightScraper ya maneja excepciones internamente.
        # Cada elemento es list[RawScrapingResult] (uno por producto encontrado).
        raw_results: list[list[RawScrapingResult] | BaseException] = await asyncio.gather(
            *[self._scraper.scrape(job) for job in jobs],
            return_exceptions=True,
        )

        # Publicar un ScrapingMessage por producto (contrato de cola sin cambios)
        published = 0
        for job, results in zip(jobs, raw_results):
            if isinstance(results, BaseException):
                logger.error(
                    "[%s] Excepción no capturada en fuente '%s': %s",
                    request.search_id, job.source_name, results,
                )
            else:
                for result in results:
                    await self._publisher.publish_result(result)
                    published += 1
                logger.info(
                    "[%s] Fuente '%s': %d producto(s) encontrado(s)",
                    request.search_id, job.source_name, len(results),
                )

        # Sentinel: informa al Normalizer cuántos ScrapingMessages esperar
        await self._publisher.publish_search_completed(
            search_id=request.search_id,
            product_ref=request.product_ref,
            total_jobs=published,
        )

        logger.info(
            "[%s] Completado: %d/%d resultados publicados para '%s'",
            request.search_id, published, len(jobs), request.query,
        )
