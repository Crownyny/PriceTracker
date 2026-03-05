"""Interfaz abstracta del normalizador determinista.

Recibe raw_fields (dict de campos extraídos del HTML por el Scraper)
y retorna un NormalizedProduct con formato canónico.

NO recibe ScrapingMessage directamente: eso era el diseño v1.
Ahora el grafo LangGraph proporciona los raw_fields extraídos del
documento MongoDB al nodo clean, que llama a esta interfaz.
"""
from abc import ABC, abstractmethod
from typing import Any

from shared.model import NormalizedProduct


class BaseNormalizer(ABC):
    """Contrato del normalizador determinista."""

    @abstractmethod
    async def normalize(
        self,
        raw_fields: dict[str, Any],
        product_ref: str,
        source_name: str,
    ) -> NormalizedProduct:
        """
        Aplica reglas deterministas sobre raw_fields y retorna
        un NormalizedProduct válido (sin persistir).
        """
        ...
