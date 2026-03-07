"""Configuración del Scraper Service via variables de entorno."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # RabbitMQ
    amqp_url: str = "amqp://guest:guest@localhost:5672/"

    # Servidor FastAPI de administración
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    # Playwright
    user_agent: str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    http_timeout: float = 30.0

    # SearXNG — discovery de URLs de producto
    searxng_url: str = "http://searxng:8080"
    searxng_max_results: int = 10


settings = Settings()
