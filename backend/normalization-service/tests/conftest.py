"""Configuración de pytest para el servicio de normalización.

Agrega al sys.path los directorios necesarios para importar:
  - app.*        → normalization-service/
  - shared.*     → backend/
"""
import os
import sys

# backend/normalization-service/  →  permite "from app.xxx import ..."
_SERVICE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# backend/  →  permite "from shared.xxx import ..."
_BACKEND_ROOT = os.path.abspath(os.path.join(_SERVICE_ROOT, ".."))

for _p in (_SERVICE_ROOT, _BACKEND_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)
