# Services Layer Guide

## Objetivo
Esta carpeta contiene la logica de negocio de la aplicacion y define la separacion entre casos de uso e infraestructura.

## Separacion por carpetas
- `IN/`: implementaciones de casos de uso.
- `Interfaces/IN/`: contratos de entrada (use cases).
- `Interfaces/OUT/`: contratos de salida (puertos a infraestructura).
- `OUT/`: implementaciones orientadas a integraciones externas.
- `Events/`: eventos internos de aplicacion.
- `Validators/`: reglas de validacion reutilizables.

## Regla de dependencias
- `IN/` puede depender de `Interfaces/IN`, `Interfaces/OUT` y modelos de `Domain/Model`.
- `IN/` no debe importar entidades JPA de `DataAccess/Entity`.
- La persistencia se consume via puertos `Interfaces/OUT` y se implementa en adaptadores de `DataAccess/Adapter`.

## Convencion para nuevos casos de uso
1. Definir contrato en `Interfaces/IN`.
2. Si requiere IO externo, definir puerto en `Interfaces/OUT`.
3. Implementar caso de uso en `IN` usando modelos de dominio.
4. Implementar adapter en infraestructura para puertos de salida.
5. Documentar el flujo en el `README.md` de la subcarpeta correspondiente.
