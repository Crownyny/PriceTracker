"""Punto de entrada del Scraper Service.

Arranca en paralelo:
  - ScraperWorker: consumer de la cola de jobs (lógica principal).
  - FastAPI: servidor mínimo para health check y disparo manual de jobs.

El worker gestiona el ciclo de vida de Playwright (start/stop)
asegurando que Chromium arranque antes de consumir mensajes y
se cierre limpiamente al apagar el servicio.
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
app = FastAPI(title="Scraper Service", version="0.2.0")


@app.get("/health", tags=["admin"])
async def health() -> dict:
    return {"status": "ok", "service": "scraper"}


# ── Bootstrap ─────────────────────────────────────────────────────────────────
async def start_worker() -> None:
    connection = RabbitMQConnection(settings.amqp_url)
    await connection.connect()
    worker = ScraperWorker(connection)
    await worker.setup()

    # Arrancar Playwright antes de consumir mensajes
    await worker.start()
    logger.info("ScraperWorker + Playwright iniciados.")

    try:
        await worker.start_consuming()
    finally:
        # Garantizar cierre limpio del browser aunque el consumer falle
        await worker.stop()


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
