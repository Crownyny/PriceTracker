# Backend — PriceTracker

Arquitectura de microservicios orientada a eventos (**Event-Driven**). Los servicios se comunican de forma asíncrona mediante **RabbitMQ** como broker de mensajes.

---

## Estructura del repositorio

```
backend/
├── shared/                    # Paquete Python compartido (modelos + mensajería)
├── scrapping-service/         # Servicio de scraping
└── normalization-service/     # Servicio de normalización
```

---

## Flujo general

```
[Productor externo / CLI]
         │
         ▼  ScrapingJob (JSON)
  cola: scraping.jobs
         │
         ▼
 ┌───────────────────┐        RawScrapingResult
 │  scrapping-service│ ──────────────────────────► MongoDB
 └───────────────────┘
         │  ScrapingMessage (evento ligero, solo job_id)
         ▼  cola: scraping.results
 ┌───────────────────────┐
 │  normalization-service│ ──(lee de MongoDB)──► LangGraph pipeline
 └───────────────────────┘
         │  NormalizedEventMessage
         ▼  cola: normalized.events
    PostgreSQL (productos normalizados + historial de precios)
```

---

## 1. `shared/` — Contrato común

Paquete Python instalable que comparten ambos servicios. **No contiene lógica de negocio**, solo define los contratos de comunicación.

| Archivo | Contenido |
|---|---|
| `model.py` | Modelos Pydantic: `ScrapingJob`, `RawScrapingResult`, `ScrapingMessage`, `NormalizedProduct`, `NormalizedEventMessage`, `ScrapingState` |
| `messaging.py` | `RabbitMQConnection`, `BasePublisher`, `BaseConsumer` (con reintentos exponenciales y DLQ) |
| `pyproject.toml` | Se instala localmente con `pip install -e ../shared` |

### Estrategia de reintentos (`BaseConsumer`)

- Header `x-retry-count` se incrementa en cada reintento.
- Backoff exponencial: `delay = min(2^n, 30)` segundos.
- Tras `MAX_RETRIES = 3` intentos, el mensaje va a la **DLQ** para inspección manual.

---

## 2. `scrapping-service/` — Scraper

Descarga páginas web y persiste los datos crudos en MongoDB.

### Estructura interna

```
scrapping-service/
├── cli.py                     # Herramienta CLI para inyectar jobs manualmente
├── pyproject.toml
├── .env.example
├── Dockerfile
└── app/
    ├── main.py                # Arranque: FastAPI + ScraperWorker en paralelo
    ├── worker.py              # ScraperWorker(BaseConsumer): orquesta el flujo
    ├── publisher.py           # Publica ScrapingMessage → cola scraping.results
    ├── storage.py             # MongoRawRepository
    ├── config.py              # Settings via pydantic-settings + .env
    └── scraper/
        ├── base.py            # Interfaz abstracta BaseScraper
        └── http_scraper.py    # Implementación HTTP con httpx (HTML estático)
```

### Flujo de un mensaje

1. Recibe `ScrapingJob` de la cola `scraping.jobs`
2. `HttpScraper.scrape()` → descarga el HTML y extrae `raw_fields`
3. `MongoRawRepository.save()` → persiste `RawScrapingResult` en MongoDB
4. Publica `ScrapingMessage` (solo `job_id`, sin datos inline) → cola `scraping.results`

> **Nota:** Para sitios con JavaScript, sustituir `HttpScraper` por un `PlaywrightScraper`. El esqueleto ya está documentado en `http_scraper.py`.

### Variables de entorno (`.env.example`)

```env
AMQP_URL=amqp://guest:guest@rabbitmq:5672/
MONGODB_URL=mongodb://mongodb:27017
MONGODB_DB=pricetracker
API_HOST=0.0.0.0
API_PORT=8001
HTTP_TIMEOUT=30.0
USER_AGENT=PriceTrackerBot/1.0
```

---

## 3. `normalization-service/` — Normalizer

Consume eventos del Scraper, normaliza los datos crudos mediante un pipeline **LangGraph** y los persiste en PostgreSQL.

### Estructura interna

