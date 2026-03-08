"""Interfaces base para fuentes de scraping.

BaseSource: contrato mínimo que toda fuente debe cumplir.
BeautifulSoupSource: clase intermedia con Template Method para fuentes HTML.

Cómo añadir una nueva fuente:
  1. Crear app/sources/<nombre>.py extendiendo BeautifulSoupSource.
  2. Implementar source_name, build_url, wait_for_selector, _all_cards y los _extract_*.
  3. Registrarla al final: registry.register(MiSource())
  4. Importarla en app/sources/__init__.py.

Contrato de mensajería:
  Cada producto encontrado genera un RawScrapingResult independiente que se
  publica como un ScrapingMessage separado en la cola. La cola sigue recibiendo
  un producto por mensaje.
"""
from abc import ABC, abstractmethod
from typing import Any, Optional

from bs4 import BeautifulSoup, Tag

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

    @property
    def scroll_before_extract(self) -> bool:
        """
        Si True, Playwright hace scroll hasta el final de la página antes de
        extraer el HTML. Útil para fuentes con imágenes lazy-loaded que solo
        se cargan cuando el card entra en el viewport.
        Por defecto False; sobreescribir en fuentes que lo necesiten.
        """
        return False

    @abstractmethod
    def build_url(self, query: str, product_ref: str) -> str:
        """Construye la URL de búsqueda para esta fuente a partir de la query."""
        ...

    @abstractmethod
    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        """
        Extrae los campos crudos de TODOS los productos encontrados en el HTML.
        Cada elemento de la lista corresponde a un producto distinto y se
        publicará como un ScrapingMessage independiente en la cola.
        No aplica normalización semántica (responsabilidad del Normalizer Service).
        """
        ...


class BeautifulSoupSource(BaseSource, ABC):
    """
    Clase base para fuentes que usan BeautifulSoup para parseo HTML.

    Implementa el patrón Template Method:
      - `extract_all_results` parsea el HTML, obtiene todos los cards via
        `_all_cards()` y llama a los `_extract_*` por cada card.
      - `_all_cards(soup)` devuelve la lista de nodos/cards de la página.
      - `_extract_*(card, soup)` reciben tanto el card individual como el soup
        completo (útil para datos de contexto como breadcrumbs o moneda global).

    Campos obligatorios (abstractos): _all_cards, _extract_title, _extract_price.
    Campos opcionales (devuelven None por defecto): currency, availability,
    category, image, description.
    """

    def extract_all_results(self, html_content: str, job: ScrapingJob) -> list[dict[str, Any]]:
        """
        Parsea el HTML, itera sobre todos los cards del listing y devuelve
        una lista con los raw_fields de cada producto encontrado.
        Solo incluye productos que tengan al menos título o precio.
        """
        soup = BeautifulSoup(html_content, "lxml")
        results = []
        for card in self._all_cards(soup):
            fields = {
                "raw_title":        self._extract_title(card, soup),
                "raw_price":        self._extract_price(card, soup),
                "raw_currency":     self._extract_currency(card, soup),
                "raw_availability": self._extract_availability(card, soup),
                "raw_category":     self._extract_category(card, soup),
                "raw_image_url":    self._extract_image(card, soup),
                "raw_description":  self._extract_description(card, soup),
            }
            # Descartar cards sin datos útiles
            if fields["raw_title"] or fields["raw_price"]:
                results.append(fields)
        return results

    # ── Card discovery (obligatorio) ──────────────────────────────────────────

    @abstractmethod
    def _all_cards(self, soup: BeautifulSoup) -> list[Tag]:
        """Devuelve todos los nodos de producto de la página (cards del listing)."""
        ...

    # ── Extractores por card (obligatorios) ──────────────────────────────────

    @abstractmethod
    def _extract_title(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae el título/nombre del producto desde el card."""
        ...

    @abstractmethod
    def _extract_price(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae el precio como cadena cruda (sin parsear a float)."""
        ...

    # ── Extractores opcionales (defecto: None) ────────────────────────────────

    def _extract_currency(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae el código de moneda ISO 4217."""
        return None

    def _extract_availability(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae disponibilidad ('available', 'out_of_stock', etc.)."""
        return None

    def _extract_category(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae la categoría del producto (último breadcrumb, etc.)."""
        return None

    def _extract_image(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae la URL de la imagen principal del producto."""
        return None

    def _extract_description(self, card: Tag, soup: BeautifulSoup) -> Optional[str]:
        """Extrae la descripción/bullet points del producto (máx ~500 chars)."""
        return None
