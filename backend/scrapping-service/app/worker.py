"""Worker principal del Scraper Service.

Flujo por mensaje:
    1. Recibe SearchRequest desde la cola (cadena de búsqueda del usuario).
    2. Selecciona las fuentes a usar: las indicadas en `sources` o TODAS las registradas.
    3. Construye un ScrapingJob por fuente con la URL correspondiente (build_url).
    4. Ejecuta el scraping en PARALELO sobre todas las fuentes (asyncio.gather).
    5. Cada fuente publica sus resultados en tiempo real en cuanto termina, sin
       esperar a las demás (streaming: no se acumulan resultados en memoria).
    6. Publica SearchCompletedMessage como sentinel con el total de mensajes enviados.
"""
import asyncio
import datetime
import logging
from typing import Any

from shared.messaging import (
    BaseConsumer,
    RabbitMQConnection,
    QUEUE_SCRAPING_JOBS,
    QUEUE_SCRAPING_JOBS_DLQ,
    QUEUE_SCRAPING_RESULTS,
)
from shared.model import ScrapingJob, ScrapingMessage, ScrapingState, SearchRequest

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
        logger.info("[recv] SearchRequest recibido: search_id=%s query='%s' sources=%s",
                    payload.get("search_id"), payload.get("query"), payload.get("sources"))
        await self._handle_search(payload)

    async def _scrape_and_publish(self, job: ScrapingJob, request: SearchRequest) -> tuple[int, int]:
        """
        Scraping de una fuente + publicación inmediata de cada producto en cuanto
        se extrae del HTML (no espera a tener todos los productos de la fuente).
        Retorna (products_published, failed_published) para contabilizar el total.
        """
        products_published = 0
        try:
            async for result in self._scraper.scrape(job):
                if result.status == "failed":
                    failed_msg = ScrapingMessage(
                        job_id=result.job_id,
                        search_id=request.search_id,
                        product_ref=request.product_ref,
                        source_name=job.source_name,
                        captured_at=datetime.datetime.now(tz=datetime.timezone.utc),
                        state=ScrapingState.FAILED,
                        raw_fields={},
                        error_message=result.error_message,
                    )
                    await self._publisher.publish(QUEUE_SCRAPING_RESULTS, failed_msg.model_dump(mode="json"))
                    return 0, 1
                await self._publisher.publish_result(result)
                products_published += 1
        except Exception as exc:
            logger.error("[%s] Excepción no capturada en fuente '%s': %s",
                         request.search_id, job.source_name, exc)
            failed_msg = ScrapingMessage(
                job_id=job.job_id,
                search_id=request.search_id,
                product_ref=request.product_ref,
                source_name=job.source_name,
                captured_at=datetime.datetime.now(tz=datetime.timezone.utc),
                state=ScrapingState.FAILED,
                raw_fields={},
                error_message=str(exc),
            )
            await self._publisher.publish(QUEUE_SCRAPING_RESULTS, failed_msg.model_dump(mode="json"))
            return 0, 1

        if products_published == 0:
            # Fuente respondió pero no encontró productos
            logger.info("[%s] Fuente '%s': 0 productos → FAILED publicado",
                        request.search_id, job.source_name)
            failed_msg = ScrapingMessage(
                job_id=job.job_id,
                search_id=request.search_id,
                product_ref=request.product_ref,
                source_name=job.source_name,
                captured_at=datetime.datetime.now(tz=datetime.timezone.utc),
                state=ScrapingState.FAILED,
                raw_fields={},
                error_message="No products found",
            )
            await self._publisher.publish(QUEUE_SCRAPING_RESULTS, failed_msg.model_dump(mode="json"))
            return 0, 1

        logger.info("[%s] Fuente '%s': %d producto(s) publicado(s) en tiempo real",
                    request.search_id, job.source_name, products_published)
        return products_published, 0

    async def _handle_search(self, payload: dict[str, Any]) -> None:
        """
        Recibe un SearchRequest, lanza el scraping en paralelo en todas las fuentes.
        Cada fuente publica sus resultados en cuanto termina (streaming real).
        """
        request = SearchRequest.model_validate(payload)

        sources = registry.filter(request.sources) if request.sources else registry.all()

        if not sources:
            logger.warning("[%s] Sin fuentes registradas para la búsqueda '%s'",
                           request.search_id, request.query)
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

        logger.info(
            "[%s] Iniciando scraping paralelo (streaming) de '%s' en %d fuentes: %s",
            request.search_id, request.query, len(jobs),
            ", ".join(j.source_name for j in jobs),
        )

        # Cada _scrape_and_publish corre en paralelo y publica en cuanto termina.
        counts: list[tuple[int, int]] = await asyncio.gather(
            *[self._scrape_and_publish(job, request) for job in jobs],
        )

        products_published = sum(p for p, _ in counts)
        failed_published = sum(f for _, f in counts)
        total_messages = products_published + failed_published

        # Sentinel: el Normalizer sabe exactamente cuántos mensajes esperar.
        await self._publisher.publish_search_completed(
            search_id=request.search_id,
            product_ref=request.product_ref,
            total_jobs=total_messages,
        )

        logger.info(
            "[%s] Completado: %d producto(s), %d fuente(s) sin resultado(s), total=%d mensajes para '%s'",
            request.search_id, products_published, failed_published, total_messages, request.query,
        )
