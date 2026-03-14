"""Configuración del Normalizer Service via variables de entorno."""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # RabbitMQ
    amqp_url: str = "amqp://guest:guest@localhost:5672/"

    # PostgreSQL — escritura de productos normalizados, historial y tracking
    # Formato async: postgresql+asyncpg://user:pass@host:5432/db
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pricetracker"

    # FastAPI admin
    api_host: str = "0.0.0.0"
    api_port: int = 8002

    # Enriquecimiento LLM (desactivado por defecto)
    enable_enricher: bool = False
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: Optional[str] = None    # Para modelos locales (Ollama, vLLM, etc.)

    # Concurrencia: mensajes procesados en paralelo dentro del worker
    normalizer_prefetch_count: int = 4

    # Archivo de fallos de normalización (JSONL). Vacío = desactivado.
    failures_log_path: str = "/tmp/normalization_failures.jsonl"


settings = Settings()
