# Tests — Normalization Service

Suite de pruebas del servicio de normalización. Contiene dos capas:

| Archivo | Tipo | Pruebas |
|---|---|---|
| `test_normalizer_pipeline.py` | **Unitarias** | 20 |
| `test_worker_integration.py` | **Integración** | 10 |

---

## Requisitos previos

- Python **3.11+**
- Las pruebas corren **sin Docker** ni servicios externos (RabbitMQ, PostgreSQL, OpenAI).

---

## Configuración del entorno

Se recomienda usar un entorno virtual para no instalar paquetes globalmente.

### 1. Crear y activar el entorno virtual

```bash
# Desde la raíz del repositorio
cd backend/

python3 -m venv .venv
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows (PowerShell)
```

### 2. Instalar el paquete compartido

```bash
pip install ./shared/
```

### 3. Instalar las dependencias del servicio de normalización

```bash
cd normalization-service/
pip install ".[test]"
```

> `.[test]` instala las dependencias del proyecto más `pytest` y `pytest-asyncio`, declaradas en `pyproject.toml`.  
> Si solo quieres las dependencias mínimas de test: `pip install pytest pytest-asyncio sqlalchemy asyncpg aio-pika langgraph langchain-core pydantic`

---

## Cómo ejecutar

Todos los comandos deben ejecutarse desde `backend/normalization-service/` con el entorno virtual activo.

### Ejecutar toda la suite (30 pruebas)

```bash
python -m pytest tests/ -v
```

### Solo las pruebas unitarias

```bash
python -m pytest tests/test_normalizer_pipeline.py -v
```

### Solo las pruebas de integración

```bash
python -m pytest tests/test_worker_integration.py -v
```

### Ejecutar una prueba específica

```bash
python -m pytest tests/ -v -k "test_precio_cop_formato_simple"
```

### Ver reporte con duración de cada prueba

```bash
python -m pytest tests/ -v --durations=10
```

---

## Pruebas unitarias — `test_normalizer_pipeline.py`

Prueban el **pipeline LangGraph** nodo a nodo, invocando `pipeline.ainvoke()` directamente con un estado inicial construido a partir de `raw_fields`.  
El `ProductRepository` se reemplaza con `AsyncMock`. No se usa LLM.

| # | Nombre del test | Qué valida |
|---|---|---|
| 1 | `test_precio_cop_formato_simple` | `"COP 72,007"` → `72007.0` (coma = separador de miles colombiano) |
| 2 | `test_precio_cop_con_decimales` | `"COP 73,854.30"` → `73854.30` (coma miles + punto decimal) |
| 3 | `test_precio_multiples_puntos_como_miles` | `"$1.999.000"` → `1999000.0` (múltiples puntos = miles) |
| 4 | `test_precio_formato_europeo` | `"1.999,00"` → `1999.0` (formato europeo: punto miles, coma decimal) |
| 5 | `test_precio_nulo_falla_validacion` | `raw_price=None` → `price=0` → `ProductValidator` rechaza → `normalization_failed` |
| 6 | `test_titulo_nulo_invalida_producto` | `raw_title=None` → `product_invalid=True`, pipeline termina en `error_end` |
| 7 | `test_titulo_vacio_invalida_producto` | `raw_title=""` → `product_invalid=True` |
| 8 | `test_availability_available_es_true` | `"available"` → `availability=True` en `final_product` |
| 9 | `test_availability_agotado_es_false` | `"agotado"` → `availability=False` |
| 10 | `test_moneda_cop_normalizada` | `raw_currency="COP"` → `currency="COP"` en `final_product` |
| 11 | `test_moneda_col_dollar_normalizada_a_cop` | `raw_currency="col$"` → código ISO 4217 `"COP"` |
| 12 | `test_moneda_defecto_fuente_exito` | Sin moneda + fuente `"exito"` → `"COP"` por `SOURCE_DEFAULT_CURRENCY` |
| 13 | `test_marca_gildan_detectada_en_heuristicas` | `"Gildan"` en título → `brand_candidates` contiene `"gildan"` |
| 14 | `test_marca_hanes_detectada_en_heuristicas` | `"Hanes"` en título → `brand_candidates` contiene `"hanes"` |
| 15 | `test_material_algodon_detectado` | `"algodón"` → `material_candidates` no vacío (heurística fashion) |
| 16 | `test_genero_hombre_detectado` | `"para Hombre"` → `gender_candidates` contiene `"hombre"` |
| 17 | `test_confianza_alta_salta_llm` | Marca + material + género → `heuristic_confidence ≥ 3`, nodo LLM saltado (`llm_attributes=None`) |
| 18 | `test_confianza_baja_activa_merger` | Título sin atributos → `heuristic_confidence < 3`, `llm_attributes={}` (con `llm=None`) |
| 19 | `test_canonical_name_incluye_marca_gildan` | `canonical_name` del producto final contiene `"gildan"` |
| 20 | `test_pipeline_producto_completo_todos_los_campos` | Producto real del JSON de Amazon → todos los campos obligatorios presentes y con valores correctos |

