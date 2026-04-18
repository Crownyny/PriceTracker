# API PriceTracker

## Overview
API PriceTracker is a backend service built with Spring Boot that manages product price tracking, integration with scrapers, and real-time updates for price normalization processes. It uses a message-driven architecture with RabbitMQ and provides REST, WebSocket, and email notifications for client interaction.

## Technologies
- **Java 17**
- **Spring Boot 4.0.3**
  - Spring Web (MVC & WebFlux)
  - Spring Data JPA
   - Spring Security
  - Spring AMQP (RabbitMQ)
  - Spring WebSocket (STOMP)
   - Spring Mail
  - Spring Boot Actuator
- **PostgreSQL**: Primary database for product and price history storage.
- **RabbitMQ**: Message broker for asynchronous scraping jobs and event processing.
- **Caffeine**: In-memory caching for performance optimization.
- **MapStruct**: Type-safe bean mapping between entities and DTOs.
- **Lombok**: Reduced boilerplate code for POJOs.
- **Testcontainers**: Used for integration testing with real database and broker instances.
- **Docker**: Containerization and deployment.

## Requirements
- Java 17 JDK
- Maven 3.9+
- PostgreSQL (running instance or Docker)
- RabbitMQ (running instance or Docker)
- Docker (optional, for containerized execution)

## Setup and Run Commands

### Firebase Configuration
Para el correcto funcionamiento de la autenticación, se requiere un archivo JSON con las credenciales de la cuenta de servicio de Firebase.

1.  Crea un directorio llamado `config/` en el raíz del proyecto.
2.  Coloca el archivo JSON descargado de Firebase Console dentro de `config/` con el nombre `firebase-service-account.json`.
3.  Alternativamente, puedes configurar la ruta en `src/main/resources/application.properties` o usar la variable de entorno `GOOGLE_APPLICATION_CREDENTIALS`.

### Mail Configuration
El modulo de correos usa un archivo externo para evitar exponer credenciales en el repositorio.

1.  Copia `config/mail.properties.example` como `config/mail.properties`.
2.  Ajusta host, usuario y password SMTP reales.
3.  Define `mail.notifications.enabled=true` para activar el daemon.
4.  El archivo `config/mail.properties` esta en `.gitignore` y no se versiona.

### Local Development
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd PriceTracker/backend/API
   ```

2. **Configure Environment Variables**:
   Update `src/main/resources/application.properties` or set environment variables (see below).

3. **Build and Run**:
   ```bash
   mvn clean install
   mvn spring-boot:run
   ```

### Using Docker
You can build and run the application using the provided Dockerfile:
```bash
docker build -t price-tracker-api .
docker run -p 8080:8080 -e MODEL_PRODUCT_URL=http://your-model-url price-tracker-api
```

## Environment Variables
The application requires the following environment variables or properties:

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_DATASOURCE_URL` | PostgreSQL connection URL | `jdbc:postgresql://postgres:5432/pricetracker` |
| `SPRING_DATASOURCE_USERNAME` | DB Username | `postgres` |
| `SPRING_DATASOURCE_PASSWORD` | DB Password | `postgres` |
| `SPRING_RABBITMQ_HOST` | RabbitMQ host | `rabbitmq` |
| `SPRING_RABBITMQ_PORT` | RabbitMQ port | `5672` |
| `FIREBASE_CONFIG_PATH` | Ruta al archivo JSON de Firebase | `config/firebase-service-account.json` |
| `MODEL_PRODUCT_URL` | URL for the external product model service | *(Required)* |
| `SPRING_MAIL_HOST` | SMTP host | `smtp.example.com` |
| `SPRING_MAIL_PORT` | SMTP port | `587` |
| `SPRING_MAIL_USERNAME` | SMTP username | *(Required para envio real)* |
| `SPRING_MAIL_PASSWORD` | SMTP password | *(Required para envio real)* |
| `MAIL_SENDER_ADDRESS` | Address used in From header | `no-reply@pricetracker.local` |
| `MAIL_NOTIFICATIONS_ENABLED` | Enable scheduled email daemon | `false` |
| `MAIL_NOTIFICATIONS_TIMEZONE` | Timezone for 9:00 AM checks | `America/Bogota` |
| `MAIL_NOTIFICATIONS_CRON` | Scheduler cron expression | `0 * * * * *` |

## Scripts and Maven Commands
- `mvn clean compile`: Compiles the project.
- `mvn clean package`: Packages the application into a JAR file (skips tests by default in Docker build).
- `mvn test`: Runs unit and integration tests.
- `mvn spring-boot:run`: Runs the application locally.

## Project Structure
```text
├── src/main/java/unicauca/edu/co/API
│   ├── Config/              # Configuration classes (CORS, RabbitMQ, WebSocket, etc.)
│   ├── DataAccess/
│   │   ├── Entity/          # JPA Entities (NormalizedProduct, PriceHistory)
│   │   └── Repository/      # Spring Data Repositories
│   ├── Presentation/
│   │   ├── Controller/      # REST and WebSocket controllers
│   │   ├── DTO/             # Data Transfer Objects
│   │   └── Mapper/          # MapStruct Mappers
│   ├── Services/
│   │   ├── Events/          # Application events for internal decoupled logic
│   │   ├── IN/              # Inbound business logic services
│   │   │   └── Email/       # Email daemon, templates (Strategy), DTOs, orchestration
│   │   ├── OUT/             # Outbound infrastructure services (RabbitMQ, External APIs)
│   │   ├── Interfaces/      # Service definitions
│   │   └── Validators/      # Validation logic for products
│   └── ApiPriceTrackerApplication.java  # Main entry point
├── src/main/resources/      # Configuration files (application.properties)
├── src/test/                # Unit and integration tests
├── docs/                    # Technical guides and architecture notes
├── Dockerfile               # Docker image definition
└── pom.xml                  # Maven project configuration
```

