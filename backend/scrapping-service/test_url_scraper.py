"""Script de prueba standalone para scraping de URLs específicas.

Ejecuta el scraping directamente sobre una URL de producto específica
sin necesitar RabbitMQ ni el Normalizer.
Los resultados se exportan siempre a temp/url_results.json (se sobreescribe).
Los logs de progreso van solo a la terminal.

Uso:
    # URL específica de producto
    python test_url_scraper.py "https://www.mercadolibre.com.co/iphone-15-pro-128gb/p/MCO123456"

    # URL específica con límite de resultados
    python test_url_scraper.py "https://amazon.com/dp/B0CHX2Q1Q2" --limit 5
"""
import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from bs4 import BeautifulSoup

# Añadir el directorio padre al path para que `shared` sea importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.model import ScrapingJob

from app.scraper.playwright_scraper import PlaywrightScraper
from app.sources import registry
from app.sources.detector import detector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Ruta fija de salida (relativa al script)
_OUTPUT_FILE = Path(__file__).parent / "temp" / "url_results.json"


async def _collect_job_results(scraper: PlaywrightScraper, job: ScrapingJob) -> list:
    """Consume el async generator del scraper y acumula sus resultados."""
    return [result async for result in scraper.scrape(job)]


async def _fetch_page_content(scraper: PlaywrightScraper, url: str, source) -> str:
    """Obtiene el contenido HTML de una página específica usando la lógica de PlaywrightScraper."""
    # Crear un job temporal
    temp_job = ScrapingJob(
        search_id="temp",
        source_url=url,
        source_name=source.source_name,
        product_ref="temp",
    )
    
    # Usar la misma lógica que el scraper para obtener el HTML
    if not scraper._browser:
        raise RuntimeError("PlaywrightScraper no iniciado. Llamar await start() primero.")
    
    from playwright.async_api import async_playwright
    
    source_config = scraper._registry.get(source.source_name)
    ua = getattr(source_config, "user_agent", None) or scraper._user_agent
    extra_headers = getattr(source_config, "extra_http_headers", None) or {}
    
    context = await scraper._browser.new_context(
        user_agent=ua,
        locale="es-CO",
        timezone_id="America/Bogota",
        viewport={"width": 1366, "height": 768},
        extra_http_headers=extra_headers,
    )
    
    page = await context.new_page()
    try:
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        
        # Esperar al selector específico si existe
        wait_selector = getattr(source_config, "wait_for_selector", None) if source_config else None
        if wait_selector:
            try:
                await page.wait_for_selector(wait_selector, timeout=10000)
            except Exception:
                pass  # Continuar aunque no encuentre el selector
        
        return await page.content()
    finally:
        await page.close()
        await context.close()


async def _extract_single_product_data(html_content: str, source_name: str, product_url: str) -> dict | None:
    """Extrae datos de un producto individual desde el HTML."""
    soup = BeautifulSoup(html_content, 'lxml')
    
    # Estrategias específicas por tienda para productos individuales
    if source_name == "exito":
        return _extract_exito_product(soup, product_url)
    elif source_name == "alkosto":
        return _extract_alkosto_product(soup, product_url)
    elif source_name == "mercadolibre":
        return _extract_mercadolibre_product(soup, product_url)
    else:
        # Estrategia genérica para otras tiendas
        return _extract_generic_product(soup, product_url)


def _extract_exito_product(soup: BeautifulSoup, product_url: str) -> dict | None:
    """Extrae datos de un producto individual de Éxito."""
    # Buscar selectores típicos de páginas de producto
    selectors = {
        'title': [
            'h1[class*="product-name"]',
            'h1[class*="name"]',
            '.product-name h1',
            'h1',
            '[class*="title"]',
        ],
        'price': [
            '[class*="Price"]',
            '[class*="price"]',
            '.product-price',
            '[class*="sellingPrice"]',
        ],
        'image': [
            'img[class*="product-image"]',
            '.product-image img',
            'img[src*="vtexassets"]',
        ],
        'description': [
            '[class*="description"]',
            '.product-description',
            '[class*="features"]',
        ],
        'availability': [
            '[class*="availability"]',
            '[class*="stock"]',
        ],
        'brand': [
            '[class*="brand"]',
            '.product-brand',
        ]
    }
    
    result = {}
    
    # Extraer título
    for selector in selectors['title']:
        element = soup.select_one(selector)
        if element:
            title = element.get_text(strip=True)
            if title and len(title) > 3:
                result['raw_title'] = title
                break
    
    # Extraer precio
    for selector in selectors['price']:
        element = soup.select_one(selector)
        if element:
            price = element.get_text(strip=True)
            if price and any(c.isdigit() for c in price):
                result['raw_price'] = price
                break
    
    # Extraer otros campos
    for field, selector_list in selectors.items():
        if field not in result:
            for selector in selector_list:
                element = soup.select_one(selector)
                if element:
                    value = element.get_text(strip=True)
                    if value:
                        result[f'raw_{field}'] = value
                        break
    
    # Extraer imagen
    for selector in selectors['image']:
        element = soup.select_one(selector)
        if element:
            src = element.get('src')
            if src:
                result['raw_image_url'] = src if src.startswith('http') else f"https://www.exito.com{src}"
                break
    
    # Agregar URL y moneda
    result['raw_url'] = product_url
    result['raw_currency'] = 'COP'
    
    return result if result.get('raw_title') or result.get('raw_price') else None


