"""Worker principal del Normalizer Service.

Flujo por mensaje recibido:

    A) ScrapingMessage (job individual):
        1. Recibe ScrapingMessage con raw_fields embebidos desde la cola.
        2. Si el scraping falló, publica NormalizedEventMessage de error directamente.
        3. Si tuvo éxito, invoca el pipeline LangGraph con raw_fields en el estado.
        4. El grafo:
           a. fetch_raw  → valida que hay raw_fields (ya no lee de MongoDB)
           b. clean      → aplica reglas deterministas (DefaultNormalizer)
           c. [enrich]   → enriquecimiento LLM opcional
           d. validate   → valida reglas de negocio (ProductValidator)
           e. save       → upsert en PostgreSQL + historial de precios
        5. Publica NormalizedEventMessage con el resultado.
        6. Incrementa el contador de jobs completados en PostgreSQL.
        7. Si completed == expected: publica SearchNormalizedMessage (cierre).

    B) SearchCompletedMessage (sentinel del Scraper):
        1. Recibe el sentinel que indica cuántos jobs se despacharon.
        2. Registra expected_jobs en PostgreSQL (atómico).
        3. Si todos los jobs ya llegaron (completed == expected):
           publica SearchNormalizedMessage de inmediato.
"""
import asyncio
import datetime
import logging
from typing import Any, Optional

from shared.messaging import (
    BaseConsumer,
    BasePublisher,
    RabbitMQConnection,
    QUEUE_NORMALIZED_EVENTS,
    QUEUE_NORMALIZED_EVENTS_DLQ,
    QUEUE_SCRAPING_RESULTS,
    QUEUE_SCRAPING_RESULTS_DLQ,
    QUEUE_SEARCH_NORMALIZED,
    QUEUE_SEARCH_NORMALIZED_DLQ,
)
from shared.model import (
    NormalizedEventMessage,
    ScrapingMessage,
    ScrapingState,
    SearchCompletedMessage,
    SearchNormalizedMessage,
)

from .config import settings
from .graph.pipeline import build_pipeline
from .repositories.product_repository import ProductRepository

logger = logging.getLogger(__name__)


