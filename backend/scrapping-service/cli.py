"""CLI del Scraper Service.

Permite disparar un ScrapingJob manualmente para pruebas, sin necesitar
un scheduler ni la API REST.

Uso:
    # Desde backend/scrapping-service/
    python cli.py --url "https://example.com/product/123" \\
                  --source "example" \\
                  --ref "prod-123" \\
                  --priority 3

    # Con RabbitMQ en host personalizado:
    python cli.py --url "..." --source "..." --ref "..." \\
                  --amqp-url "amqp://user:pass@rabbit-host:5672/"
"""
import argparse
import asyncio
import logging

from shared.messaging import BasePublisher, RabbitMQConnection, QUEUE_SCRAPING_JOBS
from shared.model import ScrapingJob

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def send_job(amqp_url: str, job: ScrapingJob) -> None:
    connection = RabbitMQConnection(amqp_url)
    await connection.connect()
    publisher = BasePublisher(connection)
    await publisher.publish(QUEUE_SCRAPING_JOBS, job.model_dump(mode="json"))
    logger.info("Job enviado exitosamente:\n%s", job.model_dump_json(indent=2))
    await connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Dispara un ScrapingJob manualmente.")
    parser.add_argument("--url", required=True, help="URL a scrapear")
    parser.add_argument("--source", required=True, help="Nombre de la fuente (ej: amazon)")
    parser.add_argument("--ref", required=True, help="Identificador interno del producto")
    parser.add_argument("--priority", type=int, default=5, help="Prioridad 1-10 (default: 5)")
    parser.add_argument(
        "--amqp-url",
        default="amqp://guest:guest@localhost:5672/",
        help="URL de conexión a RabbitMQ",
    )
    args = parser.parse_args()

    job = ScrapingJob(
        source_url=args.url,
        source_name=args.source,
        product_ref=args.ref,
        priority=args.priority,
    )
    asyncio.run(send_job(args.amqp_url, job))


if __name__ == "__main__":
    main()
