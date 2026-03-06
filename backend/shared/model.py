"""shared/model.py
Modelos de datos y contratos de comunicación entre servicios.

Diseño del contrato ScrapingMessage (versión 2.0):
  - Ya NO transporta raw_fields inline.
  - Es un evento puro: solo identifica el job y su estado.
  - El Normalizer recupera los datos crudos de MongoDB usando job_id.
  - Esto desacopla el tamaño del mensaje de la cantidad de datos extraídos.
"""
import uuid
import datetime
from enum import StrEnum
from typing import Any, Optional
from pydantic import BaseModel, Field


class ScrapingState(StrEnum):
    """Ciclo de vida de un job de scraping a través de ambos servicios."""
    PENDING              = "pending"
    SCRAPED              = "scraped"
    FAILED               = "failed"
    NORMALIZED           = "normalized"
    NORMALIZATION_FAILED = "normalization_failed"


# ── Solicitud de búsqueda (origen del fan-out) ───────────────────────────────
class SearchRequest(BaseModel):
    """
    Representa la intención de búsqueda del usuario.
    El Scraper Service usa su SourceRegistry para generar N ScrapingJobs
    (uno por fuente registrada) que comparten el mismo search_id.

    Si `sources` se especifica, solo se buscará en esas fuentes (filtro).
    Si se omite, se busca en todas las fuentes registradas.
    """
    search_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_ref: str
    query: str                                       # Texto libre de búsqueda
    sources: Optional[list[str]] = None               # Filtro opcional de fuentes
    priority: int = 5
    metadata: dict[str, Any] = Field(default_factory=dict)


# ── Job de scraping (entrada al Scraper Service) ──────────────────────────────
class ScrapingJob(BaseModel):
    """Solicitud de scraping. Se publica en la cola de entrada del Scraper Service."""
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    search_id: Optional[str] = None   # Agrupa jobs de la misma búsqueda
    source_url: str
    source_name: str        # "amazon", "mercadolibre", "exito", etc.
    product_ref: str        # Identificador interno del producto/recurso
    priority: int = 5       # 1 (mayor prioridad) → 10 (menor)
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


# ── Evento de comunicación Scraper → Normalizer ─────────────────────────────
class ScrapingMessage(BaseModel):
    """
    Evento publicado por el Scraper cuando termina un job.
    NO transporta raw_fields: el Normalizer los obtiene de MongoDB usando job_id.

    Diseño:
      - Mensaje ligero: sólo el identificador del job y su estado.
      - El Normalizer hace lookup en MongoDB con job_id.
      - `schema_version` permite evolucionar el contrato sin romper consumidores.
    """
    job_id: str
    search_id: Optional[str] = None
    product_ref: str
    source_name: str
    captured_at: datetime.datetime
    state: ScrapingState           # "scraped" | "failed"
    schema_version: str = "2.0"
    error_message: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)





# ── Producto normalizado (salida del Normalizer Service) ──────────────────────
class NormalizedProduct(BaseModel):
    """Representación canónica de un producto. Formato estándar de la plataforma."""
    product_ref: str
    source_name: str
    canonical_name: str
    price: float
    currency: str           # ISO 4217: "COP", "USD", "EUR"
    category: str
    availability: bool
    updated_at: datetime.datetime
    image_url: Optional[str] = None
    description: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


# ── Evento Normalizer → downstream ─────────────────────────────────────────
class NormalizedEventMessage(BaseModel):
    """
    Evento publicado por el Normalizer cuando completa (o falla) la normalización.
    Permite a servicios downstream (notificaciones, alertas de precio) reaccionar.
    Con search_id, downstream puede saber cuándo se completaron todos los
    resultados de una misma búsqueda.
    """
    job_id: str
    search_id: Optional[str] = None
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
