"""Repositorio MongoDB para resultados raw del scraping.

Usa motor (driver async de MongoDB) para persistir los documentos
RawScrapingResult. El Normalizer Service lee de esta misma colección
usando el job_id recibido en el evento ScrapingMessage.

Colección: pricetracker.raw_scraping_results
Indices recomendados:
    db.raw_scraping_results.createIndex({ job_id: 1 }, { unique: true })
    db.raw_scraping_results.createIndex({ product_ref: 1, source_name: 1 })
    db.raw_scraping_results.createIndex({ scraped_at: -1 })
"""
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient

from shared.model import RawScrapingResult

logger = logging.getLogger(__name__)


class MongoRawRepository:
    """
    Repositorio de documentos RawScrapingResult en MongoDB.
    Usa replace_one con upsert=True para que un retry del mismo job
    no duplique el documento.
    """

    def __init__(self, mongo_url: str, db_name: str = "pricetracker") -> None:
        self._client = AsyncIOMotorClient(mongo_url)
        self._col = self._client[db_name]["raw_scraping_results"]

    async def save(self, result: RawScrapingResult) -> None:
        """Upsert del documento por job_id. Idempotente ante reintentos."""
        doc = result.model_dump(mode="json")
        await self._col.replace_one({"job_id": result.job_id}, doc, upsert=True)
        logger.info(
            "[%s] RawScrapingResult guardado en MongoDB (status=%s)",
            result.job_id, result.status,
        )

    async def close(self) -> None:
        self._client.close()
