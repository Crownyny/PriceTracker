"""shared/model.py
Modelos de datos y contratos de comunicación entre servicios.

Flujo de mensajes:
  SearchRequest → (fan-out) → ScrapingJob × N → ScrapingMessage × N
                                               → SearchCompletedMessage (sentinel)
"""
import uuid
import datetime
from enum import StrEnum
from typing import Any, Optional
from pydantic import BaseModel, Field


class ScrapingState(StrEnum):
    """Ciclo de vida de un job de scraping a través de ambos servicios and more."""
    PENDING              = "pending"
    SCRAPED              = "scraped"
    FAILED               = "failed"
    NORMALIZED           = "normalized"
    NORMALIZATION_FAILED = "normalization_failed"


# ── Solicitud de búsqueda (entrada de alto nivel al Scraper Service) ──────────
class SearchRequest(BaseModel):
    """
    Solicitud de búsqueda de precio. El worker hace fan-out a N ScrapingJobs,
    uno por cada fuente seleccionada (automatic via SearXNG o manual via `sources`).
    """
    search_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    query: str                              # texto libre: "iPhone 15 Pro 128GB"
    product_ref: str                        # identificador interno del producto
    sources: Optional[list[str]] = None     # None = auto-discovery via SearXNG
    priority: int = 5
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Job de scraping (entrada al Scraper Service) ──────────────────────────────
class ScrapingJob(BaseModel):
    """Solicitud de scraping para una URL/fuente concreta."""
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    search_id: Optional[str] = None         # vínculo con el SearchRequest padre
    source_url: str
    source_name: str                        # "amazon", "mercadolibre", "unknown", …
    product_ref: str
    priority: int = 5
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Resultado interno del Scraper (almacenado en MongoDB) ─────────────────────
class RawScrapingResult(BaseModel):
    """Documento almacenado en MongoDB por el Scraper. Contiene todos los datos crudos."""
    job_id: str
    search_id: Optional[str] = None
    product_ref: str
    source_name: str
    scraped_at: datetime.datetime
    raw_fields: dict[str, Any]
    html_content: Optional[str] = None
    status: str = "success"          # "success" | "failed" | "partial"
    error_message: Optional[str] = None


# ── Evento de comunicación Scraper → Normalizer ──────────────────────────────
class ScrapingMessage(BaseModel):
    """
    Evento publicado por el Scraper cuando termina un job.
    Transporta raw_fields inline (sin lookup a MongoDB).
    """
    job_id: str
    search_id: Optional[str] = None
    product_ref: str
    source_name: str
    captured_at: datetime.datetime
    state: ScrapingState
    raw_fields: dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None


class SearchCompletedMessage(BaseModel):
    """
    Sentinel publicado tras el fan-out de un SearchRequest.
    Indica al Normalizer cuántos ScrapingMessages esperar para este search_id.
    """
    search_id: str
    product_ref: str
    total_jobs: int
    dispatched_at: datetime.datetime
# ── Producto normalizado (salida del Normalizer Service) ──────────────────────
class NormalizedProduct(BaseModel):
    """Representación canónica de un producto. Formato estándar de la plataforma."""
    product_ref: str
    source_name: str
    canonical_name: str
    price: float
    currency: str                            # ISO 4217: "COP", "USD", "EUR"
    category: str
    availability: bool
    updated_at: datetime.datetime
    scraped_at: Optional[datetime.datetime] = None   # Fecha de captura por el scraper
    source_url: Optional[str] = None                 # URL original del producto scrapeado
    confidence: Optional[str] = None                 # "high" | "medium" | "low"
    image_url: Optional[str] = None
    description: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


# ── Evento Normalizer → downstream ─────────────────────────────────────────
class NormalizedEventMessage(BaseModel):
    """
    Evento publicado por el Normalizer cuando completa (o falla) la normalización.
    Permite a servicios downstream (notificaciones, alertas de precio) reaccionar.
    """
    job_id: str
    product_ref: str
    source_name: str
    normalized_at: datetime.datetime
    state: ScrapingState            # "normalized" | "normalization_failed"
    schema_version: str = "2.0"
    error_message: Optional[str] = None


# ── Historial de precios ──────────────────────────────────────────────────────
class PriceHistoryEntry(BaseModel):
    """Entrada del historial de precios (almacenada en PostgreSQL)."""
    product_ref: str
    source_name: str
    price: float
    currency: str
    recorded_at: datetime.datetime
    job_id: str
