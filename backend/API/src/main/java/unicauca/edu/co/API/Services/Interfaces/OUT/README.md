# OUT Interfaces (Outbound Ports)

## Objetivo
Define puertos hacia infraestructura externa: persistencia, mensajeria y servicios externos.

## Puertos actuales
- `IUserPersistencePort`: acceso a datos de usuario desde logica de negocio.
- `IMessengerService`: integracion con mensajeria/eventos.
- `INormalizerProductService`: integracion de normalizacion.
- `IScrapingService`: integracion con scraping.
- `IEmailSenderService`: envio de correo.

## Regla de implementacion
- Las implementaciones concretas viven fuera de la capa de negocio.
- Para persistencia relacional, usar adaptadores en `DataAccess/Adapter`.
- Para integraciones externas, usar implementaciones en `Services/OUT`.

## Beneficio
Esta separacion permite testear servicios de negocio con mocks de puertos, sin framework ni base de datos real.
