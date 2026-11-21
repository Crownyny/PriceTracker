# PriceTracker

Multi-store price tracking platform for Colombian and international retailers. It scrapes product pages, normalizes product data, stores price history, and exposes a real-time API with alerts, wishlists, and notifications.

> Collaborative project built by a four-person team at Universidad del Cauca. This fork tracks my work on the scraping and wishlist modules in the dev/julian branch.

## Architecture

~~~
Angular frontend
      |  REST + WebSocket (STOMP)
      v
   Caddy (reverse proxy)
      |
      v
Spring Boot API (Java 17) -------- PostgreSQL
      |                                 ^
      | RabbitMQ                        |
      v                                 |
Scraper (Python + Playwright) --> Normalizer (Python) --> Model service (purchase intent)
~~~

## Services

| Service | Stack | Responsibility |
| --- | --- | --- |
| backend/scrapping-service | Python, Playwright, RabbitMQ | Scrapes product pages from 20+ stores; JS rendering, lazy loading, proxies, CAPTCHA |
| backend/normalization-service | Python, LangGraph, PostgreSQL | Normalizes raw product data and stores price history |
| backend/microServiceModelProduct | Python | Purchase-intent model service |
| backend/API | Java 17, Spring Boot 4, PostgreSQL, RabbitMQ, WebSocket/STOMP | REST API, JWT/Firebase auth, wishlist, alerts, notifications |
| frontend/price-traker | Angular 21, TypeScript, STOMP/SockJS | Web UI with real-time price updates |
| Caddyfile | Caddy | Reverse proxy and local TLS |

## Tech stack

- **Scraping:** Python, Playwright, asyncio, RabbitMQ
- **Backend:** Java 17, Spring Boot 4, Spring Security, Spring Data JPA, Spring AMQP, WebSocket/STOMP, MapStruct, Testcontainers
- **Data:** PostgreSQL 16, LangGraph, semantic validation
- **Frontend:** Angular 21, TypeScript, RxJS, STOMP/SockJS
- **Infrastructure:** Docker Compose, Caddy, RabbitMQ 3.13

## Features

- Multi-store scraping with per-store extractors and a source registry
- JavaScript rendering and lazy-loading support via Playwright
- Proxy and CAPTCHA handling for stores that require it
- Asynchronous streaming of scraping results with unique job IDs and error handling
- Relevance scoring and duplicate-URL filtering
- Product normalization and semantic validation
- Price history, alerts, wishlist, and email notifications
- Real-time updates over WebSocket
- Role-based access with Firebase/JWT

## Getting started

### Prerequisites

- Docker and Docker Compose
- Java 17 and Maven (only for local API development)
- Node.js 20+ and Angular CLI (only for local frontend development)

### Run the full stack

~~~bash
git clone https://github.com/Crownyny/PriceTracker.git
cd PriceTracker
git checkout dev/julian
docker compose up --build
~~~

| Service | URL |
| --- | --- |
| Frontend | http://localhost:4200 |
| API | http://localhost:8080 |
| Scraper health | http://localhost:8001/health |
| RabbitMQ management | http://localhost:15672 (guest/guest) |
| Caddy | http://localhost |

### Configuration

Copy the example files and set your own credentials:

- backend/API/config/mail.properties.example -> config/mail.properties
- Firebase service account -> config/firebase-service-account.json
- See backend/API/README.md for the full environment variable reference.

> Never commit real credentials. The config/ directory is gitignored.

## Repository structure

~~~
PriceTracker/
├── backend/
│   ├── API/                       # Spring Boot REST API
│   ├── scrapping-service/         # Python + Playwright scrapers
│   ├── normalization-service/     # Normalization + semantic validation
│   ├── microServiceModelProduct/  # Purchase-intent model service
│   └── shared/                    # Shared models and messaging contracts
├── frontend/price-traker/         # Angular frontend
├── scripts/
├── docker-compose.yml
└── Caddyfile
~~~

## My contributions (dev/julian)

- Refactored the scraping service from static HTTP scraping to **Playwright** for JavaScript-rendered pages.
- Implemented and registered **20+ store scrapers**, including Amazon, MercadoLibre, Éxito, Falabella, Olímpica, Alkosto, AliExpress, Homecenter, Dafiti, Alkomprar, Computienda, D1, Miniso, Jumbo, Totto, Vélez, Arturo Calle, Mattelsa, H&M, Mango, and Seven Seven.
- Added **lazy-loading** support, **proxy** configuration, and **CAPTCHA handling** for AliExpress.
- Migrated the scraper to **async generators** for real-time result streaming, with unique job IDs and improved error handling.
- Added **relevance scoring**, configurable concurrency, and **duplicate-URL filtering**.
- Built the **wishlist module** in the Spring Boot API: entities, repositories, service/controller methods, item-limit validation, and Javadoc.
- Added automated tests and Docker Compose adjustments; removed the SearXNG dependency to simplify the discovery architecture.

## Team

- Julian David Meneses Daza ([@Crownyny](https://github.com/Crownyny))
- [@maxskaink](https://github.com/maxskaink)
- Isabela Sánchez Saavedra
- Santiago Escandón

## License

Apache License 2.0. See [LICENSE](LICENSE).

---

This repository is a fork of [maxskaink/PriceTracker](https://github.com/maxskaink/PriceTracker). Active development for this fork happens on the [dev/julian](https://github.com/Crownyny/PriceTracker/tree/dev/julian) branch.
