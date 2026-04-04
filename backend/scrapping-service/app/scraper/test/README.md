# Pruebas Unitarias del Scraper Service

Este directorio contiene las pruebas unitarias completas para el módulo de scraping del PriceTracker.

## 📁 Estructura de Archivos

```
test/
├── README.md                    # Este archivo
├── test_base.py                # Pruebas para BaseScraper (clase abstracta)
├── test_playwright_scraper.py   # Pruebas para PlaywrightScraper (implementación principal)
└── test_integration.py          # Pruebas de integración y casos límite
```

## 🧪 Suite de Pruebas

### `test_base.py` - Pruebas del Contrato Abstracto
- **7 pruebas** que validan la interfaz `BaseScraper`
- Verifican que es una clase abstracta con métodos abstractos
- Prueban implementaciones concretas de ejemplo
- Validan firmas y documentación de métodos

### `test_playwright_scraper.py` - Pruebas Principales
- **16 pruebas** exhaustivas para `PlaywrightScraper`
- Ciclo de vida del browser (inicio/parada)
- Scraping exitoso y manejo de errores
- Configuración de proxy, scroll, y timeouts
- Limpieza de recursos y manejo de concurrencia

### `test_integration.py` - Pruebas de Integración
- **13 pruebas** de casos límite y escenarios complejos
- Concurrencia de múltiples jobs de scraping
- Manejo de errores extremos (caídas, timeouts)
- Soporte para Unicode, HTML malformado, URLs largas
- Validación de consistencia de datos y memoria

## 🚀 Cómo Ejecutar las Pruebas

### Prerrequisitos
```bash
# Activar el entorno conda
conda activate SCRAPPING

# O instalar pytest-asyncio si no está disponible
pip install pytest-asyncio
```

### Ejecutar Todas las Pruebas
```bash
# Desde la raíz del proyecto
cd /home/crwy/Documents/9th\ Semester/Proyecto/2V/PriceTracker/backend/scrapping-service
python -m pytest app/scraper/test/ -v

# Desde el directorio de pruebas
cd app/scraper/test
pytest -v
```

### Ejecutar Pruebas Específicas
```bash
# Solo pruebas del scraper principal
pytest test_playwright_scraper.py -v

# Solo pruebas de integración
pytest test_integration.py -v

# Solo pruebas del contrato base
pytest test_base.py -v

# Una prueba específica
pytest test_playwright_scraper.py::TestPlaywrightScraper::test_start_stop_lifecycle -v
```

### Opciones Útiles
```bash
# Ejecutar con cobertura de código
pytest --cov=app.scraper --cov-report=html

# Ejecutar en paralelo (más rápido)
pytest -n auto

# Ver solo pruebas que fallen
pytest -v --tb=short

# Ejecutar sin advertencias
pytest -v -W ignore::UserWarning
```

## 📊 Resultados Esperados

Al ejecutar todas las pruebas deberías ver:
```
========================== 36 passed in 0.52s ==========================
```

### Distribución de Pruebas
- **test_base.py**: 7 pruebas
- **test_playwright_scraper.py**: 16 pruebas  
- **test_integration.py**: 13 pruebas
- **Total**: 36 pruebas

## 🔧 Configuración

Las pruebas utilizan:
- **pytest**: Framework de pruebas principal
- **pytest-asyncio**: Soporte para funciones asíncronas
- **unittest.mock**: Mocking de dependencias externas
- **Playwright mocking**: Evita dependencias reales del browser

### Variables de Entorno
No se requieren variables de entorno especiales. Las pruebas usan mocks para todas las dependencias externas.

## 🐛 Depuración

### Si una prueba falla:
```bash
# Ejecutar con salida detallada
pytest test_playwright_scraper.py::TestPlaywrightScraper::test_failing_test -v -s

# Ejecutar con depurador
pytest --pdb test_playwright_scraper.py::TestPlaywrightScraper::test_failing_test

# Ver solo las pruebas que fallen
pytest -v --tb=short -x
```

### Advertencias Comunes
- `UserWarning: Stealth has already been applied`: Advertencia no crítica de playwright-stealth
- `ImportWarning`: Advertencias de importación que no afectan la funcionalidad

## 📝 Cobertura de Funcionalidades

Las pruebas cubren:

### ✅ Funcionalidades Principales
- [x] Inicialización del scraper
- [x] Ciclo de vida del browser
- [x] Extracción de datos básica
- [x] Manejo de resultados exitosos

### ✅ Manejo de Errores
- [x] Errores de red transitorios
- [x] Timeouts de navegación
- [x] Caídas del browser
- [x] Errores de configuración de proxy
- [x] HTML malformado o vacío

### ✅ Características Avanzadas
- [x] Soporte para proxy residencial
- [x] Scroll automático para lazy-loading
- [x] Scripts stealth anti-detección
- [x] Espera de selectores específicos
- [x] Concurrencia de múltiples jobs

### ✅ Casos Límite
- [x] URLs extremadamente largas
- [x] Caracteres Unicode y especiales
- [x] Grandes volúmenes de resultados
- [x] Consistencia de IDs únicos
- [x] Limpieza de memoria

## 🔄 Integración Continua

Las pruebas están diseñadas para ejecutarse en CI/CD:

```yaml
# Ejemplo para GitHub Actions
- name: Run Tests
  run: |
    conda activate SCRAPPING
    python -m pytest app/scraper/test/ -v --tb=short
```

## 📚 Referencias

- [Documentación de pytest](https://docs.pytest.org/)
- [Documentación de pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [Documentación de unittest.mock](https://docs.python.org/3/library/unittest.mock.html)

---

**Última actualización**: Abril 2026  
**Total de pruebas**: 36  
**Estado**: ✅ Todas pasando
