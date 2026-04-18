# Services IN (Use Cases)

## Objetivo
Contiene implementaciones de logica de negocio. Cada clase aqui representa un caso de uso o un servicio de aplicacion.

## Servicios principales
- `FirebaseAuthService`: validacion de token Firebase usando `IAuthService`.
- `AuthorizationService`: validacion de roles/permisos y parsing de bearer token.
- `UserService`: reglas de usuario y aprovisionamiento automatico desde token.
- `ProductService`: busquedas y orquestacion relacionada a productos.
- `IntentProductService`: integracion con servicio de intencion.
- `HistoryPriceService`: logica de historial de precios.
- `ReferenceCheckService` y `StrategyService`: soporte a estrategia de busqueda.

## Regla de separacion
- No usar repositorios JPA directamente en esta carpeta.
- Consumir persistencia via puertos de salida (`Services/Interfaces/OUT`).
- Trabajar con modelos de dominio (`Domain/Model`) en lugar de entidades JPA.

## Seguridad y autorizacion
- Endpoints protegidos se manejan con `@PreAuthorize`.
- Cuando se requiere chequeo explicito en negocio, usar `IAuthorizationService`.

## Checklist para agregar un nuevo servicio en IN
1. Crear contrato en `Services/Interfaces/IN`.
2. Crear implementacion en esta carpeta.
3. Si requiere DB/API externa, depender de puerto en `Interfaces/OUT`.
4. Agregar pruebas y documentar comportamiento.