---

## Pruebas de integración — `test_worker_integration.py`

Prueban el **flujo completo del worker**: desde que llega un `ScrapingMessage` (simulando la cola RabbitMQ) hasta que se publica un `NormalizedEventMessage` (simulando la cola de salida).

El `NormalizerWorker` se instancia saltando el `__init__` con `object.__new__()` para evitar las conexiones reales a RabbitMQ y PostgreSQL. Se reemplazan con `AsyncMock`:
- `_publisher.publish` — cola de salida
- `_product_repo.upsert_product` — escritura en PostgreSQL
- `_product_repo.append_price_history` — historial de precios
- `_product_repo.increment_completed_jobs` — contador de búsqueda
- `_product_repo.record_expected_jobs` — registro del sentinel

| # | Nombre del test | Qué valida |
|---|---|---|
| 1 | `test_flujo_feliz_amazon_product_normalizado` | Producto Amazon completo → `NormalizedEventMessage.state="normalized"` publicado |
| 2 | `test_flujo_feliz_exito_sin_categoria` | Producto de Éxito con `raw_category=None` → `state="normalized"`, `upsert_product` llamado |
| 3 | `test_scraping_fallido_short_circuit` | `ScrapingState.FAILED` → short-circuit, `upsert_product` no llamado, publica `normalization_failed` |
| 4 | `test_titulo_nulo_produce_normalization_failed` | `raw_title=None` en el mensaje → publica `normalization_failed` |
| 5 | `test_precio_cop_en_texto_parseado_correctamente` | `"COP 73,854.30"` → `upsert_product` recibe `price≈73854.30` y `currency="COP"` |
| 6 | `test_fuente_mercadolibre_moneda_defecto_cop` | Sin `raw_currency` + fuente `"mercadolibre"` → `currency="COP"` en producto persistido |
| 7 | `test_fashion_extra_contiene_material_y_genero` | Producto rico en atributos → `extra["heuristic_confidence"] ≥ 3` en el producto persistido |
| 8 | `test_out_of_stock_persiste_como_false` | `"out of stock"` → `NormalizedProduct.availability=False` en el objeto pasado a `upsert_product` |
| 9 | `test_search_id_incrementa_contador_completados` | `search_id` presente → `increment_completed_jobs(search_id, product_ref)` llamado exactamente una vez |
| 10 | `test_publisher_llamado_con_queue_y_job_id_correctos` | `publish` llamado con `queue="normalized.events"` y `job_id` del mensaje original |

---

## Arquitectura de las pruebas

```
ScrapingMessage  ──►  NormalizerWorker._handle_scraping_message()
                             │
                             ▼
                      pipeline.ainvoke(initial_state)
                             │
                    ┌────────┴────────────────────────────┐
                    │  input_sanitizer                    │
                    │  field_standardizer                 │
                    │  text_canonicalizer                 │
                    │  attribute_extractor  (heurísticas) │
                    │  quality_evaluator                  │
                    │  [llm_extractor + merger]           │  ← solo si confianza < 3
                    │  semantic_normalizer                │
                    │  validation                        │
                    │  save  ──► upsert_product (mock)   │
                    └────────────────────────────────────┘
                             │
                             ▼
                   NormalizedEventMessage
                   publisher.publish (mock)  ──► "normalized.events"
```

### Dependencias externas mockeadas

| Dependencia | Mock | Motivo |
|---|---|---|
| PostgreSQL | `AsyncMock` en `upsert_product`, `append_price_history` | Sin BD real en CI |
| RabbitMQ | `AsyncMock` en `publisher.publish` | Sin broker real en pruebas |
| LLM (OpenAI) | `llm=None` en `build_pipeline` | Evitar llamadas a API de pago |

---

## Bug detectado por las pruebas

Las pruebas descubrieron un bug real en producción, que fue corregido:

**Archivo:** `app/graph/nodes/helpers.py`  
**Síntoma:** `AttributeError: 'NoneType' object has no attribute 'lower'` cuando `raw_category=None`  
**Causa:** `detect_domain()` llamaba `category.lower()` sin validar que `category` no fuera `None`  
**Corrección:** Cambiar `category.lower()` por `(category or "").lower()`

Este bug afectaba a todos los productos de Amazon del JSON de prueba, ya que Amazon no devuelve `raw_category`.
