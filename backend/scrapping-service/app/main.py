"""Punto de entrada del Scraper Service.

Arranca en paralelo:
  - ScraperWorker: consumer de la cola de jobs (lógica principal).
  - FastAPI: servidor mínimo para health check y disparo manual de jobs (administración).

Para escalar horizontalmente basta con levantar múltiples réplicas de este servicio;
RabbitMQ distribuirá los mensajes entre ellas automáticamente (competing consumers).
"""
import asyncio
import logging

import uvicorn
from fastapi import FastAPI

from shared.messaging import RabbitMQConnection

from .config import settings
from .worker import ScraperWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── FastAPI (administración/monitorización, no lógica de negocio) ─────────────
app = FastAPI(title="Scraper Service", version="0.1.0")


@app.get("/health", tags=["admin"])
async def health() -> dict:
    return {"status": "ok", "service": "scraper"}


# ── Bootstrap ─────────────────────────────────────────────────────────────────
async def start_worker() -> None:
    connection = RabbitMQConnection(settings.amqp_url)
    await connection.connect()
    worker = ScraperWorker(connection)
    await worker.setup()
    logger.info("ScraperWorker iniciado.")
    await worker.start_consuming()


async def main() -> None:
    worker_task = asyncio.create_task(start_worker())
    config = uvicorn.Config(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level="warning",
    )
    server = uvicorn.Server(config)
    await asyncio.gather(worker_task, server.serve())


if __name__ == "__main__":
    asyncio.run(main())
