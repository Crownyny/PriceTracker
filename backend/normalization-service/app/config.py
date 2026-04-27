"""Configuración del Normalizer Service via variables de entorno."""
from pathlib import Path
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

    # Politica matematica para programar el proximo scraping
    scraping_policy_alpha: float = 1.0

    # Archivo de fallos de normalización (JSONL). Vacío = desactivado.
    failures_log_path: str = "/tmp/normalization_failures.jsonl"

    # Validador semántico (2 capas)
    enable_semantic_validator: bool = True
    semantic_config_path: str = str(Path(__file__).resolve().parent / "graph" / "nodes" / "semantic_kb.default.json")
    semantic_embeddings_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    semantic_domain_threshold: Optional[float] = None
    semantic_valid_threshold: Optional[float] = None
    semantic_invalid_threshold: Optional[float] = None
    semantic_top_k: int = 3


settings = Settings()
