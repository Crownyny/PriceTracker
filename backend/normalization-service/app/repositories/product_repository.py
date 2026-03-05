"""repositories/product_repository.py
Repositorio de productos normalizados e historial de precios en PostgreSQL.

Modelos ORM (SQLAlchemy 2.0 async):
  - NormalizedProductORM  → tabla normalized_products
  - PriceHistoryORM       → tabla price_history

Índices implícitos por UniqueConstraint + explícitos recomendados:
    CREATE INDEX ix_price_history_product ON price_history (product_ref, source_name);
    CREATE INDEX ix_price_history_recorded_at ON price_history (recorded_at DESC);
"""
import datetime
import logging
from typing import Optional

from sqlalchemy import JSON, UniqueConstraint, select
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
        UniqueConstraint("product_ref", "source_name", name="uq_product_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_ref: Mapped[str]
    source_name: Mapped[str]
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
        logger.info("Tablas PostgreSQL inicializadas.")

    async def upsert_product(self, product: NormalizedProduct) -> None:
        """INSERT … ON CONFLICT DO UPDATE por (product_ref, source_name)."""
        async with self._session_factory() as session:
            stmt = (
                pg_insert(NormalizedProductORM)
                .values(
                    product_ref=product.product_ref,
                    source_name=product.source_name,
                    canonical_name=product.canonical_name,
                    price=product.price,
                    currency=product.currency,
                    category=product.category,
                    availability=product.availability,
                    updated_at=product.updated_at,
                    image_url=product.image_url,
                    description=product.description,
                    extra=product.extra,
                )
                .on_conflict_do_update(
                    constraint="uq_product_source",
                    set_={
                        "canonical_name": product.canonical_name,
                        "price": product.price,
                        "currency": product.currency,
                        "category": product.category,
                        "availability": product.availability,
                        "updated_at": product.updated_at,
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
                recorded_at=datetime.datetime.now(tz=datetime.timezone.utc),
                job_id=job_id,
            )
            session.add(entry)
            await session.commit()

    async def close(self) -> None:
        await self._engine.dispose()