def _extract_alkosto_product(soup: BeautifulSoup, product_url: str) -> dict | None:
    """Extrae datos de un producto individual de Alkosto."""
    selectors = {
        'title': [
            'h1[class*="product-name"]',
            'h1',
            '.product-title h1',
            '[class*="title"]',
        ],
        'price': [
            '[class*="price"]',
            '.product-price',
            '[class*="Price"]',
            '.price-container',
        ],
        'image': [
            '.product-image img',
            'img[class*="product"]',
        ],
        'brand': [
            '[class*="brand"]',
            '.product-brand',
        ]
    }
    
    result = {}
    
    # Extraer título
    for selector in selectors['title']:
        element = soup.select_one(selector)
        if element:
            title = element.get_text(strip=True)
            if title and len(title) > 3:
                result['raw_title'] = title
                break
    
    # Extraer precio
    for selector in selectors['price']:
        element = soup.select_one(selector)
        if element:
            price = element.get_text(strip=True)
            if price and any(c.isdigit() for c in price):
                result['raw_price'] = price
                break
    
    # Extraer otros campos
    for field, selector_list in selectors.items():
        if field not in result:
            for selector in selector_list:
                element = soup.select_one(selector)
                if element:
                    value = element.get_text(strip=True)
                    if value:
                        result[f'raw_{field}'] = value
                        break
    
    # Extraer imagen
    for selector in selectors['image']:
        element = soup.select_one(selector)
        if element:
            src = element.get('src')
            if src:
                result['raw_image_url'] = src if src.startswith('http') else f"https://www.alkosto.com{src}"
                break
    
    result['raw_url'] = product_url
    result['raw_currency'] = 'COP'
    
    return result if result.get('raw_title') or result.get('raw_price') else None


def _extract_mercadolibre_product(soup: BeautifulSoup, product_url: str) -> dict | None:
    """Extrae datos de un producto individual de MercadoLibre."""
    result = {}
    
    # MercadoLibre tiene estructura bien definida
    title_elem = soup.select_one('h1.ui-pdp-title')
    if title_elem:
        result['raw_title'] = title_elem.get_text(strip=True)
    
    price_elem = soup.select_one('.ui-pdp-price__second-line [class*="andes-money-amount__fraction"]')
    if price_elem:
        result['raw_price'] = price_elem.get_text(strip=True)
    
    image_elem = soup.select_one('.ui-pdp-gallery__main-image img')
    if image_elem:
        result['raw_image_url'] = image_elem.get('src')
    
    result['raw_url'] = product_url
    result['raw_currency'] = 'COP'
    
    return result if result.get('raw_title') or result.get('raw_price') else None


def _extract_generic_product(soup: BeautifulSoup, product_url: str) -> dict | None:
    """Extrae datos de un producto individual con estrategia genérica."""
    result = {}
    
    # Intentar encontrar título
    title_selectors = ['h1', '.product-title', '[class*="title"]', '.product-name']
    for selector in title_selectors:
        element = soup.select_one(selector)
        if element:
            title = element.get_text(strip=True)
            if title and len(title) > 3:
                result['raw_title'] = title
                break
    
    # Intentar encontrar precio
    price_selectors = [
        '[class*="price"]',
        '[class*="Price"]',
        '.price',
        '[data-price]',
        '.product-price'
    ]
    for selector in price_selectors:
        element = soup.select_one(selector)
        if element:
            price = element.get_text(strip=True)
            if price and any(c.isdigit() for c in price):
                result['raw_price'] = price
                break
    
    # Imagen
    img_elem = soup.select_one('img[src*="product"]') or soup.select_one('.product-image img')
    if img_elem:
        src = img_elem.get('src')
        if src:
            result['raw_image_url'] = src
    
    result['raw_url'] = product_url
    
    return result if result.get('raw_title') or result.get('raw_price') else None