```
normalization-service/
├── pyproject.toml
├── .env.example
├── Dockerfile
└── app/
    ├── main.py                # Arranque: FastAPI + NormalizerWorker en paralelo
    ├── worker.py              # NormalizerWorker(BaseConsumer): invoca el pipeline
    ├── validator.py           # ProductValidator: reglas de negocio (precio > 0, etc.)
    ├── enricher.py            # Enriquecimiento LLM opcional (OpenAI / Anthropic)
    ├── storage.py
    ├── config.py
    ├── graph/
    │   ├── state.py           # NormalizationState: tipado del estado del grafo
    │   ├── pipeline.py        # Construye y compila el grafo LangGraph
    │   └── nodes.py           # Nodos: fetch_raw, clean, enrich, validate, save
    ├── normalizer/
    │   ├── base.py            # Interfaz BaseNormalizer
    │   └── rules.py           # DefaultNormalizer: reglas deterministas de limpieza
    └── repositories/
        ├── raw_repository.py      # Lee RawScrapingResult de MongoDB
        └── product_repository.py  # Upsert en PostgreSQL (SQLAlchemy async)
```

### Pipeline LangGraph

El núcleo del servicio es un grafo de estados con routing condicional:

```
START → fetch_raw ──(error)──► error_end → END
             │
            (ok)
             ▼
           clean
             ▼
         [enrich]  ← solo si ENABLE_ENRICHER=true y LLM configurado
             ▼
          validate ──(inválido)──► error_end → END
             │
            (ok)
             ▼
            save → END
```

| Nodo | Responsabilidad |
|---|---|
| `fetch_raw` | Lee `RawScrapingResult` de MongoDB usando `job_id` |
| `clean` | Aplica `DefaultNormalizer`: limpia strings, parsea precios, normaliza moneda |
| `enrich` | (Opcional) Llama al LLM para categorización o corrección de nombres |
| `validate` | Aplica `ProductValidator`: precio > 0, moneda ISO válida, campos requeridos |
| `save` | Upsert del producto en PostgreSQL + registro en historial de precios |

### Variables de entorno (`.env.example`)

```env
AMQP_URL=amqp://guest:guest@rabbitmq:5672/
MONGODB_URL=mongodb://mongodb:27017
MONGODB_DB=pricetracker
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/pricetracker
API_HOST=0.0.0.0
API_PORT=8002
ENABLE_ENRICHER=false
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
```

---

## Infraestructura

Definida en `docker-compose.yml` en la raíz del proyecto.

| Servicio | Imagen | Puerto | Rol |
|---|---|---|---|
| `rabbitmq` | rabbitmq:3.13-management | 5672 / **15672** | Broker de mensajes |
| `mongodb` | mongo:7 | 27017 | Datos crudos del scraper |
| `postgres` | postgres:16 | 5432 | Productos normalizados e historial de precios |
| `scrapper` | Dockerfile propio | **8001** | Scraper Service |
| `normalizer` | Dockerfile propio | **8002** | Normalizer Service |

> RabbitMQ Management UI: `http://localhost:15672` (usuario: `guest`, contraseña: `guest`)

---

## Cómo correrlo

### Opción A — Docker (todo en uno, recomendada)

```bash
# Desde la raíz del proyecto
docker compose up --build
```

Verificar que los servicios están activos:

```bash
curl http://localhost:8001/health   # {"status": "ok", "service": "scraper"}
curl http://localhost:8002/health   # {"status": "ok", "service": "normalizer"}
```

### Opción B — Desarrollo local de un servicio

```bash
# 1. Levantar solo la infraestructura
docker compose up rabbitmq mongodb postgres -d

# 2. Instalar dependencias del servicio (ejemplo: scraper)
cd backend/scrapping-service
cp .env.example .env        # ajustar URLs a localhost
pip install -e ../shared
pip install -e .

# 3. Correr el servicio
python -m app.main
```

### Opción C — Inyectar un job manualmente (CLI)

```bash
cd backend/scrapping-service

python cli.py \
  --url "https://example.com/product/123" \
  --source "example" \
  --ref "prod-123" \
  --priority 3 \
  --amqp-url "amqp://guest:guest@localhost:5672/"
```

---

## Agregar un nuevo servicio

1. Crear la carpeta en `backend/nuevo-servicio/`.
2. Instalar `shared` como dependencia: `pip install -e ../shared` y agregar `-e ../shared` al `requirements.txt` o `pyproject.toml`.
3. Usar `BaseConsumer` o `BasePublisher` de `shared.messaging` para conectarse a RabbitMQ.
4. Usar los modelos de `shared.model` para garantizar compatibilidad de contratos.

---

## Dependencias clave

| Librería | Uso |
|---|---|
| `pydantic` v2 | Validación y serialización de modelos |
| `aio-pika` | Cliente async para RabbitMQ |
| `motor` | Cliente async para MongoDB |
| `sqlalchemy[asyncio]` + `asyncpg` | ORM async para PostgreSQL |
| `httpx` | Cliente HTTP async para scraping |
| `langgraph` | Pipeline de normalización como grafo de estados |
| `fastapi` + `uvicorn` | API REST mínima para health checks |
