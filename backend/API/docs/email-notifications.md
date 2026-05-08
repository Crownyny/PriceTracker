# Email Notifications Module

## Purpose
This module sends alert emails to users when tracked products change price.

It supports three frequencies already modeled in alerts:
- `instant`
- `daily`
- `weekly`

## Architecture

The implementation follows the existing project structure:

- Inbound orchestration: `Services/IN/Email`
- Template rendering: `Services/IN/Email/Template`
- Transport (SMTP): `Services/OUT/EmailSenderService`
- Contracts:
  - `Services/Interfaces/IN/IEmailNotificationService`
  - `Services/Interfaces/IN/IEmailTemplateService`
  - `Services/Interfaces/IN/IEmailTemplateStrategy`
  - `Services/Interfaces/OUT/IEmailSenderService`

## Main Components

### EmailNotificationDaemon
`EmailNotificationDaemon` runs every minute (`@Scheduled`) and evaluates if any alert requires notification.

Responsibilities:
1. Load active alerts from `AlertRepository`.
2. Resolve change windows using `PriceHistoryRepository`.
3. Evaluate alert condition (`below`, `above`, `any_change`).
4. Group items by user when needed (`daily`, `weekly`).
5. Trigger email delivery through `IEmailNotificationService`.
6. Persist sent notifications in `NotificationRepository`.

### EmailNotificationService
Orchestrates the final email pipeline:
1. Validate request.
2. Render email with `IEmailTemplateService`.
3. Send using `IEmailSenderService`.

### EmailTemplateService (Strategy)
Uses strategy selection by `NotificationTemplateType`:
- `INSTANT` -> `InstantEmailTemplateStrategy`
- `DAILY` -> `DailyEmailTemplateStrategy`
- `WEEKLY` -> `WeeklyEmailTemplateStrategy`

Each strategy returns a `RenderedEmailDTO` with:
- subject
- HTML body

### EmailSenderService
Infrastructure adapter over Spring Mail (`JavaMailSender`) to send HTML content with MIME messages.

## Scheduling Rules

Daemon cron is configurable via:
- `mail.notifications.cron` (default `0 * * * * *`)

Runtime rules:
1. Every minute:
   - evaluate `instant` alerts
2. At 9:00 AM in configured timezone:
   - evaluate `daily` alerts for last 24 hours
3. Every Monday at 9:00 AM:
   - evaluate `weekly` alerts for last 7 days

Timezone is configurable with:
- `mail.notifications.timezone` (default `America/Bogota`)

## Data and Repositories Used

- `AlertRepository`
  - source of active alert rules
- `PriceHistoryRepository`
  - reads historical prices to detect change direction
- `ProductRepository`
  - enriches email item details (name, source, currency, url)
- `UserRepository`
  - resolves recipient emails
- `NotificationRepository`
  - persists sent notifications and dedup checks

## Deduplication Behavior

Current logic avoids duplicate sends as follows:

- `instant`:
  compares latest sent notification time against latest price history timestamp.
- `daily` and `weekly`:
  checks if a notification already exists for alert within the evaluated window.

## DTO Contract

### EmailNotificationRequestDTO
Fields:
- `userId`
- `recipientEmail`
- `templateType`
- `subject`
- `products`

### ProductChangeEmailItemDTO
Fields:
- `alertId`
- `productId`
- `productName`
- `sourceName`
- `sourceUrl`
- `currency`
- `previousPrice`
- `currentPrice`
- `changeDirection` (`UP`, `DOWN`, `SAME`)
- `changeDetectedAt`

### RenderedEmailDTO
Fields:
- `subject`
- `htmlBody`

## Configuration

`application.properties` imports an optional external file:
- `spring.config.import=optional:file:config/mail.properties`

Use `config/mail.properties.example` as base and create local `config/mail.properties`.

Required keys for real SMTP delivery:
- `spring.mail.host`
- `spring.mail.port`
- `spring.mail.username`
- `spring.mail.password`
- `spring.mail.properties.mail.smtp.auth`
- `spring.mail.properties.mail.smtp.starttls.enable`

Module keys:
- `mail.sender.address`
- `mail.notifications.enabled`
- `mail.notifications.timezone`
- `mail.notifications.cron`

## Operational Notes

- Keep `mail.notifications.enabled=false` in local/dev if no SMTP is configured.
- Monitor logs for scheduler execution and send errors.
- For high volume, consider async delivery or queue-based outbox pattern in future iterations.

## Extension Guide

To add a new notification template type:
1. Add enum value in `NotificationTemplateType`.
2. Implement `IEmailTemplateStrategy`.
3. Register as Spring component (`@Component`).
4. Emit new type in daemon or caller.

To change business windows:
1. Update daemon window resolution methods.
2. Keep repository queries and dedup logic aligned.
3. Add tests for window boundaries.
