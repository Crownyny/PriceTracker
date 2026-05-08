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
import re
import sys
from difflib import SequenceMatcher
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


def _normalize_text(text: str | None) -> str:
    value = (text or "").lower().strip()
    value = re.sub(r"[^a-z0-9áéíóúñü\s]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _relevance_score(query: str, title: str | None) -> float:
    normalized_query = _normalize_text(query)
    normalized_title = _normalize_text(title)
    if not normalized_query or not normalized_title:
        return 0.0

    query_tokens = set(normalized_query.split())
    title_tokens = set(normalized_title.split())
    overlap = len(query_tokens & title_tokens) / max(1, len(query_tokens))
    sequence = SequenceMatcher(None, normalized_query, normalized_title).ratio()
    return round((0.7 * overlap) + (0.3 * sequence), 3)


async def _collect_job_results(scraper: PlaywrightScraper, job: ScrapingJob) -> list:
    """Consume el async generator del scraper y acumula sus resultados."""
    return [result async for result in scraper.scrape(job)]


async def run_scraping(
    query: str,
    sources_filter: list[str] | None,
    user_agent: str,
    limit: int | None,
    enable_relevance_guard: bool,
    relevance_min_score: float,
) -> list[dict]:
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
            # Omitir fallidos y, opcionalmente, filtrar por relevancia con la query
            valid_results = [r for r in results if getattr(r, "status", "success") != "failed"]

            if enable_relevance_guard:
                filtered_results = []
                for result in valid_results:
                    fields = result.raw_fields or {}
                    title = fields.get("raw_title") or fields.get("title") or fields.get("name")
                    score = _relevance_score(query, title)
                    if score >= relevance_min_score:
                        filtered_results.append(result)
                valid_results = filtered_results

            products = valid_results if limit is None else valid_results[:limit]
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
    parser.add_argument(
        "--disable-relevance-guard",
        action="store_true",
        help="Desactiva el filtro de relevancia por texto",
    )
    parser.add_argument(
        "--relevance-min-score",
        type=float,
        default=0.35,
        metavar="SCORE",
        help="Umbral mínimo de relevancia (default: 0.35)",
    )
    args = parser.parse_args()

    results = asyncio.run(
        run_scraping(
            args.query,
            args.sources,
            args.user_agent,
            args.limit,
            enable_relevance_guard=not args.disable_relevance_guard,
            relevance_min_score=args.relevance_min_score,
        )
    )

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
