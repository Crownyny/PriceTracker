# Agent and Contributor Handoff Playbook

## Goal
Provide enough context so another agent or developer can continue work without rediscovery.

## Current Architecture Decisions

1. Security is token-based and stateless.
2. HTTP layer is globally `permitAll`; protection is method-level with `@PreAuthorize`.
3. Services should use domain models, not JPA entities directly.
4. Data access for business services should go through output ports and adapters.
5. Product scraping orchestration runs from a scheduler daemon using queue metadata in `normalized_products`.

## Mandatory Rule: Service Boundary

Do not import `DataAccess/Entity/*` inside `Services/*` for new/refactored modules.

Use this direction:

`Presentation -> Services/Interfaces/IN -> Services/IN -> Services/Interfaces/OUT -> DataAccess/Adapter -> DataAccess/Repository`

## Product Scraping Daemon Components

- Inbound contract:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/IN/IProductScrapingDaemonService.java`
- Service implementation:
  - `src/main/java/unicauca/edu/co/API/Services/IN/ProductScrapingDaemonService.java`
- Outbound ports:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/OUT/IProductScrapingQueuePort.java`
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/OUT/IScrapingService.java`
- Data adapter:
  - `src/main/java/unicauca/edu/co/API/DataAccess/Adapter/ProductScrapingQueueAdapter.java`

## Reference Implementation (User Module)

Use the user module as the template for new modules:

- Domain model:
  - `src/main/java/unicauca/edu/co/API/Domain/Model/User.java`
  - `src/main/java/unicauca/edu/co/API/Domain/Model/UserRole.java`
- Inbound contract:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/IN/IUserService.java`
- Service implementation:
  - `src/main/java/unicauca/edu/co/API/Services/IN/UserService.java`
- Outbound persistence port:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/OUT/IUserPersistencePort.java`
- Data adapter:
  - `src/main/java/unicauca/edu/co/API/DataAccess/Adapter/UserPersistenceAdapter.java`

## How to Implement a New Module (Recommended Sequence)

1. Create domain model in `Domain/Model`.
2. Define inbound use-case contract in `Services/Interfaces/IN`.
3. Define outbound infrastructure contract in `Services/Interfaces/OUT`.
4. Implement business logic in `Services/IN` using only domain models and ports.
5. Implement adapter in `DataAccess/Adapter` to map entity <-> domain.
6. Wire endpoint/controller to inbound service contract.
7. Add method-level authorization with `@PreAuthorize` if needed.
8. Add/update docs.

## Security Integration Checklist for New Endpoints

1. Decide if endpoint is public or protected.
2. For protected endpoint, annotate with `@PreAuthorize`.
3. If role-based, use role expression (`hasRole`, `hasAnyRole`).
4. If permission-based, add permission and check through `IAuthorizationService`.
5. Validate expected status codes (`401`/`403`).

## Testing Checklist

1. Build runs:
   - `mvn -DskipTests compile`
2. For security changes:
   - protected endpoint no token -> `401`
   - invalid token -> `401`
   - valid token -> success path
3. For role changes:
   - lower role denied
   - required role allowed

## Known Technical Debt

These services still import entities directly and can be migrated using the same pattern:

- `src/main/java/unicauca/edu/co/API/Services/IN/ProductService.java`
- `src/main/java/unicauca/edu/co/API/Services/IN/StrategyService.java`
- `src/main/java/unicauca/edu/co/API/Services/IN/Email/EmailNotificationDaemon.java`
- `src/main/java/unicauca/edu/co/API/Services/Interfaces/OUT/IMessengerService.java`

## Documentation Index

- Main project guide: `README.md`
- Domain boundary: `docs/domain-model.md`
- Security and authz: `docs/security-authz.md`
- Email module: `docs/email-notifications.md`

## Segmented Docs by Folder

- Services root:
  - `src/main/java/unicauca/edu/co/API/Services/README.md`
- Services use cases:
  - `src/main/java/unicauca/edu/co/API/Services/IN/README.md`
- Inbound ports:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/IN/README.md`
- Outbound ports:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/OUT/README.md`
- Security package:
  - `src/main/java/unicauca/edu/co/API/Config/Security/README.md`
- Data adapters:
  - `src/main/java/unicauca/edu/co/API/DataAccess/Adapter/README.md`
- Domain model:
  - `src/main/java/unicauca/edu/co/API/Domain/Model/README.md`
