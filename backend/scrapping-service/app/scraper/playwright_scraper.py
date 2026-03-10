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

try:
    from playwright_stealth import Stealth as _Stealth
    _stealth = _Stealth()
except ImportError:
    _stealth = None

from shared.model import RawScrapingResult, ScrapingJob

from .base import BaseScraper
from ..sources.registry import SourceRegistry
from ..config import settings

logger = logging.getLogger(__name__)

# Timeout por defecto para navegación y espera de selector (ms)
_NAV_TIMEOUT = 30_000
_SELECTOR_TIMEOUT = 10_000

# Errores de red transitorios que justifican un reintento automático
_RETRYABLE_ERRORS = (
    "ERR_NETWORK_CHANGED",
    "ERR_CONNECTION_RESET",
    "ERR_CONNECTION_CLOSED",
    "ERR_INTERNET_DISCONNECTED",
    "ERR_TIMED_OUT",
)
_MAX_RETRIES = 2

# Fallback manual cuando playwright-stealth no está disponible
_STEALTH_SCRIPT_FALLBACK = """
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = window.chrome || { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
"""


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
            source = self._registry.get(job.source_name)
            ua = (getattr(source, "user_agent", None) or self._user_agent)
            extra_headers = getattr(source, "extra_http_headers", None) or {}
            sel_timeout = getattr(source, "selector_timeout", _SELECTOR_TIMEOUT) or _SELECTOR_TIMEOUT

            # Usar proxy residencial si: está configurado Y la fuente lo requiere
            use_proxy = getattr(source, "use_proxy", False)
            proxy_cfg = None
            if use_proxy and settings.residential_proxy_url:
                proxy_cfg = {"server": settings.residential_proxy_url}
                logger.debug("[%s] Usando proxy residencial", job.job_id)

            context = await self._browser.new_context(
                user_agent=ua,
                locale="es-CO",
                timezone_id="America/Bogota",
                viewport={"width": 1366, "height": 768},
                extra_http_headers=extra_headers,
                proxy=proxy_cfg,
            )
            await context.add_init_script(_STEALTH_SCRIPT_FALLBACK)
            page = await context.new_page()
            # playwright-stealth aplica parches más completos contra fingerprinting
            if _stealth is not None:
                await _stealth.apply_stealth_async(page)

            try:
                # Reintentar en errores de red transitorios
                last_nav_exc = None
                for attempt in range(1, _MAX_RETRIES + 2):
                    try:
                        await page.goto(
                            job.source_url,
                            timeout=_NAV_TIMEOUT,
                            wait_until="domcontentloaded",
                        )
                        last_nav_exc = None
                        break
                    except Exception as nav_exc:
                        last_nav_exc = nav_exc
                        is_retryable = any(e in str(nav_exc) for e in _RETRYABLE_ERRORS)
                        if is_retryable and attempt <= _MAX_RETRIES:
                            logger.warning(
                                "[%s] %s — reintento %d/%d",
                                job.job_id, str(nav_exc)[:80], attempt, _MAX_RETRIES,
                            )
                            await page.wait_for_timeout(1500 * attempt)
                        else:
                            raise

                # Esperar selector específico del source si está definido
                wait_selector = getattr(source, "wait_for_selector", None) if source else None
                if wait_selector:
                    try:
                        await page.wait_for_selector(wait_selector, timeout=sel_timeout)
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
