"""Fuente: Amazon Colombia.

Implementación de ejemplo. Los selectores de extract_raw_fields deben
ajustarse al HTML real de Amazon cuando se integre con BeautifulSoup/lxml.
"""
from typing import Any
from urllib.parse import quote_plus

from shared.model import ScrapingJob

from .base import BaseSource
from .registry import registry


class AmazonSource(BaseSource):

    @property
    def source_name(self) -> str:
        return "amazon"

    def build_url(self, query: str, product_ref: str) -> str:
        return f"https://www.amazon.com/s?k={quote_plus(query)}"

    def extract_raw_fields(self, html_content: str, job: ScrapingJob) -> dict[str, Any]:
        # TODO: implementar extracción real con BeautifulSoup/lxml
        return {
            "raw_title": None,
            "raw_price": None,
            "raw_currency": "USD",
            "raw_availability": None,
            "raw_category": None,
            "raw_image_url": None,
            "raw_description": None,
        }


# Auto-registro al importar el módulo
registry.register(AmazonSource())
