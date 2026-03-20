"""shared/messaging.py
Adaptador de mensajería basado en RabbitMQ (aio-pika).

Decisiones de diseño
─────────────────────
Cola/mensajería: RabbitMQ
  - Soporte nativo para Dead Letter Queues (DLQ), colas durables y persistencia.
  - Routing flexible mediante exchanges; ideal para job-queues con prioridades.
  - Escala horizontalmente: múltiples instancias del mismo consumer compiten
    automáticamente por los mensajes (competing consumers).

Serialización: JSON (Pydantic .model_dump_json())
  - Legible por humanos, fácil de depurar.
  - Campos opcionales nuevos no rompen versiones anteriores de consumers.

Estrategia de reintentos
  - Header x-retry-count se incrementa en cada reintento.
  - Backoff exponencial: delay = min(2^n, 30) segundos.
  - Tras MAX_RETRIES intentos el mensaje se envía a la DLQ
    (via NACK + dead-letter-routing de RabbitMQ) para inspección manual.
"""

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import aio_pika
import aio_pika.abc

logger = logging.getLogger(__name__)

# ── Nombres de colas ──────────────────────────────────────────────────────────
QUEUE_SCRAPING_JOBS = "scraping.jobs"
QUEUE_SCRAPING_JOBS_DLQ = "scraping.jobs.dlq"
QUEUE_SCRAPING_RESULTS = "scraping.results"        # Scraper → Normalizer (ScrapingMessage + SearchCompletedMessage)
QUEUE_SCRAPING_RESULTS_DLQ = "scraping.results.dlq"
QUEUE_NORMALIZED_EVENTS = "normalized.events"      # Normalizer → downstream (por job)
QUEUE_NORMALIZED_EVENTS_DLQ = "normalized.events.dlq"
QUEUE_SEARCH_NORMALIZED = "search.normalized"      # Normalizer → downstream (cierre de búsqueda)
QUEUE_SEARCH_NORMALIZED_DLQ = "search.normalized.dlq"

MAX_RETRIES = 3


