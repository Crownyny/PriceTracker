# Pruebas de carga (PriceTracker)

## Requisitos

- Node.js 18+ (usa `fetch` en `http-api-only.mjs`)
- Stack levantado (`docker compose up` desde la carpeta `PriceTracker`)

## Instalación (una vez)

```bash
cd load-test
npm install
```

## 1) Carga “real” como el HTML (API + Rabbit + scraper + normalizador)

Simula N usuarios con SockJS + STOMP, cada uno con una búsqueda distinta (`… ld0`, `… ld1`, …) para no repetir el mismo `product_ref`.

```bash
node ws-load.mjs --users 4 --base http://localhost:8081 --query "iphone 12" --duration 120
```

Parámetros útiles:

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `--users` | 4 | Usuarios concurrentes (puedes subir a 10–20 si el PC y Docker aguantan) |
| `--base` | http://localhost:8081 | URL base de la API |
| `--query` | iphone 12 | Texto de búsqueda |
| `--duration` | 120 | Segundos activos antes de cerrar |
| `--ramp` | 500 | Milisegundos entre el arranque de cada usuario |
| `--quiet` | off | Menos log por producto |

Al final imprime totales de mensajes a `/user/queue/products` y tiempos hasta el primer producto.

## 2) Solo API por HTTP (sin scraping)

Para ver consumo del contenedor `api` sin disparar colas:

```bash
node http-api-only.mjs --url http://localhost:8081/actuator/health --concurrency 20 --duration 30
```

Si `actuator` no responde en esa ruta, prueba la que use tu imagen (por ejemplo `/api/actuator/health`).

## Observar consumo en Docker (tú)

En otra terminal:

```bash
docker stats
```

Filtra mentalmente por `pricetracker-api`, `pricetracker-normalizer`, `pricetracker-scrapper` (o los nombres que salgan en `docker compose ps`).

- **ws-load** → deberías ver actividad en API y, con retraso, en normalizer y scrapper.
- **http-api-only** → sobre todo API.

