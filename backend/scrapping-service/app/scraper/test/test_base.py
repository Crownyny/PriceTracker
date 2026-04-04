"""Pruebas unitarias para BaseScraper.

Verifica el contrato abstracto y la interfaz que todos los scrapers deben cumplir.
"""
import pytest
from abc import ABC

import sys
from pathlib import Path

# Añadir el directorio raíz del proyecto al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from shared.model import RawScrapingResult, ScrapingJob
from app.scraper.base import BaseScraper

class TestBaseScraper:
    """Suite de pruebas para la clase abstracta BaseScraper."""

    def test_base_scraper_is_abstract(self):
        """Prueba que BaseScraper es una clase abstracta."""
        # Verificar que tiene métodos abstractos
        from abc import ABCMeta
        assert isinstance(BaseScraper, ABCMeta)
        
        # No se puede instanciar directamente
        with pytest.raises(TypeError):
            BaseScraper()

    def test_base_scraper_has_abstract_method(self):
        """Prueba que scrape es un método abstracto."""
        assert hasattr(BaseScraper, 'scrape')
        # Verificar que el método está marcado como abstracto
        from abc import ABCMeta
        assert 'scrape' in BaseScraper.__abstractmethods__

    def test_concrete_implementation(self):
        """Prueba una implementación concreta para verificar el contrato."""
        
        class ConcreteScraper(BaseScraper):
            async def scrape(self, job):
                # Implementación de ejemplo que yield un resultado
                yield RawScrapingResult(
                    job_id=job.job_id,
                    search_id=job.search_id,
                    product_ref=job.product_ref,
                    source_name=job.source_name,
                    scraped_at=datetime.datetime.now(tz=datetime.timezone.utc),
                    raw_fields={"test": "data"},
                    html_content=None,
                    status="success",
                )
        
        import asyncio
        import uuid
        import datetime
        
        # Verificar que se puede instanciar
        scraper = ConcreteScraper()
        assert isinstance(scraper, BaseScraper)
        
        # Verificar que el método scrape funciona como async generator
        job = ScrapingJob(
            job_id=str(uuid.uuid4()),
            search_id="test",
            source_url="https://example.com",
            source_name="test",
            product_ref="test",
        )
        
        async def test_scrape():
            results = []
            async for result in scraper.scrape(job):
                results.append(result)
            return results
        
        results = asyncio.run(test_scrape())
        assert len(results) == 1
        assert isinstance(results[0], RawScrapingResult)
        assert results[0].status == "success"

    def test_scrape_method_signature(self):
        """Prueba la firma del método scrape."""
        import inspect
        
        sig = inspect.signature(BaseScraper.scrape)
        params = sig.parameters
        
        # Debe tener 'self' y 'job' (2 parámetros)
        assert len(params) == 2
        assert 'self' in params
        assert 'job' in params
        
        # El parámetro job no debe tener valor por defecto
        assert params['job'].default == inspect.Parameter.empty

    def test_scrape_return_annotation(self):
        """Prueba la anotación de retorno del método scrape."""
        import inspect
        
        sig = inspect.signature(BaseScraper.scrape)
        # La anotación debe indicar que es un AsyncGenerator
        # (No verificamos el tipo exacto ya que puede variar entre versiones de Python)
        assert sig.return_annotation is not inspect.Signature.empty

    def test_base_scraper_docstring(self):
        """Prueba que BaseScraper tenga documentación adecuada."""
        doc = BaseScraper.__doc__
        assert doc is not None
        assert "Contrato" in doc
        assert "scraper" in doc.lower()
        assert "raw_fields" in doc

    def test_scrape_method_docstring(self):
        """Prueba que el método scrape tenga documentación adecuada."""
        doc = BaseScraper.scrape.__doc__
        assert doc is not None
        assert "Async generator" in doc
        assert "RawScrapingResult" in doc
        assert "yield" in doc.lower()
        assert "status='failed'" in doc
