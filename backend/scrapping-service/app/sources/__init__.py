"""Módulo de fuentes de scraping.

Al importar este paquete se registran automáticamente todas las fuentes
disponibles en el SourceRegistry.

Para agregar una nueva fuente:
  1. Crear un archivo en este directorio (ej: falabella.py)
  2. Implementar BeautifulSoupSource (source_name, build_url, wait_for_selector, _all_cards, _extract_*)
  3. Al final del archivo llamar: registry.register(MiNuevaSource())
  4. Agregar el import aquí abajo para que se auto-registre al arrancar.
"""
from .registry import registry  # noqa: F401
from .base import BaseSource  # noqa: F401

# ── Auto-registro de fuentes disponibles ──────────────────────────────────────
# Cada import dispara el registry.register() al final del módulo correspondiente.
from . import amazon  # noqa: F401
from . import mercadolibre  # noqa: F401
from . import exito  # noqa: F401
from . import falabella  # noqa: F401
from . import olimpica  # noqa: F401
from . import alkosto  # noqa: F401
from . import homecenter  # noqa: F401
from . import aliexpress  # noqa: F401
from . import dafiti  # noqa: F401
from . import tecnoplaza  # noqa: F401
