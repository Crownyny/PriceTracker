# Copilot instructions for PriceTracker

## Build and test commands

### Backend API (Spring Boot, `backend/API`)

```bash
cd backend/API
mvn clean compile
mvn test
mvn -Dtest=ApiPriceTrackerApplicationTests test
mvn spring-boot:run
```

### Normalization service (Python, `backend/normalization-service`)

```bash
pip install ./backend/shared
pip install "./backend/normalization-service[test]"
pytest backend/normalization-service/tests -v --tb=short
pytest backend/normalization-service/tests/test_<file>.py::test_<name> -v
```

### Scrapping service (Python, `backend/scrapping-service`)

```bash
pip install ./backend/shared
pip install "./backend/scrapping-service[test]"
python -m playwright install --with-deps chromium
pytest backend/scrapping-service/app/scraper/test -v --tb=short
pytest backend/scrapping-service/app/scraper/test/test_<file>.py::test_<name> -v
```

### Integration path used in CI

```bash
docker compose up -d --build rabbitmq postgres model-product api
pytest backend/microServiceModelProduct/test/test_main.py -v --tb=short
docker compose down -v
```

## High-level architecture

PriceTracker backend is event-driven and polyglot:

1. `scrapping-service` consumes `scraping.jobs`, scrapes raw data, stores raw payloads, and emits lightweight result events.
2. `normalization-service` consumes scraper results, runs a LangGraph normalization pipeline, and emits normalized product events.
3. `API` (Spring Boot) listens to normalized events from RabbitMQ, persists/query data in PostgreSQL, and pushes status/results to clients through WebSocket/STOMP.

The Docker composition (`docker-compose.yml`) is the integration source of truth: RabbitMQ + PostgreSQL + `scrapper` + `normalizer` + `model-product` + `api` (+ Caddy TLS proxy for extension traffic).

## Key repository conventions

### API layering and flow

- API Java code follows a vertical split:
  - `Presentation/` (controllers, DTOs, MapStruct mappers)
  - `Services/IN` (application orchestration)
  - `Services/OUT` (Rabbit/WebSocket/external integrations)
  - `DataAccess/` (JPA entities/repositories)
- Message handling in API is two-step: `MessengerService` receives RabbitMQ messages and publishes Spring application events; `NormalizerProductService` handles those events, runs validation chain, then sends WebSocket updates.

### WebSocket session model

- WebSocket sessions are stored in-memory in `WebSocketConfig`, keyed by `productRef`.
- Client flow is `@MessageMapping("/search")` (destination `/app/search`) with private responses sent to `/user/queue/*` destinations (`/queue/products`, `/queue/status`, `/queue/errors`).
- Session cleanup on completion happens in `NormalizerProductService` when the `search.normalized` completion event arrives.

### Product-reference and cache behavior

- `product_ref`/`search_id` are derived from the incoming query by trimming and removing spaces (`ProductService.createProductRef`).
- Search dedup/short-circuiting uses in-memory Caffeine cache (`ProductRefCacheRepository`, 2-hour TTL), not persistent DB state.

### Validation and mapping conventions

- Product validation uses a chain-of-responsibility bean configured in `ValidatorChainConfig` with explicit order:
  `LogicalPriceValidator -> AccessoryAndVariantExclusionValidator -> SimilarityThresholdValidator`.
- Similarity threshold is property-driven (`app.validation.similarity-threshold`, default `0.70`).
- DTO/entity conversions use MapStruct interfaces implementing `GenericMapper<ENTITY, DTO>` with `componentModel = "spring"`.

### Naming contract to preserve

- `QueryDTOIN` keeps snake_case fields (`search_id`, `product_ref`) to match message/API contracts; avoid silently renaming these fields without coordinated changes across producers/consumers.