async def run_url_scraping(
    product_url: str,
    user_agent: str,
    limit: int | None,
) -> dict:
    """
    Ejecuta el scraping para una URL específica.
    Devuelve dict con información de la fuente detectada y productos encontrados.
    """
    # Detectar la tienda usando el detector de dominios
    source_name = detector.detect(product_url)
    
    logger.info(
        "Detectada tienda '%s' para URL: %s",
        source_name, product_url
    )
    
    # Obtener el source específico para la tienda detectada
    source = registry.get(source_name)
    
    if not source:
        logger.error(
            "No hay source registrado para la tienda detectada '%s'", source_name
        )
        return {
            "product_url": product_url,
            "detected_store": source_name,
            "status": "error",
            "error": f"No scraper available for store: {source_name}",
            "total_products": 0,
            "products": [],
        }
    
    # Crear ScrapingJob para la URL específica
    search_id = "url-test-" + product_url.split('/')[-1][:20]
    job = ScrapingJob(
        search_id=search_id,
        source_url=product_url,
        source_name=source_name,
        product_ref="url-test-ref",
        metadata={"product_url": product_url},
    )
    
    logger.info(
        "Iniciando scraping específico para '%s' en tienda '%s'",
        product_url, source_name
    )
    
    # Lanzar Playwright, scrapear y cerrar
    scraper = PlaywrightScraper(registry=registry, user_agent=user_agent)
    await scraper.start()

    try:
        # Para URLs de productos individuales, necesitamos un enfoque diferente
        # Vamos a obtener el HTML y procesarlo directamente
        from app.scraper.playwright_scraper import RawScrapingResult
        from datetime import datetime, timezone
        
        # Obtener el HTML de la página
        html_content = await _fetch_page_content(scraper, product_url, source)
        
        # Intentar extraer datos directamente del HTML para productos individuales
        product_data = await _extract_single_product_data(html_content, source_name, product_url)
        
        if product_data:
            # Crear un RawScrapingResult simulado
            result = RawScrapingResult(
                job_id=job.job_id,
                search_id=job.search_id,
                product_ref=job.product_ref,
                source_name=source_name,
                scraped_at=datetime.now(tz=timezone.utc),
                raw_fields=product_data,
                status="success"
            )
            raw_results = [result]
        else:
            # Si no podemos extraer datos del producto individual, intentamos con el método normal
            raw_results = await _collect_job_results(scraper, job)
            # Filtrar para quedarnos solo con resultados válidos
            raw_results = [r for r in raw_results if getattr(r, "status", "success") != "failed"]
            
    except Exception as exc:
        logger.error("Excepción durante scraping: %s", exc)
        return {
            "product_url": product_url,
            "detected_store": source_name,
            "job_id": job.job_id,
            "status": "error",
            "error": str(exc),
            "total_products": 0,
            "products": [],
        }
    finally:
        await scraper.stop()

    # Filtrar resultados fallidos
    valid_results = [r for r in raw_results if getattr(r, "status", "success") != "failed"]
    
    # Aplicar límite si se especificó
    products = valid_results if limit is None else valid_results[:limit]
    
    return {
        "product_url": product_url,
        "detected_store": source_name,
        "job_id": job.job_id,
        "status": "success" if products else "empty",
        "error": None,
        "total_products": len(products),
        "products": [r.raw_fields for r in products],
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prueba el Scraper Service con URLs específicas sin RabbitMQ.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "product_url", 
        help="URL específica del producto (ej: 'https://www.mercadolibre.com.co/iphone-15-pro')"
    )
    parser.add_argument(
        "--limit", type=int, default=None, metavar="N",
        help="Máximo de productos a mostrar (por defecto: todos)",
    )
    parser.add_argument(
        "--user-agent",
        default="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        help="User-Agent HTTP a usar",
    )
    args = parser.parse_args()

    result = asyncio.run(
        run_url_scraping(
            args.product_url,
            args.user_agent,
            args.limit,
        )
    )

    # JSON de salida: solo la URL y los resultados
    export = {
        "product_url": args.product_url,
        "result": result,
    }

    _OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    _OUTPUT_FILE.write_text(json.dumps(export, ensure_ascii=False, indent=2), encoding="utf-8")

    # Resumen en terminal
    total_products = result["total_products"]
    status = result["status"]
    detected_store = result["detected_store"]

    print("\n" + "─" * 60)
    print(f"  Resultados para URL: '{args.product_url}'")
    print("─" * 60)
    
    status_icon = "✓" if status == "success" else ("✗" if status == "error" else "·")
    print(f"  {status_icon}  Tienda detectada: {detected_store}")
    
    if status == "error":
        print(f"  ✗  ERROR: {result['error']}")
    else:
        print(f"  {status_icon}  {total_products} producto(s) encontrados")
    
    # Mostrar detalles de productos si hay
    if total_products > 0:
        print("\n  Productos encontrados:")
        for i, product in enumerate(result["products"], 1):
            title = product.get("raw_title") or product.get("title") or "Sin título"
            price = product.get("raw_price") or product.get("price") or "Sin precio"
            print(f"    {i}. {title[:60]}{'...' if len(title) > 60 else ''}")
            print(f"       Precio: {price}")
    
    print("─" * 60)
    print(f"  Total: {total_products} producto(s) | Estado: {status}")
    print("─" * 60 + "\n")

    logger.info("Resultados exportados a '%s'", _OUTPUT_FILE)


if __name__ == "__main__":
    main()
