"""Interfaz abstracta de una fuente de scraping.

Cada fuente (Amazon, MercadoLibre, Éxito, etc.) implementa esta interfaz
y se auto-registra en el SourceRegistry mediante el decorador @register.

Responsabilidades de una fuente:
  1. Definir su nombre canónico (source_name).
  2. Construir la URL de búsqueda a partir de una query.
  3. Extraer raw_fields del HTML/JSON obtenido.
"""
from abc import ABC, abstractmethod
from typing import Any

from shared.model import ScrapingJob


class BaseSource(ABC):
    """Contrato que cada fuente de scraping debe implementar."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Nombre canónico de la fuente (ej: 'amazon', 'mercadolibre')."""
        ...

    @abstractmethod
    def build_url(self, query: str, product_ref: str) -> str:
        """Construye la URL de búsqueda/producto para esta fuente."""
        ...

    @abstractmethod
    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        """
        Extrae campos crudos del contenido HTML/JSON.
        No debe aplicar normalización semántica (eso es del Normalizer).
        """
        ...