class NormalizerWorker(BaseConsumer):
    """
    Consumer de ScrapingMessage y SearchCompletedMessage.
    Orquesta el pipeline LangGraph y gestiona el ciclo de vida de cada búsqueda.
    """

    def __init__(
        self,
        connection: RabbitMQConnection,
        product_repo: ProductRepository,
    ) -> None:
        super().__init__(
            connection=connection,
            queue_name=QUEUE_SCRAPING_RESULTS,
            dlq_name=QUEUE_SCRAPING_RESULTS_DLQ,
            prefetch_count=settings.normalizer_prefetch_count,
        )
        self._publisher = BasePublisher(connection)
        self._product_repo = product_repo

        llm = None
        if settings.enable_enricher and settings.openai_api_key:
            try:
                from langchain_openai import ChatOpenAI
                kwargs: dict = {
                    "model": settings.openai_model,
                    "api_key": settings.openai_api_key,
                    "temperature": 0,
                }
                if settings.openai_base_url:
                    kwargs["base_url"] = settings.openai_base_url
                llm = ChatOpenAI(**kwargs)
                logger.info("LLM enriquecimiento habilitado: %s", settings.openai_model)
            except ImportError:
                logger.warning(
                    "langchain-openai no instalado. Enriquecimiento LLM deshabilitado."
                )

        self._pipeline = build_pipeline(
            product_repo=product_repo,
            llm=llm,
            enable_enricher=settings.enable_enricher,
        )

    async def setup(self) -> None:
        """Declara colas de entrada (scraping.results) y de salida (normalized.events, search.normalized)."""
        await super().setup()
        channel = await self._conn.channel()
        await channel.declare_queue(QUEUE_NORMALIZED_EVENTS_DLQ, durable=True)
        await channel.declare_queue(
            QUEUE_NORMALIZED_EVENTS,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": QUEUE_NORMALIZED_EVENTS_DLQ,
            },
        )
        await channel.declare_queue(QUEUE_SEARCH_NORMALIZED_DLQ, durable=True)
        await channel.declare_queue(
            QUEUE_SEARCH_NORMALIZED,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": QUEUE_SEARCH_NORMALIZED_DLQ,
            },
        )
        logger.info("Colas de salida declaradas: '%s', '%s'", QUEUE_NORMALIZED_EVENTS, QUEUE_SEARCH_NORMALIZED)

    async def start_consuming(self) -> None:
        """Override: procesamiento concurrente de mensajes con semáforo."""
        channel = await self._conn.channel()
        await channel.set_qos(prefetch_count=self._prefetch_count)
        queue = await channel.declare_queue(
            self._queue_name,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": self._dlq_name,
            },
        )
        sem = asyncio.Semaphore(self._prefetch_count)
        tasks: set[asyncio.Task] = set()

        async def _bounded(msg):
            async with sem:
                await self._dispatch(msg)

        logger.info(
            "Escuchando en '%s' (concurrencia: %d)...",
            self._queue_name, self._prefetch_count,
        )
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                task = asyncio.create_task(_bounded(message))
                tasks.add(task)
                task.add_done_callback(tasks.discard)

    async def handle(self, payload: dict[str, Any]) -> None:
        # Discriminar entre sentinel y job individual por el campo exclusivo del sentinel
        if "total_jobs" in payload:
            await self._handle_search_completed(payload)
        else:
            await self._handle_scraping_message(payload)

    # ── Flujo A: job individual ──────────────────────────────────────────────

    async def _handle_scraping_message(self, payload: dict[str, Any]) -> None:
        message = ScrapingMessage.model_validate(payload)
        logger.info(
            "[%s] Normalizando: %s / %s (state=%s)",
            message.job_id, message.source_name, message.product_ref, message.state,
        )

        if message.state == ScrapingState.FAILED:
            # Short-circuit: el scraping ya falló, no hay datos que normalizar
            event = NormalizedEventMessage(
                job_id=message.job_id,
                search_id=message.search_id,
                product_ref=message.product_ref,
                source_name=message.source_name,
                normalized_at=datetime.datetime.now(tz=datetime.timezone.utc),
                state=ScrapingState.NORMALIZATION_FAILED,
                error_message=message.error_message or "El scraping del job había fallado",
            )
        else:
            initial_state = {
                "job_id": message.job_id,
                "product_ref": message.product_ref,
                "source_name": message.source_name,
                "captured_at": message.captured_at.isoformat(),
                "raw_fields": message.raw_fields,
                "sanitized_product": None,
                "product_invalid": False,
                "standardized_product": None,
                "canonical_text": None,
                "heuristic_attributes": None,
                "heuristic_confidence": None,
                "llm_attributes": None,
                "merged_attributes": None,
                "normalized_product": None,
                "final_confidence": None,
                "final_product": None,
                "validation_errors": [],
                "error": None,
                "outcome": ScrapingState.NORMALIZATION_FAILED,
            }
            final_state = await self._pipeline.ainvoke(initial_state)

            event = NormalizedEventMessage(
                job_id=message.job_id,
                search_id=message.search_id,
                product_ref=message.product_ref,
                source_name=message.source_name,
                normalized_at=datetime.datetime.now(tz=datetime.timezone.utc),
                state=ScrapingState(final_state.get("outcome", ScrapingState.NORMALIZATION_FAILED)),
                error_message=final_state.get("error"),
            )

        await self._publisher.publish(QUEUE_NORMALIZED_EVENTS, event.model_dump(mode="json"))
        logger.info("[%s] Normalización finalizada: outcome=%s", message.job_id, event.state)

        # Tracking: incrementar y verificar si la búsqueda está completa
        if message.search_id:
            completed, expected = await self._product_repo.increment_completed_jobs(
                message.search_id, message.product_ref
            )
            await self._check_search_complete(
                search_id=message.search_id,
                product_ref=message.product_ref,
                completed=completed,
                expected=expected,
            )

    # ── Flujo B: sentinel de fin de fan-out ──────────────────────────────────

    async def _handle_search_completed(self, payload: dict[str, Any]) -> None:
        msg = SearchCompletedMessage.model_validate(payload)
        logger.info(
            "[%s] SearchCompletedMessage recibido: %d jobs esperados",
            msg.search_id, msg.total_jobs,
        )
        completed, expected = await self._product_repo.record_expected_jobs(
            search_id=msg.search_id,
            product_ref=msg.product_ref,
            total_jobs=msg.total_jobs,
        )
        await self._check_search_complete(
            search_id=msg.search_id,
            product_ref=msg.product_ref,
            completed=completed,
            expected=expected,
        )

    # ── Verificación de completitud ────────────────────────────────────────

    async def _check_search_complete(
        self,
        search_id: str,
        product_ref: str,
        completed: int,
        expected: Optional[int],
    ) -> None:
        """Publica SearchNormalizedMessage cuando todos los jobs están procesados."""
        if expected is None or completed != expected:
            return

        close_event = SearchNormalizedMessage(
            search_id=search_id,
            product_ref=product_ref,
            total_normalized=completed,
            completed_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )
        await self._publisher.publish(
            QUEUE_SEARCH_NORMALIZED, close_event.model_dump(mode="json")
        )
        logger.info(
            "[%s] Búsqueda completamente normalizada: %d/%d jobs → SearchNormalizedMessage publicado",
            search_id, completed, expected,
        )
