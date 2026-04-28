package unicauca.edu.co.API.Presentation.Controller;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import unicauca.edu.co.API.DataAccess.Entity.AlertEntity;
import unicauca.edu.co.API.DataAccess.Entity.NormalizedProductEntity;
import unicauca.edu.co.API.DataAccess.Repository.AlertRepository;
import unicauca.edu.co.API.DataAccess.Repository.ProductRepository;
import unicauca.edu.co.API.Presentation.DTO.OUT.DaemonTriggerResultDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.EmailAlertsStatusDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.ScrapingDaemonStatusDTO;
import unicauca.edu.co.API.Presentation.DTO.OUT.ScrapingQueuePreviewItemDTO;
import unicauca.edu.co.API.Services.IN.ProductScrapingDaemonService;
import unicauca.edu.co.API.Services.IN.Email.EmailNotificationDaemon;

@RestController
@Profile({"dev", "test", "test-integration"})
@RequestMapping("/api/internal/test")
public class AdminDaemonTestController {

    private final ProductScrapingDaemonService productScrapingDaemonService;
    private final EmailNotificationDaemon emailNotificationDaemon;
    private final ProductRepository productRepository;
    private final AlertRepository alertRepository;

    public AdminDaemonTestController(
        ProductScrapingDaemonService productScrapingDaemonService,
        EmailNotificationDaemon emailNotificationDaemon,
        ProductRepository productRepository,
        AlertRepository alertRepository
    ) {
        this.productScrapingDaemonService = productScrapingDaemonService;
        this.emailNotificationDaemon = emailNotificationDaemon;
        this.productRepository = productRepository;
        this.alertRepository = alertRepository;
    }

    @PostMapping("/scraping/trigger")
    public ResponseEntity<DaemonTriggerResultDTO> triggerScrapingDaemon() {
        return executeDaemonTrigger("scraping", productScrapingDaemonService::dispatchEligibleProducts);
    }

    @PostMapping("/scraping/volatility-trigger")
    public ResponseEntity<DaemonTriggerResultDTO> triggerScrapingVolatilityDaemon() {
        return executeDaemonTrigger("scraping-volatility", productScrapingDaemonService::recomputeVolatilityDaily);
    }

    @GetMapping("/scraping/status")
    public ResponseEntity<ScrapingDaemonStatusDTO> getScrapingStatus(
        @RequestParam(name = "limit", defaultValue = "20") int limit
    ) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        long totalProducts = productRepository.count();
        long eligibleProducts = productRepository.countEligibleForScraping(now);
        long lockedProducts = productRepository.countByLockedUntilAfter(now);

        List<ScrapingQueuePreviewItemDTO> nextEligible = productRepository
            .findEligibleForScraping(now, PageRequest.of(0, safeLimit))
            .stream()
            .map(this::toQueuePreview)
            .toList();

        return ResponseEntity.ok(new ScrapingDaemonStatusDTO(
            now,
            totalProducts,
            eligibleProducts,
            lockedProducts,
            nextEligible
        ));
    }

    @PostMapping("/email/trigger")
    public ResponseEntity<DaemonTriggerResultDTO> triggerEmailDaemon() {
        return executeDaemonTrigger("email-notifications", emailNotificationDaemon::validateAndSendEmailNotifications);
    }

    @GetMapping("/email/alerts-status")
    public ResponseEntity<EmailAlertsStatusDTO> getEmailAlertsStatus() {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        long activeAlerts = alertRepository.countByIsActiveTrue();
        long instantAlerts = alertRepository.countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency.instant);
        long dailyAlerts = alertRepository.countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency.daily);
        long weeklyAlerts = alertRepository.countByIsActiveTrueAndFrequency(AlertEntity.AlertFrequency.weekly);

        return ResponseEntity.ok(new EmailAlertsStatusDTO(now, activeAlerts, instantAlerts, dailyAlerts, weeklyAlerts));
    }

    private ResponseEntity<DaemonTriggerResultDTO> executeDaemonTrigger(String daemonName, Runnable trigger) {
        Instant start = Instant.now();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        try {
            trigger.run();
            long durationMs = Duration.between(start, Instant.now()).toMillis();
            return ResponseEntity.ok(new DaemonTriggerResultDTO(
                daemonName,
                "ok",
                now,
                durationMs,
                "Trigger executed"
            ));
        } catch (Exception ex) {
            long durationMs = Duration.between(start, Instant.now()).toMillis();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new DaemonTriggerResultDTO(
                daemonName,
                "error",
                now,
                durationMs,
                ex.getMessage()
            ));
        }
    }

    private ScrapingQueuePreviewItemDTO toQueuePreview(NormalizedProductEntity product) {
        return new ScrapingQueuePreviewItemDTO(
            product.getId(),
            product.getProductRef(),
            product.getCanonicalName(),
            product.getSourceName(),
            product.getSourceUrl(),
            product.getAlertPriority(),
            product.getVolatilityScore(),
            product.getNextScrapeAt(),
            product.getLockedUntil()
        );
    }
}
