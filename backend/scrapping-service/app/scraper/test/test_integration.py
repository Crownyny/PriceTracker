"""Pruebas de integración y casos límite para el scraper.

Cubre escenarios complejos, manejo de errores específicos y validación
de comportamiento en condiciones extremas.
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
from app.scraper.playwright_scraper import PlaywrightScraper, _empty_fields


class TestPlaywrightScraperEdgeCases:
    """Suite de pruebas para casos límite y manejo robusto de errores."""

    @pytest.fixture
    def mock_registry(self):
        """Mock del registro de fuentes."""
        registry = MagicMock()
        return registry

    @pytest.fixture
    def scraper(self, mock_registry):
        """Instancia del scraper para pruebas."""
        return PlaywrightScraper(registry=mock_registry)

    @pytest.fixture
    def sample_job(self):
        """Job de scraping de ejemplo."""
        return ScrapingJob(
            job_id=str(uuid.uuid4()),
            search_id="test-search",
            source_url="https://example.com/search?q=test",
            source_name="test_source",
            product_ref="test-ref",
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )

    @pytest.mark.asyncio
    async def test_multiple_concurrent_scraping_jobs(self, scraper, sample_job, mock_registry):
        """Prueba múltiples jobs de scraping concurrentes."""
        # Configurar mock para múltiples fuentes
        source1 = MagicMock()
        source1.source_name = "source1"
        source1.iter_results.return_value = [{"raw_title": "Product 1", "raw_price": "100"}]
        
        source2 = MagicMock()
        source2.source_name = "source2"
        source2.iter_results.return_value = [{"raw_title": "Product 2", "raw_price": "200"}]
        
        def get_source(name):
            return {"source1": source1, "source2": source2}.get(name)
        
        mock_registry.get.side_effect = get_source
        
        # Mock del browser
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test</body></html>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        # Crear jobs para diferentes fuentes
        job1 = ScrapingJob(
            job_id=str(uuid.uuid4()),
            search_id="test-search",
            source_url="https://example1.com",
            source_name="source1",
            product_ref="test-ref",
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )
        
        job2 = ScrapingJob(
            job_id=str(uuid.uuid4()),
            search_id="test-search",
            source_url="https://example2.com",
            source_name="source2",
            product_ref="test-ref",
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )
        
        # Ejecutar scraping concurrentemente
        async def collect_results(job):
            results = []
            async for result in scraper.scrape(job):
                results.append(result)
            return results
        
        results1, results2 = await asyncio.gather(
            collect_results(job1),
            collect_results(job2)
        )
        
        assert len(results1) == 1
        assert len(results2) == 1
        assert results1[0].source_name == "source1"
        assert results2[0].source_name == "source2"

    @pytest.mark.asyncio
    async def test_browser_crash_during_scraping(self, scraper, sample_job, mock_registry):
        """Prueba manejo de caída del browser durante scraping."""
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        # Simular caída del browser durante new_context
        mock_browser = AsyncMock()
        mock_browser.new_context.side_effect = Exception("Browser crashed")
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "failed"
        assert "Browser crashed" in results[0].error_message

    @pytest.mark.asyncio
    async def test_memory_cleanup_on_large_results(self, scraper, sample_job, mock_registry):
        """Prueba limpieza de memoria con grandes volúmenes de resultados."""
        source = MagicMock()
        source.source_name = "test_source"
        
        # Simular gran cantidad de resultados
        def iter_results(content, job):
            for i in range(1000):
                yield {
                    "raw_title": f"Product {i}",
                    "raw_price": str(i * 10),
                    "raw_description": "A" * 1000,  # Descripción grande
                }
        
        source.iter_results = iter_results
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Large content</body></html>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
            if len(results) >= 10:  # Limitar para prueba
                break
        
        assert len(results) == 10
        for result in results:
            assert result.status == "success"
            assert result.html_content is None  # No guardar HTML para ahorrar memoria

    @pytest.mark.asyncio
    async def test_malformed_html_content(self, scraper, sample_job, mock_registry):
        """Prueba manejo de HTML malformado."""
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Malformed <div>content</div></body>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        # El scraper debe manejar HTML malformado sin problemas

    @pytest.mark.asyncio
    async def test_unicode_and_special_characters(self, scraper, sample_job, mock_registry):
        """Prueba manejo de caracteres Unicode y especiales."""
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.return_value = [
            {
                "raw_title": "Título con ñ y áéíóú 📱",
                "raw_price": "100.50€",
                "raw_description": "Descripción con emojis 🛒 y caracteres especiales: ï, ü, ç",
                "raw_currency": "€",
            }
        ]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Unicode content</body></html>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        fields = results[0].raw_fields
        assert "ñ" in fields["raw_title"]
        assert "áéíóú" in fields["raw_title"]
        assert "📱" in fields["raw_title"]
        assert "€" in fields["raw_price"]
        assert "🛒" in fields["raw_description"]

    @pytest.mark.asyncio
    async def test_very_long_urls(self, scraper, mock_registry):
        """Prueba manejo de URLs extremadamente largas."""
        # URL muy larga (más de 2000 caracteres)
        long_url = "https://example.com/search?" + "param=value&" * 100
        
        job = ScrapingJob(
            job_id=str(uuid.uuid4()),
            search_id="test-search",
            source_url=long_url,
            source_name="test_source",
            product_ref="test-ref",
            scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
        )
        
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Long URL content</body></html>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        # Verificar que la URL larga se manejó correctamente
        mock_page.goto.assert_called_once_with(long_url, timeout=30000, wait_until="domcontentloaded")

    @pytest.mark.asyncio
    async def test_network_timeout_during_content_extraction(self, scraper, sample_job, mock_registry):
        """Prueba timeout de red durante extracción de contenido."""
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.side_effect = Exception("Network timeout during extraction")
        mock_registry.get.return_value = source
        
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
        assert results[0].status == "failed"
        assert "Network timeout during extraction" in results[0].error_message

    @pytest.mark.asyncio
    async def test_proxy_configuration_errors(self, scraper, sample_job, mock_registry):
        """Prueba errores en configuración de proxy."""
        source = MagicMock()
        source.source_name = "test_source"
        source.use_proxy = True
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        
        # Simular error de proxy
        mock_browser.new_context.side_effect = Exception("Proxy connection failed")
        scraper._browser = mock_browser
        
        with patch('app.scraper.playwright_scraper.settings') as mock_settings:
            mock_settings.residential_proxy_url = "http://invalid-proxy:8080"
            
            results = []
            async for result in scraper.scrape(sample_job):
                results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "failed"
        assert "Proxy connection failed" in results[0].error_message

    @pytest.mark.asyncio
    async def test_stealth_script_injection_failure(self, scraper, sample_job, mock_registry):
        """Prueba fallo al inyectar script stealth."""
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        
        # Simular fallo en add_init_script
        mock_context.add_init_script.side_effect = Exception("Script injection failed")
        
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "failed"
        assert "Script injection failed" in results[0].error_message

    @pytest.mark.asyncio
    async def test_empty_html_content(self, scraper, sample_job, mock_registry):
        """Prueba manejo de contenido HTML vacío."""
        source = MagicMock()
        source.source_name = "test_source"
        source.iter_results.return_value = []  # No hay resultados en HTML vacío
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = ""  # HTML completamente vacío
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 0  # Sin resultados para HTML vacío

    @pytest.mark.asyncio
    async def test_multiple_wait_selectors_timeout(self, scraper, sample_job, mock_registry):
        """Prueba múltiples timeouts de selectores de espera."""
        source = MagicMock()
        source.source_name = "test_source"
        source.wait_for_selector = ".nonexistent-selector"
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        mock_page.wait_for_selector.side_effect = Exception("Selector timeout")
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "success"
        # Debe continuar a pesar del timeout del selector

    @pytest.mark.asyncio
    async def test_job_id_consistency(self, scraper, sample_job, mock_registry):
        """Prueba consistencia de job_id en todos los resultados."""
        source = MagicMock()
        source.source_name = "test_source"
        
        # Múltiples resultados del mismo job
        def iter_results(content, job):
            for i in range(5):
                yield {"raw_title": f"Product {i}", "raw_price": str(i * 10)}
        
        source.iter_results = iter_results
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Multiple products</body></html>"
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 5
        
        # Todos los resultados deben tener el mismo search_id, product_ref, y source_name
        for result in results:
            assert result.search_id == sample_job.search_id
            assert result.product_ref == sample_job.product_ref
            assert result.source_name == sample_job.source_name
            assert result.status == "success"
        
        # Pero cada resultado debe tener un job_id único
        job_ids = [result.job_id for result in results]
        assert len(set(job_ids)) == 5  # Todos diferentes

    @pytest.mark.asyncio
    async def test_scroll_script_execution_failure(self, scraper, sample_job, mock_registry):
        """Prueba fallo en ejecución del script de scroll."""
        source = MagicMock()
        source.source_name = "test_source"
        source.scroll_before_extract = True
        source.iter_results.return_value = [{"raw_title": "Test", "raw_price": "100"}]
        mock_registry.get.return_value = source
        
        mock_context = AsyncMock()
        mock_page = AsyncMock()
        mock_page.content.return_value = "<html><body>Test content</body></html>"
        mock_page.evaluate.side_effect = Exception("Scroll script failed")
        mock_context.new_page.return_value = mock_page
        mock_browser = AsyncMock()
        mock_browser.new_context.return_value = mock_context
        scraper._browser = mock_browser
        
        results = []
        async for result in scraper.scrape(sample_job):
            results.append(result)
        
        assert len(results) == 1
        assert results[0].status == "failed"
        assert "Scroll script failed" in results[0].error_message