## Email Notification Module

The email notification module was added to support alert-based communication per user frequency settings.

- **Instant alerts (`instant`)**:
   daemon checks every minute and sends email when latest product price differs from previous recorded price.
- **Daily alerts (`daily`)**:
   at 9:00 AM, daemon sends a summary if there was a price change during the last 24 hours.
- **Weekly alerts (`weekly`)**:
   every Monday at 9:00 AM, daemon sends a summary if there was a price change during the last week.

### Internal Flow

1. `EmailNotificationDaemon` reads active alerts from repository.
2. It evaluates price changes using `PriceHistoryRepository` and applies alert condition (`below`, `above`, `any_change`).
3. It builds an `EmailNotificationRequestDTO` with one or more `ProductChangeEmailItemDTO`.
4. `EmailNotificationService` delegates HTML generation to `EmailTemplateService`.
5. `EmailTemplateService` resolves template using Strategy (`INSTANT`, `DAILY`, `WEEKLY`).
6. `EmailSenderService` sends the final HTML email through Spring Mail.
7. Daemon persists records in `NotificationRepository` to avoid duplicated sends.

### Key Classes

- `Services/IN/Email/EmailNotificationDaemon`
- `Services/IN/Email/EmailNotificationService`
- `Services/IN/Email/EmailTemplateService`
- `Services/IN/Email/Template/*EmailTemplateStrategy`
- `Services/OUT/EmailSenderService`

## API & WebSocket Endpoints

### REST Endpoints
- **POST `/api/products/search`**: Search for products by reference.
- **POST `/api/intent/intent`**: Predict intent based on a query.
- **POST `/api/auth/validate`**: Validate a Firebase JWT and return user info.
- **POST `/api/auth/invalidate`**: Invalidate the cache for a specific JWT.
- **GET `/actuator/health`**: Health check endpoint.

## Authentication and Authorization

Security is implemented with Spring Security, JWT token validation and method-level authorization.

- Global filter: `JwtAuthenticationFilter` runs on every HTTP request.
- Token source: `Authorization: Bearer <token>`.
- Validation: token is validated by `IAuthService` (Firebase), then extra claims checks are applied (`exp`, `iss`, `aud`).
- User provisioning: authenticated user is resolved or auto-created through `IUserService`.
- Security context: a `UsernamePasswordAuthenticationToken` is created and stored in `SecurityContext`.
- Invalid token behavior: request is not blocked by the filter, but protected endpoints return `401`.
- Endpoint protection strategy:
   - Global `permitAll` at HTTP layer.
   - `@PreAuthorize` at method level for protected resources.

See full guide in `docs/security-authz.md`.

### WebSocket Endpoints
- **Endpoint**: `/ws` (Configured in `WebSocketConfig.java`)
- **Topic for Search**: `/app/search` (Inbound message mapping)
- **Topic for Status Updates**: `/user/queue/status` (Outbound status notifications)
- **Topic for Errors**: `/user/queue/errors` (Outbound error notifications)

## Tests
Unit and integration tests are located in `src/test/java`.
To run tests:
```bash
mvn test
```
The project uses **Testcontainers** to spin up PostgreSQL and RabbitMQ instances during integration testing, ensuring a realistic testing environment.

## Technical Documentation

- Detailed email module documentation: `docs/email-notifications.md`
- Domain boundary and business model rules: `docs/domain-model.md`
- Security and authorization guide: `docs/security-authz.md`
- Handoff playbook for contributors/agents: `docs/agent-handoff.md`
- Services layer map and responsibilities: `src/main/java/unicauca/edu/co/API/Services/README.md`
- Services use-cases (`IN`) details: `src/main/java/unicauca/edu/co/API/Services/IN/README.md`
- Inbound contracts (`Interfaces/IN`) details: `src/main/java/unicauca/edu/co/API/Services/Interfaces/IN/README.md`
- Outbound ports (`Interfaces/OUT`) details: `src/main/java/unicauca/edu/co/API/Services/Interfaces/OUT/README.md`
- Security package details: `src/main/java/unicauca/edu/co/API/Config/Security/README.md`
- Data adapters details: `src/main/java/unicauca/edu/co/API/DataAccess/Adapter/README.md`
- Domain model details: `src/main/java/unicauca/edu/co/API/Domain/Model/README.md`

## TODOs
- [ ] Add license information (currently empty in `pom.xml`).
- [ ] Document specific scraping strategies in `StrategyService`.
- [ ] Add more detailed documentation for WebSocket message formats.
- [ ] Include API documentation (e.g., Swagger/OpenAPI) if available.
- [ ] Add automated tests for email daemon windows (`instant`, `daily`, `weekly`).

## License
TODO: Add License (MIT, Apache 2.0, etc.)
