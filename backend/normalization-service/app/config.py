"""Configuración del Normalizer Service via variables de entorno."""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # RabbitMQ
    amqp_url: str = "amqp://guest:guest@localhost:5672/"

    # MongoDB — lectura de resultados raw del Scraper
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "pricetracker"

    # PostgreSQL — escritura de productos normalizados e historial
    # Formato async: postgresql+asyncpg://user:pass@host:5432/db
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pricetracker"

    # FastAPI admin
    api_host: str = "0.0.0.0"
    api_port: int = 8002

    # Enriquecimiento LLM (desactivado por defecto)
    # Proveedor configurable: cualquier BaseChatModel de LangChain
    enable_enricher: bool = False
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"


settings = Settings()
