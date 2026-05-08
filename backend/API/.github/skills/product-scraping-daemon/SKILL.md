---
name: product-scraping-daemon
description: 'Diseña e implementa el daemon de actualizacion de productos con next_scrape_at, locking y prioridad determinista. Usar cuando se necesite scheduler de scraping, seleccion de elegibles, calculo de intervalo dinamico por volatilidad y ordenamiento por alert_priority.'
argument-hint: 'Contexto del daemon y reglas de negocio'
user-invocable: true
---

# Daemon De Actualizacion De Productos

## Resultado
Implementar un daemon que programe el "futuro" de scraping de cada producto sin re-evaluar todo el historial en cada ciclo.

## Cuando Usar
- Crear o refactorizar el proceso de actualizacion de informacion de productos.
- Definir elegibilidad, priorizacion y capacidad de scraping por lote.
- Traducir reglas de negocio a consultas SQL y logica de servicio.

## Entradas Esperadas
- `NOW()` de referencia para el ciclo actual.
- `capacidad_scraping` (cantidad maxima por ciclo).
- `alpha` para la formula de intervalo dinamico.
- Campos por producto: `next_scrape_at`, `locked_until`, `alert_priority`, `volatility_score`.

## Reglas De Negocio Obligatorias
1. Regla de elegibilidad:
- Un producto es elegible solo si `next_scrape_at <= NOW()`.
- Debe estar desbloqueado: `locked_until IS NULL OR locked_until <= NOW()`.

2. Regla de intervalo dinamico tras scraping exitoso:
- Formula:
  - `interval = base_interval / (1 + alpha * volatility_score)`
- Mapeo de `base_interval` por `alert_priority`:
  - `3` (Instantaneo) => `5 minutos`
  - `2` (Diario) => `12 horas`
  - `1` (Semanal) => `2 dias`
  - `0` (Sin alertas) => `14 dias`

3. Regla de prioridad bajo capacidad limitada:
- Ordenar elegibles por:
  - `alert_priority DESC`
  - `volatility_score DESC`
  - `next_scrape_at ASC`
- Seleccionar solo los primeros `capacidad_scraping`.

## Procedimiento Recomendado
1. Definir la ventana de ejecucion del daemon.
- Tomar `now = NOW()` al inicio del ciclo.
- Evitar usar varios timestamps distintos dentro del mismo lote para mantener determinismo.

2. Obtener candidatos elegibles y no bloqueados.
- Aplicar filtro de elegibilidad completo.
- Aplicar orden de prioridad obligatorio.
- Limitar por `capacidad_scraping`.

3. Bloquear productos seleccionados para evitar doble procesamiento.
- Antes de scrapear, marcar `locked_until` con una ventana corta de seguridad.
- Usar estrategia transaccional para prevenir carreras (por ejemplo, lock por fila o update condicional).

4. Scrapear cada producto seleccionado.
- Ejecutar scraping.
- Registrar resultado (exito o fallo), precio detectado y timestamp.

5. Si el scraping fue exitoso, recalcular `next_scrape_at`.
- Resolver `base_interval` segun `alert_priority`.
- Calcular `interval` con la formula dinamica.
- Guardar `next_scrape_at = now + interval`.
- Liberar lock (`locked_until = NULL` o expiracion inmediata).

6. Si el scraping falla, aplicar politica de fallo definida por el equipo.
- Mantener o ajustar `next_scrape_at` segun estrategia de reintento.
- Liberar lock para no bloquear indefinidamente.

## Decision Points (Branching)
- Si `volatility_score` es nulo o invalido:
  - Definir si se normaliza a `0` o se rechaza el producto del lote.
- Si `alert_priority` no esta en `0..3`:
  - Definir fallback (por ejemplo, tratar como `0`) o error de validacion.
- Si scraping falla por timeout/transitorio:
  - Definir backoff y maximo de reintentos.
- Si scraping devuelve datos inconsistentes:
  - Definir si se conserva el precio anterior y como se audita.

## Criterios De Calidad (Definition Of Done)
- Elegibilidad correcta:
  - Ningun producto se scrapea si `next_scrape_at > now`.
  - Ningun producto con lock vigente entra al lote.
- Priorizacion correcta:
  - El lote seleccionado respeta exactamente el orden `alert_priority DESC`, `volatility_score DESC`, `next_scrape_at ASC`.
- Programacion futura correcta:
  - Tras exito, cada producto actualiza `next_scrape_at` con la formula dinamica.
- Concurrencia segura:
  - El mismo producto no se procesa dos veces en paralelo.
- Observabilidad:
  - Existen metricas por ciclo: elegibles, procesados, exitos, fallos, latencia.

## Checklist De Pruebas
1. Prueba de elegibilidad por fecha.
2. Prueba de exclusion por lock vigente.
3. Prueba de ordenamiento de prioridad con empates.
4. Prueba de limite por capacidad.
5. Prueba de calculo de intervalo para cada `alert_priority`.
6. Prueba con distintos `volatility_score` y `alpha`.
7. Prueba de concurrencia (sin doble procesamiento del mismo producto).
8. Prueba de recuperacion tras fallo de scraping.

## Prompt De Ejemplo
- `/product-scraping-daemon Implementa el job del daemon en Spring Boot con JPA y consulta SQL paginada para elegibles.`
- `/product-scraping-daemon Diseña tests de integracion para validar prioridad y recalculo de next_scrape_at.`
- `/product-scraping-daemon Propone esquema de metricas y logs para monitorear el rendimiento del scraper.`
