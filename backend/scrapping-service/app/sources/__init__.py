"""Módulo de fuentes de scraping.

Al importar este paquete se registran automáticamente todas las fuentes
disponibles en el SourceRegistry.

Estructura de categorías:
  - electronics/: tiendas de electrónica, computadoras y celulares
  - fashion/: tiendas de moda, ropa y accesorios
  - general/: tiendas de descuento, supermercados y multi-categoría

Para agregar una nueva fuente:
  1. Crear un archivo en la subcarpeta correspondiente (ej: electronics/nuevatienda.py)
  2. Implementar BeautifulSoupSource (source_name, build_url, wait_for_selector, _all_cards, _extract_*)
  3. Al final del archivo llamar: registry.register(MiNuevaSource())
  4. Agregar el import en el __init__.py de la subcarpeta para que se auto-registre.
"""
from .registry import registry  # noqa: F401
from .base import BaseSource  # noqa: F401

# ── Auto-registro de fuentes por categoría ────────────────────────────────────
# Importa todos los módulos de cada subcarpeta para disparar registro automático.
from . import electronics  # noqa: F401
from . import fashion  # noqa: F401
from . import general  # noqa: F401
