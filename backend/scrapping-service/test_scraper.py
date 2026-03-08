"""Script de prueba standalone del Scraper Service.

Ejecuta el scraping directamente sin necesitar RabbitMQ ni el Normalizer.
Los resultados se imprimen como JSON en stdout.

Uso:
    # Todas las fuentes registradas
    python test_scraper.py "samsung galaxy s24"

    # Fuentes específicas
    python test_scraper.py "samsung galaxy s24" --sources amazon mercadolibre

    # Guardar resultados en archivo
    python test_scraper.py "samsung galaxy s24" --output resultados.json
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Añadir el directorio padre al path para que `shared` sea importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.model import ScrapingJob, SearchRequest

from app.scraper.playwright_scraper import PlaywrightScraper
from app.sources import registry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def run_scraping(query: str, sources_filter: list[str] | None, user_agent: str) -> list[dict]:
    """
    Ejecuta el scraping en paralelo en todas las fuentes seleccionadas.
    Devuelve lista de dicts con los raw_fields de cada fuente.
    """
    sources = registry.filter(sources_filter) if sources_filter else registry.all()

    if not sources:
        logger.error("No hay fuentes registradas. Verifica app/sources/__init__.py")
        return []

    logger.info(
        "Iniciando scraping de '%s' en %d fuente(s): %s",
        query, len(sources), ", ".join(s.source_name for s in sources),
    )

    # Crear un ScrapingJob por fuente
    search_id = "test-" + query[:20].replace(" ", "-")
    jobs = [
        ScrapingJob(
            search_id=search_id,
            source_url=source.build_url(query, "test-ref"),
            source_name=source.source_name,
            product_ref="test-ref",
            metadata={"query": query},
        )
        for source in sources
    ]

    # Lanzar Playwright, scrapear en paralelo y cerrar
    scraper = PlaywrightScraper(registry=registry, user_agent=user_agent)
    await scraper.start()

    try:
        raw_results = await asyncio.gather(
            *[scraper.scrape(job) for job in jobs],
            return_exceptions=True,
        )
    finally:
        await scraper.stop()

    # Construir lista de resultados para imprimir
    output = []
    for job, result in zip(jobs, raw_results):
        if isinstance(result, BaseException):
            output.append({
                "source": job.source_name,
                "url": job.source_url,
                "status": "error",
                "error": str(result),
                "raw_fields": None,
            })
        else:
            output.append({
                "source": result.source_name,
                "url": job.source_url,
                "status": result.status,
                "error": result.error_message,
                "raw_fields": result.raw_fields,
            })

    return output


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prueba el Scraper Service sin RabbitMQ.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("query", help="Cadena de búsqueda (ej: 'iphone 15 pro')")
    parser.add_argument(
        "--sources", nargs="*", default=None,
        metavar="FUENTE",
        help="Filtrar fuentes: amazon mercadolibre exito  (omitir = todas)",
    )
    parser.add_argument(
        "--output", default=None, metavar="ARCHIVO",
        help="Guardar resultados en un archivo JSON (por defecto: stdout)",
    )
    parser.add_argument(
        "--user-agent",
        default="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        help="User-Agent HTTP a usar",
    )
    args = parser.parse_args()

    results = asyncio.run(run_scraping(args.query, args.sources, args.user_agent))

    json_output = json.dumps(results, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(json_output, encoding="utf-8")
        logger.info("Resultados guardados en '%s'", args.output)
    else:
        print(json_output)

    # Resumen
    ok = sum(1 for r in results if r["status"] == "success")
    failed = len(results) - ok
    logger.info("Resumen: %d/%d fuentes exitosas", ok, len(results))
    if failed:
        logger.warning("%d fuente(s) fallaron", failed)


if __name__ == "__main__":
    main()
