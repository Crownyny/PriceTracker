package unicauca.edu.co.API.Services.IN;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import unicauca.edu.co.API.Domain.Model.ScrapingJobMessage;
import unicauca.edu.co.API.Domain.Model.ScrapingQueueProduct;
import unicauca.edu.co.API.Services.Interfaces.IN.IProductScrapingDaemonService;
import unicauca.edu.co.API.Services.Interfaces.OUT.IProductScrapingQueuePort;
import unicauca.edu.co.API.Services.Interfaces.OUT.IScrapingService;

@Service
public class ProductScrapingDaemonService implements IProductScrapingDaemonService {

    private static final Logger logger = LoggerFactory.getLogger(ProductScrapingDaemonService.class);

    private final IProductScrapingQueuePort productScrapingQueuePort;
    private final IScrapingService scrapingService;
    private final boolean daemonEnabled;
    private final int capacity;
    private final int lockMinutes;

    public ProductScrapingDaemonService(
        IProductScrapingQueuePort productScrapingQueuePort,
        IScrapingService scrapingService,
        @Value("${scraping.daemon.enabled:true}") boolean daemonEnabled,
        @Value("${scraping.daemon.capacity:100}") int capacity,
        @Value("${scraping.daemon.lock-minutes:15}") int lockMinutes
    ) {
        this.productScrapingQueuePort = productScrapingQueuePort;
        this.scrapingService = scrapingService;
        this.daemonEnabled = daemonEnabled;
        this.capacity = capacity;
        this.lockMinutes = lockMinutes;
    }

    @Override
    @Scheduled(cron = "${scraping.daemon.cron:0 * * * * *}")
    public void dispatchEligibleProducts() {
        if (!daemonEnabled) {
            return;
        }

        Instant cycleStart = Instant.now();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);

        List<ScrapingQueueProduct> lockedProducts = productScrapingQueuePort
            .lockEligibleProducts(now, capacity, lockMinutes);

        if (lockedProducts.isEmpty()) {
            logger.debug("Daemon scraping: no hay productos elegibles para el ciclo {}", now);
            return;
        }

        int publishedCount = 0;
        List<String> failedProductIds = new ArrayList<>();

        for (ScrapingQueueProduct product : lockedProducts) {
            if (!isPublishable(product)) {
                failedProductIds.add(product.id());
                logger.warn(
                    "Daemon scraping: producto {} omitido por datos incompletos (sourceUrl/sourceName/productRef)",
                    product.id()
                );
                continue;
            }

            ScrapingJobMessage job = buildJob(product, now);
            try {
                scrapingService.sendScrapingJob(job);
                publishedCount++;
            } catch (Exception ex) {
                failedProductIds.add(product.id());
                logger.error(
                    "Daemon scraping: no se pudo publicar job para producto {} (source={})",
                    product.id(),
                    product.sourceName(),
                    ex
                );
            }
        }

        if (!failedProductIds.isEmpty()) {
            productScrapingQueuePort.releaseLocks(failedProductIds);
        }

        long elapsedMs = Duration.between(cycleStart, Instant.now()).toMillis();
        logger.info(
            "Daemon scraping ciclo completado: bloqueados={}, publicados={}, fallidos={}, latenciaMs={}",
            lockedProducts.size(),
            publishedCount,
            failedProductIds.size(),
            elapsedMs
        );
    }

    @Scheduled(cron = "${scraping.daemon.volatility.cron:0 0 3 * * *}")
    public void recomputeVolatilityDaily() {
        if (!daemonEnabled) {
            return;
        }

        Instant cycleStart = Instant.now();
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).withSecond(0).withNano(0);
        LocalDateTime windowStart = now.minusDays(7);

        int affectedRows = productScrapingQueuePort.recomputeVolatilityScore(windowStart);

        long elapsedMs = Duration.between(cycleStart, Instant.now()).toMillis();
        logger.info(
            "Daemon volatility ciclo completado: windowStart={}, affectedRows={}, latenciaMs={}",
            windowStart,
            affectedRows,
            elapsedMs
        );
    }

    private ScrapingJobMessage buildJob(ScrapingQueueProduct product, LocalDateTime now) {
        int priority = normalizePriority(product.alertPriority());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("trigger", "scheduled-daemon");
        metadata.put("product_id", product.id());
        metadata.put("canonical_name", product.canonicalName());
        metadata.put("scheduled_at", now.toString());

        return new ScrapingJobMessage(
            UUID.randomUUID().toString(),
            null,
            product.sourceUrl(),
            product.sourceName(),
            product.productRef(),
            priority,
            metadata
        );
    }

    private int normalizePriority(Integer alertPriority) {
        if (alertPriority == null || alertPriority < 0 || alertPriority > 3) {
            return 0;
        }
        return alertPriority;
    }

    private boolean isPublishable(ScrapingQueueProduct product) {
        return product != null
            && hasText(product.id())
            && hasText(product.sourceUrl())
            && hasText(product.sourceName())
            && hasText(product.productRef());
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
