package unicauca.edu.co.API.Services.IN.Email;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.DataAccess.Entity.NotificationEntity;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Entity.PriceHistoryEntity;
import unicauca.edu.co.API.DataAccess.Entity.UserEntity;
import unicauca.edu.co.API.DataAccess.Repository.AlertRepository;
import unicauca.edu.co.API.DataAccess.Repository.NotificationRepository;
import unicauca.edu.co.API.DataAccess.Repository.PriceHistoryRepository;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.DataAccess.Repository.UserRepository;
import unicauca.edu.co.API.Services.IN.Email.DTO.EmailNotificationRequestDTO;
import unicauca.edu.co.API.Services.IN.Email.DTO.NotificationTemplateType;
import unicauca.edu.co.API.Services.IN.Email.DTO.PriceChangeDirection;
import unicauca.edu.co.API.Services.IN.Email.DTO.ProductChangeEmailItemDTO;
import unicauca.edu.co.API.Services.Interfaces.IN.IEmailNotificationService;

/**
 * Daemon programado que evalua alertas y dispara correos.
 *
 * Reglas soportadas:
 * - instant: notifica cuando el ultimo precio difiere del anterior
 * - daily: a las 09:00 resume cambios de la ventana de 24h
 * - weekly: los lunes a las 09:00 resume cambios de la ultima semana
 *
 * Para evitar duplicados, registra cada envio en NotificationRepository.
 */
@Service
public class EmailNotificationDaemon {

    private static final Logger logger = LoggerFactory.getLogger(EmailNotificationDaemon.class);

    private final AlertRepository alertRepository;
    private final NotificationRepository notificationRepository;
    private final PriceHistoryRepository priceHistoryRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final IEmailNotificationService emailNotificationService;

    private final boolean notificationsEnabled;
    private final ZoneId zoneId;

    public EmailNotificationDaemon(
        AlertRepository alertRepository,
        NotificationRepository notificationRepository,
        PriceHistoryRepository priceHistoryRepository,
        ProductRepository productRepository,
        UserRepository userRepository,
        IEmailNotificationService emailNotificationService,
        @Value("${mail.notifications.enabled:false}") boolean notificationsEnabled,
        @Value("${mail.notifications.timezone:America/Bogota}") String zone
    ) {
        this.alertRepository = alertRepository;
        this.notificationRepository = notificationRepository;
        this.priceHistoryRepository = priceHistoryRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.emailNotificationService = emailNotificationService;
        this.notificationsEnabled = notificationsEnabled;
        this.zoneId = resolveZone(zone);
    }

    /**
     * Punto de entrada del scheduler. Se ejecuta cada minuto.
     */
    @Scheduled(cron = "${mail.notifications.cron:0 * * * * *}")
    @Transactional
    public void validateAndSendEmailNotifications() {
        if (!notificationsEnabled) {
            return;
        }

        LocalDateTime now = LocalDateTime.now(zoneId).withSecond(0).withNano(0);
        List<AlertEntity> activeAlerts = alertRepository.findByIsActiveTrue();

        if (activeAlerts.isEmpty()) {
            return;
        }

        Map<UUID, Optional<UserEntity>> usersCache = new HashMap<>();

        processInstantAlerts(activeAlerts, now, usersCache);

        if (isNineAm(now)) {
            processGroupedAlerts(
                activeAlerts,
                AlertEntity.AlertFrequency.daily,
                NotificationTemplateType.DAILY,
                "Resumen diario de alertas",
                now.minusDays(1),
                now,
                usersCache
            );
        }

        if (isMondayNineAm(now)) {
            processGroupedAlerts(
                activeAlerts,
                AlertEntity.AlertFrequency.weekly,
                NotificationTemplateType.WEEKLY,
                "Resumen semanal de alertas",
                now.minusWeeks(1),
                now,
                usersCache
            );
        }
    }

