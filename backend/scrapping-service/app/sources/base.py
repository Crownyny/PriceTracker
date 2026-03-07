"""Interfaz abstracta de una fuente de scraping.

Cada fuente (Amazon, MercadoLibre, Éxito, etc.) implementa esta interfaz
y se auto-registra en el SourceRegistry al final de su módulo:

    registry.register(MiNuevaSource())

Responsabilidades de una fuente:
  1. Definir su nombre canónico (source_name).
  2. Construir la URL de búsqueda a partir de una query.
  3. Extraer raw_fields del HTML renderizado por Playwright.
  4. (Opcional) Declarar wait_for_selector para que Playwright espere
     a que el contenido dinámico esté disponible antes de extraer.

Cómo añadir una nueva fuente:
  1. Crear app/sources/<nombre>.py implementando BaseSource.
  2. Registrarla con registry.register(MiSource()) al final del archivo.
  3. Importarla en app/sources/__init__.py.
  4. Listo — el worker la detectará automáticamente.
"""
from abc import ABC, abstractmethod
from typing import Any, Optional

from shared.model import ScrapingJob


class BaseSource(ABC):
    """Contrato que cada fuente de scraping debe implementar."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Nombre canónico de la fuente (ej: 'amazon', 'mercadolibre')."""
        ...

    @property
    def wait_for_selector(self) -> Optional[str]:
        """
        Selector CSS que Playwright esperará antes de extraer el HTML.
        Sobreescribir en fuentes con contenido renderizado por JavaScript.
        Si es None, se usa la estrategia por defecto (domcontentloaded).
        """
        return None

    @abstractmethod
    def build_url(self, query: str, product_ref: str) -> str:
        """Construye la URL de búsqueda/producto para esta fuente."""
        ...

    @abstractmethod
    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        """
        Extrae campos crudos del HTML completamente renderizado.
        No debe aplicar normalización semántica (eso es responsabilidad del Normalizer).
        Usar BeautifulSoup para parsear html_content.
        """
        ...
