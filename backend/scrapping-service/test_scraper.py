"""Script de prueba standalone del Scraper Service.

Ejecuta el scraping directamente sin necesitar RabbitMQ ni el Normalizer.
Los resultados se exportan siempre a temp/results.json (se sobreescribe).
Los logs de progreso van solo a la terminal.

Uso:
    # Todas las fuentes registradas
    python test_scraper.py "samsung galaxy s24"

    # Fuentes específicas
    python test_scraper.py "samsung galaxy s24" --sources amazon mercadolibre

    # Limitar resultados por fuente
    python test_scraper.py "samsung galaxy s24" --limit 5
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Añadir el directorio padre al path para que `shared` sea importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.model import ScrapingJob

from app.scraper.playwright_scraper import PlaywrightScraper
from app.sources import registry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Ruta fija de salida (relativa al script)
_OUTPUT_FILE = Path(__file__).parent / "temp" / "results.json"


async def _collect_job_results(scraper: PlaywrightScraper, job: ScrapingJob) -> list:
    """Consume el async generator del scraper y acumula sus resultados."""
    return [result async for result in scraper.scrape(job)]


async def run_scraping(query: str, sources_filter: list[str] | None, user_agent: str, limit: int | None) -> list[dict]:
    """
    Ejecuta el scraping en paralelo en todas las fuentes seleccionadas.
    Devuelve lista de dicts agrupados por fuente, con todos los productos encontrados.
    Cada producto de la misma búsqueda comparte el mismo job_id.
    """
    sources = registry.filter(sources_filter) if sources_filter else registry.all()

    if not sources:
        logger.error("No hay fuentes registradas. Verifica app/sources/__init__.py")
        return []

    logger.info(
        "Iniciando scraping de '%s' en %d fuente(s): %s",
        query, len(sources), ", ".join(s.source_name for s in sources),
    )

    # Crear un ScrapingJob por fuente (job_id compartido por todos sus productos)
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
            *[_collect_job_results(scraper, job) for job in jobs],
            return_exceptions=True,
        )
    finally:
        await scraper.stop()

    # Construir salida agrupada por fuente
    output = []
    for job, results in zip(jobs, raw_results):
        if isinstance(results, BaseException):
            output.append({
                "source": job.source_name,
                "job_id": job.job_id,
                "url": job.source_url,
                "status": "error",
                "error": str(results),
                "total_products": 0,
                "products": [],
            })
        else:
            products = results if limit is None else results[:limit]
            output.append({
                "source": job.source_name,
                "job_id": job.job_id,
                "url": job.source_url,
                "status": "success" if products else "empty",
                "error": None,
                "total_products": len(products),
                "products": [r.raw_fields for r in products],
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
        "--limit", type=int, default=None, metavar="N",
        help="Máximo de productos a mostrar por fuente (por defecto: todos)",
    )
    parser.add_argument(
        "--user-agent",
        default="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        help="User-Agent HTTP a usar",
    )
    args = parser.parse_args()

    results = asyncio.run(run_scraping(args.query, args.sources, args.user_agent, args.limit))

    # JSON de salida: solo la búsqueda y los resultados
    export = {
        "query": args.query,
        "results": results,
    }

    _OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    _OUTPUT_FILE.write_text(json.dumps(export, ensure_ascii=False, indent=2), encoding="utf-8")

    # Resumen en terminal
    total_products = sum(r["total_products"] for r in results)
    ok = sum(1 for r in results if r["status"] == "success")
    failed = sum(1 for r in results if r["status"] == "error")

    print("\n" + "─" * 48)
    print(f"  Resultados para: '{args.query}'")
    print("─" * 48)
    for r in results:
        status_icon = "✓" if r["status"] == "success" else ("✗" if r["status"] == "error" else "·")
        count = r["total_products"]
        source = r["source"]
        if r["status"] == "error":
            detail = f"  ERROR: {r['error']}"
        else:
            detail = f"  {count} producto(s)"
        print(f"  {status_icon}  {source:<20}{detail}")
    print("─" * 48)
    print(f"  Total: {total_products} producto(s)  |  {ok} ok  |  {failed} error(s)")
    print("─" * 48 + "\n")

    logger.info("Resultados exportados a '%s'", _OUTPUT_FILE)


if __name__ == "__main__":
    main()