class RabbitMQConnection:
    """
    Gestiona la conexión robusta (auto-reconexión) a RabbitMQ.
    Reutilizable tanto por publishers como por consumers.
    """

    def __init__(self, amqp_url: str) -> None:
        self._amqp_url = amqp_url
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(self._amqp_url)
        logger.info("Conectado a RabbitMQ: %s", self._amqp_url)

    async def close(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()

    async def channel(self) -> aio_pika.abc.AbstractChannel:
        if not self._connection or self._connection.is_closed:
            raise RuntimeError("Sin conexión a RabbitMQ. Llama a connect() primero.")
        return await self._connection.channel()


class BasePublisher:
    """
    Publisher genérico. Serializa el payload como JSON y lo publica en la cola
    indicada usando el exchange por defecto de RabbitMQ (direct routing).

    Reutiliza un único canal AMQP y cachea las declaraciones de colas
    para evitar overhead en ráfagas de publicación (fan-out de búsquedas).
    """

    def __init__(self, connection: RabbitMQConnection) -> None:
        self._conn = connection
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._declared_queues: set[str] = set()

    async def _get_channel(self) -> aio_pika.abc.AbstractChannel:
        """Devuelve el canal reutilizable; lo crea si no existe o se cerró."""
        if self._channel is None or self._channel.is_closed:
            self._channel = await self._conn.channel()
            self._declared_queues.clear()
        return self._channel

    async def _ensure_queue(self, channel: aio_pika.abc.AbstractChannel, queue_name: str) -> None:
        """Verifica que la cola existe (passive=True) sin re-declararla.
        Los consumers son los responsables de declararlas con sus argumentos
        DLQ correctos. Un publisher que intente re-declarar una cola con
        argumentos distintos recibirá PRECONDITION_FAILED de RabbitMQ."""
        if queue_name not in self._declared_queues:
            await channel.declare_queue(queue_name, durable=True, passive=True)
            self._declared_queues.add(queue_name)

    async def publish(self, queue_name: str, payload: dict[str, Any]) -> None:
        channel = await self._get_channel()
        await self._ensure_queue(channel, queue_name)
        body = json.dumps(payload, default=str).encode()
        message = aio_pika.Message(
            body=body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            content_type="application/json",
        )
        await channel.default_exchange.publish(message, routing_key=queue_name)
        logger.debug("Publicado en '%s': %d bytes", queue_name, len(body))

    async def publish_many(self, queue_name: str, payloads: list[dict[str, Any]]) -> None:
        """Publica múltiples mensajes en la misma cola reutilizando un único canal.
        Ideal para el fan-out de una búsqueda a N fuentes."""
        channel = await self._get_channel()
        await self._ensure_queue(channel, queue_name)
        for payload in payloads:
            body = json.dumps(payload, default=str).encode()
            msg = aio_pika.Message(
                body=body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type="application/json",
            )
            await channel.default_exchange.publish(msg, routing_key=queue_name)
        logger.debug("Publicados %d mensajes en '%s'", len(payloads), queue_name)


class BaseConsumer(ABC):
    """
    Consumer genérico con soporte de reintentos y DLQ.
    Subclasifica e implementa `handle(payload)` con tu lógica de negocio.

    Ciclo de vida de un mensaje:
      - handle() ok  → ACK (message.process() sale sin excepción)
      - handle() falla, retry_count < MAX_RETRIES
          → se publica una copia con x-retry-count incrementado
          → el original se ACKa (no va a DLQ)
      - handle() falla, retry_count >= MAX_RETRIES
          → re-raise → NACK → dead-letter → DLQ
    """

    def __init__(
        self,
        connection: RabbitMQConnection,
        queue_name: str,
        dlq_name: str,
        prefetch_count: int = 1,
    ) -> None:
        self._conn = connection
        self._queue_name = queue_name
        self._dlq_name = dlq_name
        self._prefetch_count = prefetch_count

    async def setup(self) -> None:
        """Declara la cola principal y su DLQ en RabbitMQ."""
        channel = await self._conn.channel()
        await channel.set_qos(prefetch_count=self._prefetch_count)
        # DLQ sin dead-letter propio (evita bucles infinitos)
        await channel.declare_queue(self._dlq_name, durable=True)
        # Cola principal con referencia a la DLQ como dead-letter
        await channel.declare_queue(
            self._queue_name,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": self._dlq_name,
            },
        )
        logger.info("Cola '%s' lista (DLQ: '%s')", self._queue_name, self._dlq_name)

    async def start_consuming(self) -> None:
        """Bloquea indefinidamente procesando mensajes de la cola."""
        channel = await self._conn.channel()
        await channel.set_qos(prefetch_count=self._prefetch_count)
        # Re-declarar idempotentemente para asegurar existencia en el canal actual
        queue = await channel.declare_queue(
            self._queue_name,
            durable=True,
            arguments={
                "x-dead-letter-exchange": "",
                "x-dead-letter-routing-key": self._dlq_name,
            },
        )
        logger.info("Escuchando en '%s'...", self._queue_name)

        concurrency = max(1, self._prefetch_count)
        semaphore = asyncio.Semaphore(concurrency)
        pending: set[asyncio.Task] = set()

        async def _dispatch_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
            try:
                await self._dispatch(message)
            finally:
                semaphore.release()

        try:
            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    await semaphore.acquire()
                    task = asyncio.create_task(_dispatch_message(message))
                    pending.add(task)
                    task.add_done_callback(pending.discard)
        except asyncio.CancelledError:
            logger.info("start_consuming cancelado, esperando tareas pendientes...")
            raise
        finally:
            if pending:
                logger.info("Esperando %d tareas pendientes antes de cerrar...", len(pending))
                await asyncio.gather(*pending, return_exceptions=True)

    async def _dispatch(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        """Deserializa y delega a handle(); gestiona reintentos y DLQ."""
        async with message.process(requeue=False):
            try:
                payload = json.loads(message.body)
                await self.handle(payload)
            except Exception as exc:
                retry_count: int = int((message.headers or {}).get("x-retry-count", 0))
                if retry_count < MAX_RETRIES:
                    delay = min(2 ** (retry_count + 1), 30)
                    logger.warning(
                        "[%s] Error (intento %d/%d), reintentando en %ds: %s",
                        self._queue_name, retry_count + 1, MAX_RETRIES, delay, exc,
                    )
                    await asyncio.sleep(delay)
                    await self._republish(message.body, retry_count + 1)
                    # No re-raise: el context manager ACKa el original;
                    # la copia republida lleva el contador actualizado.
                else:
                    logger.error(
                        "[%s] DLQ tras %d intentos. Payload: %s. Error: %s",
                        self._queue_name, MAX_RETRIES, message.body[:200], exc,
                    )
                    raise  # NACK → dead-letter → DLQ

    async def _get_republish_channel(self) -> aio_pika.abc.AbstractChannel:
        """Canal dedicado para re-publicaciones de reintentos."""
        if not hasattr(self, "_republish_ch") or self._republish_ch is None or self._republish_ch.is_closed:
            self._republish_ch = await self._conn.channel()
        return self._republish_ch

    async def _republish(self, body: bytes, retry_count: int) -> None:
        channel = await self._get_republish_channel()
        new_message = aio_pika.Message(
            body=body,
            headers={"x-retry-count": retry_count},
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            content_type="application/json",
        )
        await channel.default_exchange.publish(new_message, routing_key=self._queue_name)

    @abstractmethod
    async def handle(self, payload: dict[str, Any]) -> None:
        """Implementa aquí la lógica de negocio para procesar el mensaje."""
        ...
