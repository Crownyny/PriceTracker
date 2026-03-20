from .model import (
    ScrapingState,
    SearchRequest,
    ScrapingJob,
    ScrapingMessage,
    RawScrapingResult,
    NormalizedProduct,
    NormalizedEventMessage,
    PriceHistoryEntry,
)

try:
    from .messaging import (
        RabbitMQConnection,
        BasePublisher,
        BaseConsumer,
        QUEUE_SCRAPING_JOBS,
        QUEUE_SCRAPING_JOBS_DLQ,
        QUEUE_SCRAPING_RESULTS,
        QUEUE_SCRAPING_RESULTS_DLQ,
        QUEUE_NORMALIZED_EVENTS,
        QUEUE_NORMALIZED_EVENTS_DLQ,
    )
except ModuleNotFoundError as exc:
    if exc.name != "aio_pika":
        raise

__all__ = [
    "ScrapingState",
    "ScrapingJob",
    "ScrapingMessage",
    "RawScrapingResult",
    "NormalizedProduct",
    "NormalizedEventMessage",
    "PriceHistoryEntry",
]

if "RabbitMQConnection" in globals():
    __all__.extend([
        "RabbitMQConnection",
        "BasePublisher",
        "BaseConsumer",
        "QUEUE_SCRAPING_JOBS",
        "QUEUE_SCRAPING_JOBS_DLQ",
        "QUEUE_SCRAPING_RESULTS",
        "QUEUE_SCRAPING_RESULTS_DLQ",
        "QUEUE_NORMALIZED_EVENTS",
        "QUEUE_NORMALIZED_EVENTS_DLQ",
    ])