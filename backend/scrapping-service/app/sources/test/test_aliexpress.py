"""Pruebas puntuales para la fuente AliExpress."""

import sys
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

# Añadir el backend y el root del servicio al path
_service_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(_service_root))
sys.path.insert(0, str(_service_root.parent))

from app.sources.electronics.aliexpress import AliexpressSource


@pytest.fixture
def source():
    return AliexpressSource()


def _card(html: str):
    soup = BeautifulSoup(html, "lxml")
    return soup.select_one(".search-item-card-wrapper-gallery"), soup


def test_aliexpress_currency_es_cop(source):
    card, soup = _card(
        """
        <div class="search-item-card-wrapper-gallery">
          <div tabindex="0" aria-label="$800.671"></div>
        </div>
        """
    )

    assert source._extract_currency(card, soup) == "COP"


def test_aliexpress_currency_usd_para_us_symbol(source):
    card, soup = _card(
        """
        <div class="search-item-card-wrapper-gallery">
          <div tabindex="0" aria-label="US$800.671"></div>
        </div>
        """
    )

    assert source._extract_currency(card, soup) == "USD"