    /**
     * Procesa alertas inmediatas una por una.
     */
    private void processInstantAlerts(
        List<AlertEntity> activeAlerts,
        LocalDateTime now,
        Map<UUID, Optional<UserEntity>> usersCache
    ) {
        for (AlertEntity alert : activeAlerts) {
            if (alert.getFrequency() != AlertEntity.AlertFrequency.instant) {
                continue;
            }

            Optional<ProductChangeEmailItemDTO> optionalItem = resolveInstantChange(alert);
            if (optionalItem.isEmpty()) {
                continue;
            }

            ProductChangeEmailItemDTO item = optionalItem.get();
            

            Optional<String> optionalEmail = resolveUserEmail(alert.getUserId(), usersCache);
            if (optionalEmail.isEmpty()) {
                continue;
            }

            EmailNotificationRequestDTO request = new EmailNotificationRequestDTO(
                alert.getUserId(),
                optionalEmail.get(),
                NotificationTemplateType.INSTANT,
                "Cambio inmediato detectado en tus alertas",
                List.of(item)
            );

            try {
                emailNotificationService.sendNotification(request);
                persistNotification(item.alertId(), item.productId(), item.currentPrice(), now);
            } catch (Exception ex) {
                logger.error("No fue posible enviar correo inmediato para la alerta {}", alert.getId(), ex);
            }
        }
    }

    /**
     * Procesa alertas agrupadas por usuario para resumen diario o semanal.
     */
    private void processGroupedAlerts(
        List<AlertEntity> activeAlerts,
        AlertEntity.AlertFrequency frequency,
        NotificationTemplateType templateType,
        String subject,
        LocalDateTime start,
        LocalDateTime end,
        Map<UUID, Optional<UserEntity>> usersCache
    ) {
        Map<UUID, List<ProductChangeEmailItemDTO>> changesByUser = new HashMap<>();

        for (AlertEntity alert : activeAlerts) {
            if (alert.getFrequency() != frequency) {
                continue;
            }

            if (notificationRepository.existsByAlertIdAndSentAtBetween(alert.getId(), start, end)) {
                continue;
            }

            Optional<ProductChangeEmailItemDTO> optionalItem = resolveChangeInWindow(alert, start, end);
            if (optionalItem.isEmpty()) {
                continue;
            }

            ProductChangeEmailItemDTO item = optionalItem.get();
            

            changesByUser.computeIfAbsent(alert.getUserId(), key -> new ArrayList<>()).add(item);
        }

        for (Map.Entry<UUID, List<ProductChangeEmailItemDTO>> entry : changesByUser.entrySet()) {
            UUID userId = entry.getKey();
            List<ProductChangeEmailItemDTO> items = entry.getValue();
            Optional<String> optionalEmail = resolveUserEmail(userId, usersCache);
            if (optionalEmail.isEmpty()) {
                continue;
            }

            EmailNotificationRequestDTO request = new EmailNotificationRequestDTO(
                userId,
                optionalEmail.get(),
                templateType,
                subject,
                items
            );

            try {
                emailNotificationService.sendNotification(request);
                persistNotifications(items, end);
            } catch (Exception ex) {
                logger.error("No fue posible enviar correo agrupado para usuario {}", userId, ex);
            }
        }
    }

    /**
     * Determina si existe un cambio nuevo para una alerta instantanea.
     */
    private Optional<ProductChangeEmailItemDTO> resolveInstantChange(AlertEntity alert) {
        List<PriceHistoryEntity> latestHistory = priceHistoryRepository
            .findTop2ByProductIdOrderByRecordedAtDesc(alert.getProductId());

        if (latestHistory.size() < 2) {
            return Optional.empty();
        }

        PriceHistoryEntity latest = latestHistory.get(0);
        PriceHistoryEntity previous = latestHistory.get(1);

        if (samePrice(latest.getPrice(), previous.getPrice())) {
            return Optional.empty();
        }

        Optional<NotificationEntity> lastNotification = notificationRepository
            .findTopByAlertIdOrderBySentAtDesc(alert.getId());

        if (lastNotification.isPresent() && !lastNotification.get().getSentAt().isBefore(latest.getRecordedAt())) {
            return Optional.empty();
        }

        return buildProductItem(alert, previous.getPrice(), latest.getPrice(), latest.getRecordedAt());
    }

