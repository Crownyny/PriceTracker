"""Interfaces base para fuentes de scraping.

BaseSource: contrato mínimo que toda fuente debe cumplir.
BeautifulSoupSource: clase intermedia con Template Method para fuentes HTML.

Cómo añadir una nueva fuente:
  1. Crear app/sources/<nombre>.py extendiendo BeautifulSoupSource.
  2. Implementar source_name, build_url, wait_for_selector y los _extract_*.
  3. Registrarla al final: registry.register(MiSource())
  4. Importarla en app/sources/__init__.py.
"""
from abc import ABC, abstractmethod
from typing import Any, Optional

from bs4 import BeautifulSoup

from shared.model import ScrapingJob


class BaseSource(ABC):
    """Contrato mínimo que toda fuente de scraping debe implementar."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Nombre canónico de la fuente (ej: 'amazon', 'mercadolibre')."""
        ...

    @property
    def wait_for_selector(self) -> Optional[str]:
        """
        Selector CSS que Playwright esperará antes de extraer el HTML.
        Sobreescribir en fuentes con contenido renderizado por JavaScript (SPAs).
        Si es None, Playwright solo espera 'domcontentloaded'.
        """
        return None

    @abstractmethod
    def build_url(self, query: str, product_ref: str) -> str:
        """Construye la URL de búsqueda para esta fuente a partir de la query."""
        ...

    @abstractmethod
    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        """
        Extrae campos crudos del HTML renderizado por Playwright.
        No aplica normalización semántica (responsabilidad del Normalizer Service).
        Retorna siempre un dict con las claves raw_* definidas.
        """
        ...


class BeautifulSoupSource(BaseSource, ABC):
    """
    Clase base para fuentes que usan BeautifulSoup para parseo HTML.

    Implementa el patrón Template Method:
      - `extract_raw_fields` orquesta el parseo y llama a los extractores individuales.
      - `_extract_*` son métodos protegidos que las subclases implementan/sobreescriben.

    Campos obligatorios (abstractos): _extract_title, _extract_price.
    Campos opcionales (devuelven None por defecto): currency, availability, category,
    image, description. Las subclases sólo sobreescriben los que necesiten.
    """

    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        """Parsea el HTML con BeautifulSoup y devuelve todos los campos raw."""
        soup = BeautifulSoup(html_content, "lxml")
        return {
            "raw_title":        self._extract_title(soup),
            "raw_price":        self._extract_price(soup),
            "raw_currency":     self._extract_currency(soup),
            "raw_availability": self._extract_availability(soup),
            "raw_category":     self._extract_category(soup),
            "raw_image_url":    self._extract_image(soup),
            "raw_description":  self._extract_description(soup),
        }

    # ── Extractores obligatorios ──────────────────────────────────────────────

    @abstractmethod
    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae el título/nombre del producto."""
        ...

    @abstractmethod
    def _extract_price(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae el precio como cadena cruda (sin parsear a float)."""
        ...

    # ── Extractores opcionales (defecto: None) ────────────────────────────────

    def _extract_currency(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae el código de moneda ISO 4217. Sobreescribir si aplica."""
        return None

    def _extract_availability(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae disponibilidad ('available', 'out_of_stock', etc.)."""
        return None

    def _extract_category(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae la categoría del producto (último breadcrumb, etc.)."""
        return None

    def _extract_image(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae la URL de la imagen principal del producto."""
        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae la descripción/bullet points del producto (máx ~500 chars)."""
        return None
