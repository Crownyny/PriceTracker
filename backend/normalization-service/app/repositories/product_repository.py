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
from typing import Optional, Tuple

from sqlalchemy import JSON, Index, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from shared.model import NormalizedProduct

logger = logging.getLogger(__name__)


# ── ORM Base ──────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


class NormalizedProductORM(Base):
    __tablename__ = "normalized_products"
    __table_args__ = (
        # NULLS NOT DISTINCT: (ref, source, NULL) == (ref, source, NULL) → misma fila.
        # Permite múltiples URLs distintas del mismo source para el mismo product_ref.
        Index(
            "uq_product_source",
            "product_ref", "source_name", "source_url",
            unique=True,
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_ref: Mapped[str]
    source_name: Mapped[str]
    source_url: Mapped[Optional[str]]
    canonical_name: Mapped[str]
    price: Mapped[float]
    currency: Mapped[str]
    category: Mapped[str]
    availability: Mapped[bool]
    updated_at: Mapped[datetime.datetime]
    image_url: Mapped[Optional[str]]
    description: Mapped[Optional[str]]
    extra: Mapped[dict] = mapped_column(JSON, default=dict)


class PriceHistoryORM(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_ref: Mapped[str]
    source_name: Mapped[str]
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
      - La clave de conflicto es (product_ref, source_name).

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
        """Crea las tablas si no existen. Llamar una vez al arranque del servicio."""
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Migración para instalaciones existentes: añade source_url y reemplaza
            # el antiguo CONSTRAINT único por un INDEX NULLS NOT DISTINCT que incluye
            # source_url, de modo que cada URL distinta de una misma fuente se guarda
            # como fila independiente.
            await conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'normalized_products'
                          AND column_name = 'source_url'
                    ) THEN
                        ALTER TABLE normalized_products ADD COLUMN source_url VARCHAR;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uq_product_source' AND contype = 'u'
                    ) THEN
                        ALTER TABLE normalized_products DROP CONSTRAINT uq_product_source;
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE tablename = 'normalized_products'
                          AND indexname = 'uq_product_source'
                    ) THEN
                        CREATE UNIQUE INDEX uq_product_source
                            ON normalized_products (product_ref, source_name, source_url)
                            NULLS NOT DISTINCT;
                    END IF;
                END $$;
            """))
        logger.info("Tablas PostgreSQL inicializadas.")

    async def upsert_product(self, product: NormalizedProduct) -> None:
        """INSERT … ON CONFLICT DO UPDATE por (product_ref, source_name, source_url)."""
        updated_at = product.updated_at.replace(tzinfo=None) if product.updated_at.tzinfo else product.updated_at
        async with self._session_factory() as session:
            stmt = (
                pg_insert(NormalizedProductORM)
                .values(
                    product_ref=product.product_ref,
                    source_name=product.source_name,
                    source_url=product.source_url,
                    canonical_name=product.canonical_name,
                    price=product.price,
                    currency=product.currency,
                    category=product.category,
                    availability=product.availability,
                    updated_at=updated_at,
                    image_url=product.image_url,
                    description=product.description,
                    extra=product.extra,
                )
                .on_conflict_do_update(
                    index_elements=["product_ref", "source_name", "source_url"],
                    set_={
                        "canonical_name": product.canonical_name,
                        "price": product.price,
                        "currency": product.currency,
                        "category": product.category,
                        "availability": product.availability,
                        "updated_at": updated_at,
                        "image_url": product.image_url,
                        "description": product.description,
                        "extra": product.extra,
                    },
                )
            )
            await session.execute(stmt)
            await session.commit()
        logger.info(
            "Producto upserted: %s / %s (%.2f %s)",
            product.source_name, product.product_ref, product.price, product.currency,
        )

    async def append_price_history(
        self,
        product_ref: str,
        source_name: str,
        price: float,
        currency: str,
        job_id: str,
    ) -> None:
        """Añade una entrada al historial de precios."""
        async with self._session_factory() as session:
            entry = PriceHistoryORM(
                product_ref=product_ref,
                source_name=source_name,
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
