# Domain Model Guide

## Objetivo
Definir estructuras puras de negocio usadas por casos de uso, sin dependencia de framework o persistencia.

## Modelos actuales
- `User`
- `UserRole`

## Reglas
- No agregar anotaciones JPA, Spring o infraestructura en esta carpeta.
- Mantener nombres y campos orientados al negocio.
- Cuando cambie el dominio, actualizar mappings en adaptadores de infraestructura.

## Relacion con persistencia
- La conversion dominio <-> entidad JPA ocurre en `DataAccess/Adapter`.
- El dominio no conoce `DataAccess/Entity`.
