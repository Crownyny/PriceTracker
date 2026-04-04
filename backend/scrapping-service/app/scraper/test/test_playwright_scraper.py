"""Pruebas unitarias para PlaywrightScraper.

Cubre el ciclo de vida del scraper, manejo de errores y extracción de datos.
Usa mocks para evitar dependencias externas (Playwright, red, etc.).
"""
import asyncio
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import sys
from pathlib import Path

# Añadir el directorio raíz del proyecto al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from shared.model import RawScrapingResult, ScrapingJob
from app.scraper.base import BaseScraper
from app.scraper.playwright_scraper import PlaywrightScraper, _empty_fields


class TestPlaywrightScraper:
    """Suite de pruebas unitarias para PlaywrightScraper."""

    @pytest.fixture
    def mock_registry(self):
        """Mock del registro de fuentes."""
        registry = MagicMock()
        source = MagicMock()
        source.source_name = "test_source"
        source.user_agent = "TestAgent/1.0"
        source.extra_http_headers = {"Accept": "text/html"}
        source.selector_timeout = 5000
        source.use_proxy = False
        source.wait_for_selector = ".product"
        source.scroll_before_extract = False
        source.build_url.return_value = "https://example.com/search?q=test"
        source.iter_results.return_value = [
            {"raw_title": "Test Product", "raw_price": "100.00"}
        ]
        registry.get.return_value = source
        return registry

    @pytest.fixture
    def scraper(self, mock_registry):
        """Instancia del scraper para pruebas."""
        return PlaywrightScraper(registry=mock_registry, user_agent="TestBot/1.0")

    @pytest.fixture
    def sample_job(self):
        """Job de scraping de ejemplo."""
        return ScrapingJob(
            job_id=str(uuid.uuid4()),
            search_id="test-search",
            source_url="https://example.com/search?q=test",
            source_name="test_source",
            product_ref="test-ref",
            metadata={"query": "test"},
        )

    def test_inheritance(self, scraper):
        """Verifica que PlaywrightScraper hereda de BaseScraper."""
        assert isinstance(scraper, BaseScraper)

    def test_initialization(self, mock_registry):
        """Prueba la inicialización del scraper."""
        scraper = PlaywrightScraper(
            registry=mock_registry,
            user_agent="CustomAgent/2.0"
        )
        assert scraper._registry == mock_registry
        assert scraper._user_agent == "CustomAgent/2.0"
        assert scraper._playwright is None
        assert scraper._browser is None

    @pytest.mark.asyncio
    async def test_start_stop_lifecycle(self, scraper):
        """Prueba el ciclo de vida de inicio y parada del browser."""
        mock_playwright = AsyncMock()
        mock_browser = AsyncMock()
        
        with patch('app.scraper.playwright_scraper.async_playwright') as mock_async_playwright:
            # Configurar el mock para que sea awaitable
            mock_async_playwright.return_value = AsyncMock()
            mock_async_playwright.return_value.start.return_value = mock_playwright
            mock_playwright.chromium.launch.return_value = mock_browser
            
            await scraper.start()
            
            assert scraper._playwright == mock_playwright
            assert scraper._browser == mock_browser
            
            mock_async_playwright.return_value.start.assert_called_once()
            mock_playwright.chromium.launch.assert_called_once_with(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            
            await scraper.stop()
            
            mock_browser.close.assert_called_once()
            mock_playwright.stop.assert_called_once()
            
            assert scraper._browser is None
            assert scraper._playwright is None

    @pytest.mark.asyncio
    async def test_scrape_without_browser_raises_error(self, scraper, sample_job):
        """Prueba que scraping sin browser iniciado lanza RuntimeError."""
        with pytest.raises(RuntimeError, match="PlaywrightScraper no iniciado"):
            async for _ in scraper.scrape(sample_job):
                pass

    @pytest.mark.asyncio
    async def test_successful_scraping(self, scraper, sample_job, mock_registry):
        """Prueba un flujo de scraping exitoso."""
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        result = results[0]
        assert isinstance(result, RawScrapingResult)
        assert result.status == "success"
        assert result.source_name == "test_source"
        assert result.search_id == "test-search"
        assert result.product_ref == "test-ref"
        assert result.raw_fields["raw_title"] == "Test Product"
        assert result.raw_fields["raw_price"] == "100.00"
        
        mock_browser.new_context.assert_called_once_with(
            user_agent="TestAgent/1.0",
            locale="es-CO",
            timezone_id="America/Bogota",
            viewport={"width": 1366, "height": 768},
            extra_http_headers={"Accept": "text/html"},
            proxy=None,
        )
        
        mock_page.goto.assert_called_once_with(
            sample_job.source_url,
            timeout=30000,
            wait_until="domcontentloaded",
        )
        
        mock_page.wait_for_selector.assert_called_once_with(".product", timeout=5000)

    @pytest.mark.asyncio
    async def test_scraping_with_navigation_retry(self, scraper, sample_job, mock_registry):
        """Prueba el reintento automático en errores de red."""
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        
        # Simular error de red transitorio en los primeros 2 intentos
        mock_page.goto.side_effect = [
            Exception("ERR_CONNECTION_RESET"),
            Exception("ERR_TIMED_OUT"),
            None,  # Éxito en el tercer intento
        ]
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        
        # Verificar que se llamó 3 veces (2 reintentos + 1 éxito)
        assert mock_page.goto.call_count == 3

    @pytest.mark.asyncio
    async def test_scraping_with_non_retryable_error(self, scraper, sample_job, mock_registry):
        """Prueba manejo de errores no reintentables."""
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        
        # Error no reintentable
        mock_page.goto.side_effect = Exception("Non-retryable error")
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        result = results[0]
        assert result.status == "failed"
        assert "Non-retryable error" in result.error_message
        
        # Solo un intento para errores no reintentables
        assert mock_page.goto.call_count == 1

    @pytest.mark.asyncio
    async def test_scraping_with_proxy(self, scraper, sample_job, mock_registry):
        """Prueba el uso de proxy residencial cuando la fuente lo requiere."""
        # Configurar fuente para usar proxy
        mock_registry.get.return_value.use_proxy = True
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        with patch('app.scraper.playwright_scraper.settings') as mock_settings:
            mock_settings.residential_proxy_url = "http://proxy.example.com:8080"
            
            results = []
            async for result in scraper.scrape(sample_job):
                results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        
        # Verificar que se usó el proxy
        mock_browser.new_context.assert_called_once_with(
            user_agent="TestAgent/1.0",
            locale="es-CO",
            timezone_id="America/Bogota",
            viewport={"width": 1366, "height": 768},
            extra_http_headers={"Accept": "text/html"},
            proxy={"server": "http://proxy.example.com:8080"},
        )

    @pytest.mark.asyncio
    async def test_scraping_with_scroll(self, scraper, sample_job, mock_registry):
        """Prueba el scroll automático antes de extraer datos."""
        # Configurar fuente para hacer scroll
        mock_registry.get.return_value.scroll_before_extract = True
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        mock_page.evaluate.return_value = None
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        
        # Verificar que se ejecutó el script de scroll
        mock_page.evaluate.assert_called_once()
        scroll_script = mock_page.evaluate.call_args[0][0]
        assert "scrollTo" in scroll_script
        assert "setInterval" in scroll_script

    @pytest.mark.asyncio
    async def test_scraping_no_products_found(self, scraper, sample_job, mock_registry):
        """Prueba cuando no se encuentran productos."""
        # Configurar fuente para no devolver resultados
        mock_registry.get.return_value.iter_results.return_value = []
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>No products</body></html>"
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 0  # No hay resultados cuando no se encuentran productos

    @pytest.mark.asyncio
    async def test_scraping_source_not_found(self, scraper, sample_job, mock_registry):
        """Prueba cuando no hay extractor registrado para la fuente."""
        mock_registry.get.return_value = None
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 0  # No hay resultados sin extractor

    @pytest.mark.asyncio
    async def test_scraping_timeout_waiting_selector(self, scraper, sample_job, mock_registry):
        """Prueba manejo de timeout al esperar selector."""
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        mock_page.wait_for_selector.side_effect = Exception("Timeout")
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        # Debe continuar con HTML parcial a pesar del timeout

    def test_failed_result_creation(self, sample_job):
        """Prueba la creación de resultados de error."""
        error_msg = "Test error"
        result = PlaywrightScraper._failed_result(sample_job, error_msg)
        
        assert isinstance(result, RawScrapingResult)
        assert result.status == "failed"
        assert result.error_message == error_msg
        assert result.raw_fields == _empty_fields()
        assert result.job_id == sample_job.job_id
        assert result.search_id == sample_job.search_id
        assert result.product_ref == sample_job.product_ref
        assert result.source_name == sample_job.source_name

    def test_empty_fields_function(self):
        """Prueba la función que genera campos vacíos."""
        fields = _empty_fields()
        
        expected_keys = [
            "raw_title", "raw_price", "raw_currency", "raw_availability",
            "raw_category", "raw_image_url", "raw_description", "raw_url"
        ]
        
        for key in expected_keys:
            assert key in fields
            assert fields[key] is None

    @pytest.mark.asyncio
    async def test_context_and_page_cleanup_on_error(self, scraper, sample_job, mock_registry):
        """Prueba que context y page se cierran incluso si hay error."""
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.goto.side_effect = Exception("Navigation error")
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        # Verificar que se cerraron page y context a pesar del error
        mock_page.close.assert_called_once()
        mock_context.close.assert_called_once()
        
        assert len(results) == 1
        assert results[0].status == "failed"

    @pytest.mark.asyncio
    async def test_scraping_with_custom_source_config(self, scraper, sample_job, mock_registry):
        """Prueba configuración personalizada de la fuente."""
        source = mock_registry.get.return_value
        source.user_agent = "CustomSourceAgent/1.0"
        source.extra_http_headers = {"X-Custom": "value"}
        source.selector_timeout = 15000
        source.wait_for_selector = None  # Sin espera específica
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        
        # Verificar configuración personalizada
        mock_browser.new_context.assert_called_once_with(
            user_agent="CustomSourceAgent/1.0",
            locale="es-CO",
            timezone_id="America/Bogota",
            viewport={"width": 1366, "height": 768},
            extra_http_headers={"X-Custom": "value"},
            proxy=None,
        )
        
        # No debe llamar a wait_for_selector si es None
        mock_page.wait_for_selector.assert_not_called()
