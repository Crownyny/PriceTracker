# IN Interfaces (Inbound Ports)

## Objetivo
Define contratos de entrada para los casos de uso. Controladores y otros orquestadores deben depender de estas interfaces, no de implementaciones concretas.

## Contratos relevantes actuales
- `IAuthService`: validacion e invalidacion de cache de token.
- `IAuthorizationService`: checks de autenticacion, roles y permisos.
- `IUserService`: casos de uso de usuario y provision desde token.
- `IProductService`, `IIntentProductService`, `IHistoryPriceService`: contratos funcionales del dominio de producto.

## Reglas de diseño
- Mantener firmas orientadas a negocio, no a infraestructura.
- Evitar tipos de `DataAccess/Entity` en los metodos.
- Preferir modelos de dominio y DTOs de entrada/salida segun el caso de uso.
