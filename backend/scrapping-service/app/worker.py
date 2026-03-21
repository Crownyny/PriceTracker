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
import logging
import re
from difflib import SequenceMatcher
from typing import Any

from shared.messaging import (
    BaseConsumer,
    RabbitMQConnection,
    QUEUE_SCRAPING_JOBS,
    QUEUE_SCRAPING_JOBS_DLQ,
)
from shared.model import ScrapingJob, SearchRequest

from .config import settings
from .publisher import ScrapingResultPublisher
from .scraper.playwright_scraper import PlaywrightScraper
from .sources import registry

logger = logging.getLogger(__name__)


def _normalize_text(text: str | None) -> str:
    value = (text or "").lower().strip()
    value = re.sub(r"[^a-z0-9áéíóúñü\s]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _relevance_score(query: str, title: str | None) -> float:
    normalized_query = _normalize_text(query)
    normalized_title = _normalize_text(title)
    if not normalized_query or not normalized_title:
        return 0.0

    query_tokens = set(normalized_query.split())
    title_tokens = set(normalized_title.split())
    overlap = len(query_tokens & title_tokens) / max(1, len(query_tokens))
    sequence = SequenceMatcher(None, normalized_query, normalized_title).ratio()
    return round((0.7 * overlap) + (0.3 * sequence), 3)


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
            prefetch_count=settings.worker_prefetch_count,
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

    async def _scrape_and_publish(self, job: ScrapingJob, request: SearchRequest) -> int:
        """
        Scraping de una fuente + publicación inmediata de cada producto en cuanto
        se extrae del HTML (no espera a tener todos los productos de la fuente).
        Retorna cuántos productos reales se publicaron.
        """
        products_published = 0
        seen_urls = set()  # Para evitar duplicados dentro de la misma fuente
        try:
            async for result in self._scraper.scrape(job):
                if result.status == "failed":
                    logger.info(
                        "[%s] Fuente '%s': resultado FAILED omitido (%s)",
                        request.search_id,
                        job.source_name,
                        result.error_message or "sin detalle",
                    )
                    continue

                raw_price = result.raw_fields.get("raw_price") if result.raw_fields else None
                if raw_price in (None, ""):
                    logger.info(
                        "[%s] Fuente '%s': producto omitido por raw_price nulo/vacío",
                        request.search_id,
                        job.source_name,
                    )
                    continue

                # Filtrar duplicados por URL dentro de la misma fuente
                raw_url = result.raw_fields.get("raw_url") if result.raw_fields else None
                if raw_url and raw_url in seen_urls:
                    logger.info(
                        "[%s] Fuente '%s': producto duplicado omitido (URL ya procesada: %s)",
                        request.search_id,
                        job.source_name,
                        raw_url,
                    )
                    continue
                if raw_url:
                    seen_urls.add(raw_url)

                if settings.enable_relevance_guard:
                    title = result.raw_fields.get("raw_title") if result.raw_fields else None
                    score = _relevance_score(request.query, title)
                    if score < settings.relevance_min_score:
                        logger.info(
                            "[%s] Fuente '%s': producto omitido por baja relevancia (score=%.3f < %.3f, title=%r)",
                            request.search_id,
                            job.source_name,
                            score,
                            settings.relevance_min_score,
                            title,
                        )
                        continue

                await self._publisher.publish_result(result)
                products_published += 1
        except Exception as exc:
            logger.error("[%s] Excepción no capturada en fuente '%s': %s",
                         request.search_id, job.source_name, exc)
            return 0

        if products_published == 0:
            logger.info("[%s] Fuente '%s': 0 productos (sin mensaje en cola)",
                        request.search_id, job.source_name)
            return 0

        logger.info("[%s] Fuente '%s': %d producto(s) publicado(s) en tiempo real",
                    request.search_id, job.source_name, products_published)
        return products_published

    async def _handle_search(self, payload: dict[str, Any]) -> None:
        """
        Recibe un SearchRequest, lanza el scraping en paralelo en todas las fuentes.
        Cada fuente publica sus resultados en cuanto termina (streaming real).
        """
        request = SearchRequest.model_validate(payload)

        if request.sources:
            sources = registry.filter(request.sources)
        else:
            # Usar fuentes por defecto (electrónica) si no se especifican
            default_source_names = [name.strip() for name in settings.default_sources.split(",") if name.strip()]
            sources = registry.filter(default_source_names)

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
        counts: list[int] = await asyncio.gather(
            *[self._scrape_and_publish(job, request) for job in jobs],
        )

        products_published = sum(counts)
        total_messages = products_published

        # Sentinel: el Normalizer sabe exactamente cuántos mensajes esperar.
        await self._publisher.publish_search_completed(
            search_id=request.search_id,
            product_ref=request.product_ref,
            total_jobs=total_messages,
        )

        logger.info(
            "[%s] Completado: %d producto(s) publicados, total=%d mensajes para '%s'",
            request.search_id, products_published, total_messages, request.query,
        )
