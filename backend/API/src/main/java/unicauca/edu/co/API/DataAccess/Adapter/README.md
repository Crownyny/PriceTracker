# DataAccess Adapters Guide

## Objetivo
Contener adaptadores de infraestructura que implementan puertos de salida definidos en la capa de servicios.

## Implementacion actual
- `UserPersistenceAdapter` implementa `IUserPersistencePort`.

## Responsabilidades del adapter
- Traducir llamadas de negocio a repositorios JPA.
- Mapear modelos de dominio <-> entidades de persistencia.
- Mantener la dependencia a JPA encapsulada fuera de `Services/IN`.

## Regla de separacion
- Los adapters pueden depender de `DataAccess/Entity` y `DataAccess/Repository`.
- Los servicios de negocio no deben depender de esta carpeta directamente.
