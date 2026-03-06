"""Configuración del Scraper Service via variables de entorno."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # RabbitMQ
    amqp_url: str = "amqp://guest:guest@localhost:5672/"

    # Servidor FastAPI de administración
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    # HTTP scraping
    http_timeout: float = 30.0
    user_agent: str = "PriceTrackerBot/1.0"


settings = Settings()
