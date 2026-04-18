# Domain Model Boundary

## Objective
Keep business logic independent from persistence details.

## Rule
- Classes under `Services/**` must not import JPA entities from `DataAccess/Entity/**`.
- Service contracts (`Services/Interfaces/IN`) expose domain models from `Domain/Model/**`.
- Persistence access from Services is done through output ports (`Services/Interfaces/OUT/**`).
- DataAccess adapters implement those ports and perform entity-domain mapping.

## Layer Responsibilities

- `Domain/Model`
  - Business state structures used by use cases.
  - No Spring, no JPA, no infrastructure concerns.
- `Services/Interfaces/IN`
  - Inbound use-case contracts consumed by controllers or other application layers.
- `Services/IN`
  - Business rules and orchestration.
  - Depends only on domain models and ports.
- `Services/Interfaces/OUT`
  - Outbound contracts needed by use cases (persistence, messaging, external APIs).
- `DataAccess/Adapter`
  - Infrastructure implementations of outbound ports.
  - Performs entity <-> domain conversion.
- `DataAccess/Entity` and `DataAccess/Repository`
  - Persistence details only.

## User Module Applied Pattern
- Domain model:
  - `Domain/Model/User`
  - `Domain/Model/UserRole`
- Inbound service contracts:
  - `IUserService`
  - `IAuthorizationService`
- Outbound port:
  - `IUserPersistencePort`
- Adapter:
  - `DataAccess/Adapter/UserPersistenceAdapter`

## Migration Recipe

When migrating an existing service that still uses entities directly:

1. Create domain model(s) in `Domain/Model`.
2. Move enum/value objects needed by business logic to domain.
3. Update IN interfaces to return/consume domain models.
4. Create OUT port for required persistence operations.
5. Implement adapter in `DataAccess/Adapter` using repositories.
6. Map entity <-> domain in adapter only.
7. Replace repository injection in service with OUT port injection.
8. Compile and validate endpoint behavior.

## Quality Checklist

- No `DataAccess/Entity` imports inside `Services/IN`.
- No `JpaRepository` imports inside `Services/IN`.
- Business contracts expose domain types, not JPA entities.
- Mapping logic lives in adapter layer.
- Build passes: `mvn -DskipTests compile`.

## Dependency Direction
`Presentation -> Services (IN) -> Services (OUT port) -> DataAccess Adapter -> Repository/JPA Entity`

This keeps domain and business rules testable without JPA dependencies.
