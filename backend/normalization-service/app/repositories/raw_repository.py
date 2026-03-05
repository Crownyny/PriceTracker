"""repositories/raw_repository.py
Repositorio de lectura de resultados raw desde MongoDB.

El Normalizer solo LEE de esta colección; el Scraper es quien escribe.
Esto refleja la separación de responsabilidades entre servicios:
  - Scraper  → escribe MongoRawRepository
  - Normalizer → lee MongoRawRepository

Misma colección: pricetracker.raw_scraping_results
"""
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)


class MongoRawRepository:
    """Lee documentos RawScrapingResult desde MongoDB por job_id."""

    def __init__(self, mongo_url: str, db_name: str = "pricetracker") -> None:
        self._client = AsyncIOMotorClient(mongo_url)
        self._col = self._client[db_name]["raw_scraping_results"]

    async def find_by_job_id(self, job_id: str) -> Optional[dict]:
        """
        Recupera el documento raw del job indicado.
        Retorna None si no existe (job no procesado o error de escritura del Scraper).
        """
        doc = await self._col.find_one({"job_id": job_id})
        if doc:
            doc.pop("_id", None)  # Eliminar ObjectId no serializable
        return doc

    async def close(self) -> None:
        self._client.close()
