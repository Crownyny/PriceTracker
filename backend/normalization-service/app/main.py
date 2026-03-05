"""Punto de entrada del Normalizer Service."""
import asyncio
import logging

import uvicorn
from fastapi import FastAPI

from shared.messaging import RabbitMQConnection

from .config import settings
from .repositories.product_repository import ProductRepository
from .repositories.raw_repository import MongoRawRepository
from .worker import NormalizerWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Normalizer Service", version="0.2.0")


@app.get("/health", tags=["admin"])
async def health() -> dict:
    return {"status": "ok", "service": "normalizer"}


async def start_worker() -> None:
    # Inicializar repositorios
    product_repo = ProductRepository(settings.database_url)
    await product_repo.init_tables()  # Crea tablas en PostgreSQL si no existen

    raw_repo = MongoRawRepository(
        mongo_url=settings.mongodb_url,
        db_name=settings.mongodb_db,
    )

    connection = RabbitMQConnection(settings.amqp_url)
    await connection.connect()

    worker = NormalizerWorker(
        connection=connection,
        raw_repo=raw_repo,
        product_repo=product_repo,
    )
    await worker.setup()
    logger.info("NormalizerWorker iniciado.")
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
