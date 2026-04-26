"""repositories/product_repository.py
Repositorio de productos normalizados, historial de precios y
seguimiento de búsquedas en PostgreSQL.

Modelos ORM (SQLAlchemy 2.0 async):
  - NormalizedProductORM  → tabla normalized_products
  - PriceHistoryORM       → tabla price_history
  - SearchTrackingORM     → tabla search_tracking (progreso de normalización)

Índices implícitos por UniqueConstraint + explícitos recomendados:
    CREATE INDEX ix_price_history_product ON price_history (product_ref, source_name);
    CREATE INDEX ix_price_history_recorded_at ON price_history (recorded_at DESC);
"""
import datetime
import logging
import uuid
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from typing import Optional, Tuple

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from shared.model import NormalizedProduct

logger = logging.getLogger(__name__)

_TRACKING_QUERY_PARAMS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
}


def _canonicalize_source_url(source_url: str) -> str:
    """Normaliza URL para asegurar IDs determinísticos y evitar duplicados triviales."""
    trimmed = source_url.strip()
    parsed = urlsplit(trimmed)
    if not parsed.scheme or not parsed.netloc:
        return trimmed

    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if not key.lower().startswith("utm_") and key.lower() not in _TRACKING_QUERY_PARAMS
    ]
    filtered_query.sort()

    normalized = urlunsplit(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path.rstrip("/") or "/",
            urlencode(filtered_query, doseq=True),
            "",
        )
    )
    return normalized