    /**
     * Determina el cambio dentro de una ventana temporal para alertas agregadas.
     */
    private Optional<ProductChangeEmailItemDTO> resolveChangeInWindow(
        AlertEntity alert,
        LocalDateTime start,
        LocalDateTime end
    ) {
        List<PriceHistoryEntity> historyInWindow = priceHistoryRepository
            .findByProductIdAndRecordedAtBetweenOrderByRecordedAtAsc(alert.getProductId(), start, end);

        if (historyInWindow.isEmpty()) {
            return Optional.empty();
        }

        PriceHistoryEntity latest = historyInWindow.get(historyInWindow.size() - 1);
        double baseline = priceHistoryRepository
            .findTopByProductIdAndRecordedAtBeforeOrderByRecordedAtDesc(alert.getProductId(), start)
            .map(PriceHistoryEntity::getPrice)
            .orElse(historyInWindow.get(0).getPrice());

        if (samePrice(latest.getPrice(), baseline)) {
            return Optional.empty();
        }

        return buildProductItem(alert, baseline, latest.getPrice(), latest.getRecordedAt());
    }

    /**
     * Enriquece la informacion del producto para el template de correo.
     */
    private Optional<ProductChangeEmailItemDTO> buildProductItem(
        AlertEntity alert,
        double previousPrice,
        double currentPrice,
        LocalDateTime detectedAt
    ) {
        Optional<NormalizedProductEntity> product = productRepository.findById(alert.getProductId());
        String productName = product.map(NormalizedProductEntity::getCanonicalName).orElse(alert.getProductId());
        String sourceName = product.map(NormalizedProductEntity::getSourceName).orElse("N/A");
        String sourceUrl = product.map(NormalizedProductEntity::getSourceUrl).orElse("");
        String currency = product.map(NormalizedProductEntity::getCurrency).orElse("COP");

        return Optional.of(new ProductChangeEmailItemDTO(
            alert.getId(),
            alert.getProductId(),
            productName,
            sourceName,
            sourceUrl,
            currency,
            previousPrice,
            currentPrice,
            resolveDirection(previousPrice, currentPrice),
            detectedAt
        ));
    }

    /**
     * Persiste multiples registros de notificacion enviados.
     */
    private void persistNotifications(List<ProductChangeEmailItemDTO> items, LocalDateTime sentAt) {
        for (ProductChangeEmailItemDTO item : items) {
            persistNotification(item.alertId(), item.productId(), item.currentPrice(), sentAt);
        }
    }

    /**
     * Persiste un registro de envio individual para trazabilidad y deduplicacion.
     */
    private void persistNotification(UUID alertId, String productId, double currentPrice, LocalDateTime sentAt) {
        NotificationEntity notification = new NotificationEntity();
        notification.setAlertId(alertId);
        notification.setListingId(productId);
        notification.setTriggeredPrice(BigDecimal.valueOf(currentPrice));
        notification.setSentAt(sentAt);
        notification.setWasRead(false);
        notificationRepository.save(notification);
    }

    /**
     * Resuelve correo de usuario activo usando cache local por corrida.
     */
    private Optional<String> resolveUserEmail(UUID userId, Map<UUID, Optional<UserEntity>> usersCache) {
        Optional<UserEntity> user = usersCache.computeIfAbsent(userId, userRepository::findById);

        return user
            .filter(currentUser -> currentUser.getDeleteAt() == null)
            .map(UserEntity::getEmail)
            .filter(this::hasText);
    }



    private PriceChangeDirection resolveDirection(double previousPrice, double currentPrice) {
        if (currentPrice > previousPrice) {
            return PriceChangeDirection.UP;
        }
        if (currentPrice < previousPrice) {
            return PriceChangeDirection.DOWN;
        }
        return PriceChangeDirection.SAME;
    }

    private boolean isNineAm(LocalDateTime dateTime) {
        return dateTime.getHour() == 9 && dateTime.getMinute() == 0;
    }

    private boolean isMondayNineAm(LocalDateTime dateTime) {
        return isNineAm(dateTime) && dateTime.getDayOfWeek() == DayOfWeek.MONDAY;
    }

    private boolean samePrice(double a, double b) {
        return Double.compare(a, b) == 0;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private ZoneId resolveZone(String zone) {
        try {
            return ZoneId.of(zone);
        } catch (Exception ex) {
            logger.warn("Zona horaria invalida '{}', se usa zona por defecto del sistema", zone);
            return ZoneId.systemDefault();
        }
    }
}
