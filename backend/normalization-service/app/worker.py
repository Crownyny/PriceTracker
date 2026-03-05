"""Worker principal del Normalizer Service.

Flujo por mensaje recibido:
    1. Recibe ScrapingMessage (evento puro) desde la cola.
    2. Invoca el pipeline LangGraph con el estado inicial del job.
    3. El grafo:
       a. fetch_raw  → recupera RawScrapingResult de MongoDB
       b. clean      → aplica reglas deterministas (DefaultNormalizer)
       c. [enrich]   → enriquecimiento LLM opcional
       d. validate   → valida reglas de negocio (ProductValidator)
       e. save       → upsert en PostgreSQL + historial de precios
    4. Publica NormalizedEventMessage con el resultado.
"""
import datetime
import logging
from typing import Any

from shared.messaging import (
    BaseConsumer,
    BasePublisher,
    RabbitMQConnection,
    QUEUE_NORMALIZED_EVENTS,
    QUEUE_SCRAPING_RESULTS,
    QUEUE_SCRAPING_RESULTS_DLQ,
)
from shared.model import (
    NormalizedEventMessage,
    ScrapingMessage,
    ScrapingState,
)

from .config import settings
from .graph.pipeline import build_pipeline
from .repositories.product_repository import ProductRepository
from .repositories.raw_repository import MongoRawRepository

logger = logging.getLogger(__name__)


class NormalizerWorker(BaseConsumer):
    """
    Consumer de ScrapingMessage.
    Orquesta el pipeline LangGraph y publica el evento de resultado.
    """

    def __init__(
        self,
        connection: RabbitMQConnection,
        raw_repo: MongoRawRepository,
        product_repo: ProductRepository,
    ) -> None:
        super().__init__(
            connection=connection,
            queue_name=QUEUE_SCRAPING_RESULTS,
            dlq_name=QUEUE_SCRAPING_RESULTS_DLQ,
        )
        self._publisher = BasePublisher(connection)

        llm = None
        if settings.enable_enricher and settings.openai_api_key:
            try:
                from langchain_openai import ChatOpenAI
                llm = ChatOpenAI(
                    model=settings.openai_model,
                    api_key=settings.openai_api_key,
                    temperature=0,
                )
                logger.info("LLM enriquecimiento habilitado: %s", settings.openai_model)
            except ImportError:
                logger.warning(
                    "langchain-openai no instalado. Enriquecimiento LLM deshabilitado."
                )

        self._pipeline = build_pipeline(
            raw_repo=raw_repo,
            product_repo=product_repo,
            llm=llm,
            enable_enricher=settings.enable_enricher,
        )

    async def handle(self, payload: dict[str, Any]) -> None:
        message = ScrapingMessage.model_validate(payload)
        logger.info(
            "[%s] Normalizando: %s / %s (state=%s)",
            message.job_id, message.source_name, message.product_ref, message.state,
        )

        initial_state = {
            "job_id": message.job_id,
            "product_ref": message.product_ref,
            "source_name": message.source_name,
            "captured_at": message.captured_at.isoformat(),
            "raw_document": None,
            "cleaned_product": None,
            "enrichment_updates": None,
            "final_product": None,
            "validation_errors": [],
            "error": None,
            "outcome": ScrapingState.NORMALIZATION_FAILED,
        }

        final_state = await self._pipeline.ainvoke(initial_state)

        event = NormalizedEventMessage(
            job_id=message.job_id,
            product_ref=message.product_ref,
            source_name=message.source_name,
            normalized_at=datetime.datetime.now(tz=datetime.timezone.utc),
            state=ScrapingState(final_state.get("outcome", ScrapingState.NORMALIZATION_FAILED)),
            error_message=final_state.get("error"),
        )
        await self._publisher.publish(QUEUE_NORMALIZED_EVENTS, event.model_dump(mode="json"))

        logger.info(
            "[%s] Normalización finalizada: outcome=%s",
            message.job_id, event.state,
        )
import datetime
import logging
from typing import Any

from shared.messaging import (
    BaseConsumer,
    RabbitMQConnection,
    QUEUE_SCRAPING_RESULTS,
    QUEUE_SCRAPING_RESULTS_DLQ,
)
from shared.model import PriceHistoryEntry, ScrapingMessage

from .config import settings
from .enricher import LLMEnricher, NoOpEnricher
from .normalizer.rules import DefaultNormalizer
from .storage import NormalizerStorage
from .validator import ProductValidator, ValidationError

logger = logging.getLogger(__name__)


class NormalizerWorker(BaseConsumer):
    """
    Consumer de ScrapingMessage.
    Orquesta: normalización → enriquecimiento → validación → persistencia.
    """

    def __init__(self, connection: RabbitMQConnection) -> None:
        super().__init__(
            connection=connection,
            queue_name=QUEUE_SCRAPING_RESULTS,
            dlq_name=QUEUE_SCRAPING_RESULTS_DLQ,
        )
        self._normalizer = DefaultNormalizer()
        # El enriquecedor se inyecta según configuración; NoOpEnricher es el default seguro
        self._enricher = (
            LLMEnricher(settings.openai_api_key)
            if settings.enable_enricher and settings.openai_api_key
            else NoOpEnricher()
        )
        self._storage = NormalizerStorage()
        self._validator = ProductValidator()

    async def handle(self, payload: dict[str, Any]) -> None:
        message = ScrapingMessage.model_validate(payload)
        logger.info(
            "[%s] Normalizando: %s / %s",
            message.job_id, message.source_name, message.product_ref,
        )

        # 1. Normalización determinista
        product = await self._normalizer.normalize(message)

        # 2. Enriquecimiento semántico (opcional, stub por defecto)
        product = await self._enricher.enrich(product)

        # 3. Validación de reglas de negocio
        try:
            self._validator.validate(product)
        except ValidationError as exc:
            logger.warning("[%s] Producto descartado por validación: %s", message.job_id, exc)
            return  # No persistir productos inválidos

        # 4. Persistencia del producto normalizado
        await self._storage.upsert_product(product)

        # 5. Actualizar historial de precios
        await self._storage.append_price_history(
            PriceHistoryEntry(
                product_ref=product.product_ref,
                source_name=product.source_name,
                price=product.price,
                currency=product.currency,
                recorded_at=datetime.datetime.now(tz=datetime.timezone.utc),
                job_id=message.job_id,
            )
        )

        logger.info(
            "[%s] Normalización completada: %s / %s → %.2f %s",
            message.job_id, product.source_name, product.product_ref,
            product.price, product.currency,
        )