def _build_product_id(source_url: str) -> str:
    """Genera un UUID v5 estable a partir de la URL canónica."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, source_url))


# ── ORM Base ──────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


class NormalizedProductORM(Base):
    __tablename__ = "normalized_products"
    __table_args__ = (
        # Un producto normalizado es único por URL de tienda.
        Index(
            "uq_product_source_url",
            "source_url",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_ref: Mapped[str]
    source_name: Mapped[str]
    source_url: Mapped[str]
    canonical_name: Mapped[str]
    price: Mapped[float]
    currency: Mapped[str]
    category: Mapped[str]
    availability: Mapped[bool]
    updated_at: Mapped[datetime.datetime]
    last_scraped_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    next_scrape_at: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    volatility_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default=text("0"))
    alert_priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    locked_until: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)
    image_url: Mapped[Optional[str]]
    description: Mapped[Optional[str]]
    extra: Mapped[dict] = mapped_column(JSON, default=dict)


class PriceHistoryORM(Base):
    __tablename__ = "price_history"
    __table_args__ = (
        Index("ix_price_history_product_id", "product_id"),
        Index("ix_price_history_recorded_at", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("normalized_products.id"),
    )
    price: Mapped[float]
    currency: Mapped[str]
    recorded_at: Mapped[datetime.datetime]
    job_id: Mapped[str]


class SearchTrackingORM(Base):
    """Seguimiento del progreso de normalización por búsqueda.
    Permite saber cuándo se han procesado todos los jobs de un search_id.
    """
    __tablename__ = "search_tracking"

    search_id: Mapped[str] = mapped_column(primary_key=True)
    product_ref: Mapped[str]
    expected_jobs: Mapped[Optional[int]]   # None hasta que llegue el sentinel
    completed_jobs: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime.datetime]
    updated_at: Mapped[datetime.datetime]


# ── Repositorio ───────────────────────────────────────────────────────────────
class ProductRepository:
    """
        Repositorio de NormalizedProduct e historial de precios en PostgreSQL.

    Upsert strategy:
      - Usa INSERT ... ON CONFLICT DO UPDATE (PostgreSQL nativo, más eficiente
        que SELECT + UPDATE/INSERT separados).
            - La clave de conflicto es source_url (producto único por URL).

    Para desarrollo local sin PostgreSQL:
      - Sustituir database_url por "postgresql+asyncpg://..." en docker-compose.
      - NO compatible con SQLite (usa dialecto pg específico en upsert).
    """

    def __init__(self, database_url: str) -> None:
        # Normalizar URL a formato async
        async_url = database_url
        if database_url.startswith("postgresql://"):
            async_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif database_url.startswith("postgres://"):
            async_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        self._engine = create_async_engine(async_url, echo=False, pool_pre_ping=True)
        self._session_factory = async_sessionmaker(
            self._engine, expire_on_commit=False, class_=AsyncSession
        )

    async def init_tables(self) -> None:
        """Crea las tablas del esquema normalizado. Requiere BD inicializada en limpio."""
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                text(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_product_source_url
                        ON normalized_products (source_url)
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_price_history_product_id
                        ON price_history (product_id)
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_price_history_recorded_at
                        ON price_history (recorded_at DESC)
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS idx_producto_queue
                        ON normalized_products (alert_priority DESC, volatility_score DESC, next_scrape_at ASC)
                        WHERE locked_until IS NULL
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_normalized_products_locked_until
                        ON normalized_products (locked_until)
                    """
                )
            )
        logger.info("Tablas PostgreSQL inicializadas.")

    async def upsert_product(
        self,
        product: NormalizedProduct,
        *,
        next_scrape_at: Optional[datetime.datetime] = None,
        last_scraped_at: Optional[datetime.datetime] = None,
        release_lock: bool = False,
    ) -> str:
        """INSERT … ON CONFLICT DO UPDATE por source_url. Retorna el product_id."""
        if not product.source_url or not product.source_url.strip():
            raise ValueError("source_url es obligatoria para persistir productos normalizados")

        canonical_url = _canonicalize_source_url(product.source_url)
        product_id = _build_product_id(canonical_url)

        def _to_naive(value: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
            if value is None:
                return None
            return value.replace(tzinfo=None) if value.tzinfo else value

        updated_at = _to_naive(product.updated_at)

        persisted_last_scraped_at = _to_naive(last_scraped_at)
        if persisted_last_scraped_at is None and product.scraped_at is not None:
            persisted_last_scraped_at = _to_naive(product.scraped_at)
        if persisted_last_scraped_at is None:
            persisted_last_scraped_at = updated_at

        persisted_next_scrape_at = _to_naive(next_scrape_at)

        insert_values = {
            "id": product_id,
            "product_ref": product.product_ref,
            "source_name": product.source_name,
            "source_url": canonical_url,
            "canonical_name": product.canonical_name,
            "price": product.price,
            "currency": product.currency,
            "category": product.category,
            "availability": product.availability,
            "updated_at": updated_at,
            "last_scraped_at": persisted_last_scraped_at,
            "image_url": product.image_url,
            "description": product.description,
            "extra": product.extra,
        }
        if persisted_next_scrape_at is not None:
            insert_values["next_scrape_at"] = persisted_next_scrape_at
        if release_lock:
            insert_values["locked_until"] = None

        update_values = {
            "product_ref": product.product_ref,
            "source_name": product.source_name,
            "canonical_name": product.canonical_name,
            "price": product.price,
            "currency": product.currency,
            "category": product.category,
            "availability": product.availability,
            "updated_at": updated_at,
            "last_scraped_at": persisted_last_scraped_at,
            "image_url": product.image_url,
            "description": product.description,
            "extra": product.extra,
        }
        if persisted_next_scrape_at is not None:
            update_values["next_scrape_at"] = persisted_next_scrape_at
        if release_lock:
            update_values["locked_until"] = None

        async with self._session_factory() as session:
            stmt = (
                pg_insert(NormalizedProductORM)
                .values(**insert_values)
                .on_conflict_do_update(
                    index_elements=["source_url"],
                    set_=update_values,
                )
                .returning(NormalizedProductORM.id)
            )
            result = await session.execute(stmt)
            await session.commit()
            persisted_id = result.scalar_one()
        logger.info(
            "Producto upserted: %s / %s (id=%s, %.2f %s, next_scrape_at=%s, lock_released=%s)",
            product.source_name,
            product.product_ref,
            persisted_id,
            product.price,
            product.currency,
            persisted_next_scrape_at,
            release_lock,
        )
        return persisted_id

    async def append_price_history(
        self,
        product_id: str,
        price: float,
        currency: str,
        job_id: str,
    ) -> None:
        """Añade una entrada al historial de precios."""
        async with self._session_factory() as session:
            entry = PriceHistoryORM(
                product_id=product_id,
                price=price,
                currency=currency,
                recorded_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
                job_id=job_id,
            )
            session.add(entry)
            await session.commit()

    async def close(self) -> None:
        await self._engine.dispose()

    # ── Tracking de búsquedas ─────────────────────────────────────────────────

    async def record_expected_jobs(
        self, search_id: str, product_ref: str, total_jobs: int
    ) -> Tuple[int, int]:
        """
        Registra el total de jobs esperados para este search_id (upsert).
        Retorna (completed_jobs, total_jobs) tras la operación.
        La operación es atómica: si los jobs ya llegaron antes del sentinel,
        completed_jobs reflejará el valor actual.
        """
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        async with self._session_factory() as session:
            stmt = (
                pg_insert(SearchTrackingORM)
                .values(
                    search_id=search_id,
                    product_ref=product_ref,
                    expected_jobs=total_jobs,
                    completed_jobs=0,
                    created_at=now,
                    updated_at=now,
                )
                .on_conflict_do_update(
                    index_elements=["search_id"],
                    set_={"expected_jobs": total_jobs, "updated_at": now},
                )
                .returning(SearchTrackingORM.__table__.c.completed_jobs)
            )
            result = await session.execute(stmt)
            completed = result.scalar_one()
            await session.commit()
        return completed, total_jobs

    async def increment_completed_jobs(
        self, search_id: str, product_ref: str
    ) -> Tuple[int, Optional[int]]:
        """
        Incrementa atómicamente el contador de jobs completados.
        Si el documento no existe lo crea (puede ocurrir antes de que llegue el sentinel).
        Retorna (nuevo_completed_jobs, expected_jobs).
        expected_jobs es None si el SearchCompletedMessage aún no llegó.
        """
        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        async with self._session_factory() as session:
            stmt = (
                pg_insert(SearchTrackingORM)
                .values(
                    search_id=search_id,
                    product_ref=product_ref,
                    expected_jobs=None,
                    completed_jobs=1,
                    created_at=now,
                    updated_at=now,
                )
                .on_conflict_do_update(
                    index_elements=["search_id"],
                    set_={
                        "completed_jobs": text("search_tracking.completed_jobs + 1"),
                        "updated_at": now,
                    },
                )
                .returning(
                    SearchTrackingORM.__table__.c.completed_jobs,
                    SearchTrackingORM.__table__.c.expected_jobs,
                )
            )
            result = await session.execute(stmt)
            row = result.fetchone()
            await session.commit()
        return row.completed_jobs, row.expected_jobs
