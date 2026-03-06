"""CLI del Scraper Service.

Permite disparar jobs manualmente para pruebas, sin necesitar
un scheduler ni la API REST.

Modos de uso:

  1) Búsqueda (fan-out automático a todas las fuentes registradas):
    python cli.py search --query "iPhone 15 Pro" --ref "iphone-15-pro"

  2) Búsqueda filtrada por fuentes:
    python cli.py search --query "iPhone 15 Pro" --ref "iphone-15-pro" \\
                         --sources amazon mercadolibre

  3) Job individual (modo legacy):
    python cli.py job --url "https://example.com/product/123" \\
                      --source "example" --ref "prod-123"
"""
import argparse
import asyncio
import logging

from shared.messaging import BasePublisher, RabbitMQConnection, QUEUE_SCRAPING_JOBS
from shared.model import ScrapingJob, SearchRequest

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


async def send_search(amqp_url: str, request: SearchRequest) -> None:
    connection = RabbitMQConnection(amqp_url)
    await connection.connect()
    publisher = BasePublisher(connection)
    await publisher.publish(QUEUE_SCRAPING_JOBS, request.model_dump(mode="json"))
    logger.info("SearchRequest enviado:\n%s", request.model_dump_json(indent=2))
    await connection.close()


async def send_job(amqp_url: str, job: ScrapingJob) -> None:
    connection = RabbitMQConnection(amqp_url)
    await connection.connect()
    publisher = BasePublisher(connection)
    await publisher.publish(QUEUE_SCRAPING_JOBS, job.model_dump(mode="json"))
    logger.info("Job enviado exitosamente:\n%s", job.model_dump_json(indent=2))
    await connection.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="CLI del Scraper Service.")
    parser.add_argument(
        "--amqp-url",
        default="amqp://guest:guest@localhost:5672/",
        help="URL de conexión a RabbitMQ",
    )
    subparsers = parser.add_subparsers(dest="command", help="Modo de operación")

    # ── Subcomando: search (fan-out) ──────────────────────────────────────────
    search_parser = subparsers.add_parser("search", help="Búsqueda con fan-out automático")
    search_parser.add_argument("--query", required=True, help="Texto de búsqueda")
    search_parser.add_argument("--ref", required=True, help="Identificador del producto")
    search_parser.add_argument("--sources", nargs="*", default=None,
                               help="Filtrar fuentes (omitir para todas)")
    search_parser.add_argument("--priority", type=int, default=5)

    # ── Subcomando: job (individual) ──────────────────────────────────────────
    job_parser = subparsers.add_parser("job", help="Job individual (una URL, una fuente)")
    job_parser.add_argument("--url", required=True, help="URL a scrapear")
    job_parser.add_argument("--source", required=True, help="Nombre de la fuente")
    job_parser.add_argument("--ref", required=True, help="Identificador del producto")
    job_parser.add_argument("--search-id", default=None)
    job_parser.add_argument("--priority", type=int, default=5)

    args = parser.parse_args()

    if args.command == "search":
        request = SearchRequest(
            product_ref=args.ref,
            query=args.query,
            sources=args.sources,
            priority=args.priority,
        )
        asyncio.run(send_search(args.amqp_url, request))
    elif args.command == "job":
        job = ScrapingJob(
            source_url=args.url,
            source_name=args.source,
            product_ref=args.ref,
            search_id=args.search_id,
            priority=args.priority,
        )
        asyncio.run(send_job(args.amqp_url, job))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
