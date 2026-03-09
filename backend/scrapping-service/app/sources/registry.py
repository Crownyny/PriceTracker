"""Registro centralizado de fuentes de scraping.

Patrón Registry: las fuentes se auto-registran al importarse, permitiendo
agregar nuevas fuentes sin modificar código existente.

Uso:
    from app.sources.registry import registry

    # Obtener todas las fuentes registradas
    sources = registry.all()

    # Obtener una fuente específica
    amazon = registry.get("amazon")

    # Listar nombres disponibles
    names = registry.names()
"""
import logging
from typing import Optional

from .base import BaseSource

logger = logging.getLogger(__name__)


class SourceRegistry:
    """Registro singleton de fuentes de scraping."""

    def __init__(self) -> None:
        self._sources: dict[str, BaseSource] = {}

    def register(self, source: BaseSource) -> BaseSource:
        """Registra una fuente. Devuelve la misma instancia (para encadenar)."""
        name = source.source_name
        if name in self._sources:
            logger.warning("Fuente '%s' ya registrada, sobreescribiendo.", name)
        self._sources[name] = source
        logger.info("Fuente registrada: '%s'", name)
        return source

    def get(self, name: str) -> Optional[BaseSource]:
        """Obtiene una fuente por nombre, o None si no existe."""
        return self._sources.get(name)

    def all(self) -> list[BaseSource]:
        """Devuelve todas las fuentes registradas."""
        return list(self._sources.values())

    def names(self) -> list[str]:
        """Devuelve los nombres de todas las fuentes registradas."""
        return list(self._sources.keys())

    def filter(self, names: list[str]) -> list[BaseSource]:
        """Devuelve solo las fuentes cuyos nombres estén en la lista dada."""
        return [s for s in self._sources.values() if s.source_name in names]


# Instancia global del registro
registry = SourceRegistry()
