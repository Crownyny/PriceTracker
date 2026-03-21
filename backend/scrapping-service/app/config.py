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

    # Proxy residencial rotativo (opcional).
    # Formato: http://usuario:password@host:puerto
    # Ejemplo Smartproxy: http://user:pass@gate.smartproxy.com:10000
    # Dejar vacío para no usar proxy.
    residential_proxy_url: str = ""

    # Concurrencia: cuantos SearchRequest puede atender este worker en paralelo.
    # Ajusta según capacidad de Playwright + CPU/memoria.
    worker_prefetch_count: int = 5

    # Fuentes por defecto a usar cuando no se especifican en la request.
    # Lista de nombres de fuentes separadas por coma.
    # Por defecto: solo fuentes de electrónica.
    default_sources: str = "aliexpress,alkomprar,alkosto,amazon,computienda,exito,falabella,ishop,jumbo,mercadolibre,olimpica,tecnoplaza"

    # Relevancia de resultados (fácil de desactivar por env var)
    enable_relevance_guard: bool = True
    relevance_min_score: float = 0.35


settings = Settings()
