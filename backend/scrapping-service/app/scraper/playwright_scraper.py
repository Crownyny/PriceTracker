"""Implementación de scraper basada en Playwright (Chromium headless).

Adecuada para sitios con renderizado JavaScript (Amazon, MercadoLibre, etc.).
El browser se instancia una sola vez al arrancar el worker (via start/stop)
y se reutiliza para todas las peticiones (más eficiente que crear uno por job).

Ciclo de vida esperado:
    scraper = PlaywrightScraper()
    await scraper.start()            # lanza Chromium una vez
    result = await scraper.scrape(job)
    await scraper.stop()             # cierra el browser al apagar

Cada source puede declarar un `wait_for_selector` para que Playwright espere
a que ese elemento esté en el DOM antes de extraer el HTML. Si no se declara,
se usa `wait_until="networkidle"` como estrategia por defecto.
"""
import datetime
import logging
from typing import Any

from playwright.async_api import async_playwright, Browser, Playwright

from shared.model import RawScrapingResult, ScrapingJob

from .base import BaseScraper
from ..sources.registry import SourceRegistry

logger = logging.getLogger(__name__)

# Timeout por defecto para navegación y espera de selector (ms)
_NAV_TIMEOUT = 30_000
_SELECTOR_TIMEOUT = 10_000


class PlaywrightScraper(BaseScraper):
    """
    Scraper basado en Playwright/Chromium headless.
    Delega la extracción de campos al source registrado en el SourceRegistry.
    El browser se comparte entre jobs para minimizar overhead de arranque.
    """

    def __init__(
        self,
        registry: SourceRegistry,
        user_agent: str = "PriceTrackerBot/1.0",
    ) -> None:
        self._registry = registry
        self._user_agent = user_agent
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None

    async def start(self) -> None:
        """Lanza Chromium. Llamar una vez al iniciar el worker."""
        logger.info("Iniciando browser Playwright (Chromium headless)...")
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        logger.info("Browser Playwright listo.")

    async def stop(self) -> None:
        """Cierra el browser. Llamar al apagar el worker."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        logger.info("Browser Playwright cerrado.")

    async def scrape(self, job: ScrapingJob) -> list[RawScrapingResult]:
        """
        Scraping de una URL. Devuelve UNA lista con un RawScrapingResult por
        producto encontrado en la página. Si la navegación falla, devuelve
        una lista con un único resultado de error.
        """
        if not self._browser:
            raise RuntimeError("PlaywrightScraper no iniciado. Llamar await start() primero.")

        logger.info("[%s] Scraping %s (%s)", job.job_id, job.source_url, job.source_name)

        try:
            context = await self._browser.new_context(
                user_agent=self._user_agent,
                locale="es-CO",
                timezone_id="America/Bogota",
            )
            page = await context.new_page()

            try:
                await page.goto(
                    job.source_url,
                    timeout=_NAV_TIMEOUT,
                    wait_until="domcontentloaded",
                )

                # Esperar selector específico del source si está definido
                source = self._registry.get(job.source_name)
                wait_selector = getattr(source, "wait_for_selector", None) if source else None
                if wait_selector:
                    try:
                        await page.wait_for_selector(wait_selector, timeout=_SELECTOR_TIMEOUT)
                    except Exception:
                        logger.warning(
                            "[%s] Timeout esperando selector '%s', continuando con HTML parcial",
                            job.job_id, wait_selector,
                        )

                # Scroll para disparar lazy-loading de imágenes si la fuente lo requiere
                should_scroll = getattr(source, "scroll_before_extract", False) if source else False
                if should_scroll:
                    await page.evaluate("""
                        async () => {
                            await new Promise(resolve => {
                                let total = document.body.scrollHeight;
                                let step  = Math.ceil(total / 8);
                                let pos   = 0;
                                const tick = setInterval(() => {
                                    pos += step;
                                    window.scrollTo(0, pos);
                                    if (pos >= total) { clearInterval(tick); resolve(); }
                                }, 120);
                            });
                        }
                    """)
                    await page.wait_for_timeout(400)

                html_content = await page.content()
            finally:
                await page.close()
                await context.close()

            all_fields = self._extract_all_results(html_content, job)
            if not all_fields:
                logger.warning(
                    "[%s] Sin productos encontrados en '%s' (%s)",
                    job.job_id, job.source_url, job.source_name,
                )
                return []

            now = datetime.datetime.now(tz=datetime.timezone.utc)
            return [
                RawScrapingResult(
                    job_id=job.job_id,
                    search_id=job.search_id,
                    product_ref=job.product_ref,
                    source_name=job.source_name,
                    scraped_at=now,
                    raw_fields=fields,
                    html_content=None,
                    status="success",
                )
                for fields in all_fields
            ]

        except Exception as exc:
            logger.exception("[%s] Error en Playwright scraping de %s", job.job_id, job.source_url)
            return [self._failed_result(job, str(exc))]

    def _extract_all_results(
        self, content: str, job: ScrapingJob
    ) -> list[dict[str, Any]]:
        """Delega la extracción al source registrado y devuelve lista de raw_fields."""
        source = self._registry.get(job.source_name)
        if source:
            return source.extract_all_results(content, job)

        logger.warning(
            "[%s] Sin extractor registrado para '%s'",
            job.job_id, job.source_name,
        )
        return []

    @staticmethod
    def _failed_result(job: ScrapingJob, error: str) -> RawScrapingResult:
        return RawScrapingResult(
            job_id=job.job_id,
            search_id=job.search_id,
            product_ref=job.product_ref,
            source_name=job.source_name,
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
            raw_fields=_empty_fields(),
            html_content=None,
            status="failed",
            error_message=error,
        )


def _empty_fields() -> dict[str, Any]:
    return {
        "raw_title": None,
        "raw_price": None,
        "raw_currency": None,
        "raw_availability": None,
        "raw_category": None,
        "raw_image_url": None,
        "raw_description": None,
    }
