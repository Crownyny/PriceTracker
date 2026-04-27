package unicauca.edu.co.API.DataAccess.Adapter;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import unicauca.edu.co.API.Domain.Model.ScrapingQueueProduct;
import unicauca.edu.co.API.Services.Interfaces.OUT.IProductScrapingQueuePort;

@Component
public class ProductScrapingQueueAdapter implements IProductScrapingQueuePort {

    private static final String LOCK_ELIGIBLE_PRODUCTS_SQL = """
        WITH candidates AS (
            SELECT id
            FROM normalized_products
            WHERE next_scrape_at <= :now
              AND (locked_until IS NULL OR locked_until <= :now)
            ORDER BY alert_priority DESC, volatility_score DESC, next_scrape_at ASC
            LIMIT :capacity
            FOR UPDATE SKIP LOCKED
        )
        UPDATE normalized_products p
        SET locked_until = :lockUntil
        FROM candidates c
        WHERE p.id = c.id
        RETURNING p.id, p.product_ref, p.source_url, p.source_name, p.canonical_name, p.alert_priority
        """;

    private static final String RELEASE_LOCKS_SQL = """
        UPDATE normalized_products
        SET locked_until = NULL
        WHERE id IN (:ids)
        """;

    private static final String RESET_VOLATILITY_SQL = """
        UPDATE normalized_products
        SET volatility_score = 0
        WHERE volatility_score <> 0
        """;

    private static final String UPDATE_VOLATILITY_SQL = """
        WITH ranked_prices AS (
            SELECT
                ph.product_id,
                ph.price,
                LAG(ph.price) OVER (
                    PARTITION BY ph.product_id
                    ORDER BY ph.recorded_at
                ) AS prev_price
            FROM price_history ph
            WHERE ph.recorded_at >= :windowStart
        ),
        price_changes AS (
            SELECT
                rp.product_id,
                COUNT(*) FILTER (
                    WHERE rp.prev_price IS NOT NULL
                      AND rp.price IS DISTINCT FROM rp.prev_price
                ) AS change_count
            FROM ranked_prices rp
            GROUP BY rp.product_id
        )
        UPDATE normalized_products p
        SET volatility_score = pc.change_count
        FROM price_changes pc
        WHERE p.id = pc.product_id
        """;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    @SuppressWarnings("unchecked")
    public List<ScrapingQueueProduct> lockEligibleProducts(LocalDateTime now, int capacity, int lockMinutes) {
        if (capacity <= 0 || lockMinutes <= 0) {
            return Collections.emptyList();
        }

        LocalDateTime lockUntil = now.plusMinutes(lockMinutes);

        Query query = entityManager.createNativeQuery(LOCK_ELIGIBLE_PRODUCTS_SQL);
        query.setParameter("now", now);
        query.setParameter("lockUntil", lockUntil);
        query.setParameter("capacity", capacity);

        List<Object[]> rows = query.getResultList();
        return rows.stream()
            .map(this::mapRow)
            .toList();
    }

    @Override
    @Transactional
    public void releaseLocks(List<String> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return;
        }

        Query query = entityManager.createNativeQuery(RELEASE_LOCKS_SQL);
        query.setParameter("ids", productIds);
        query.executeUpdate();
    }

    @Override
    @Transactional
    public int recomputeVolatilityScore(LocalDateTime windowStart) {
        if (windowStart == null) {
            throw new IllegalArgumentException("windowStart is required");
        }

        Query resetQuery = entityManager.createNativeQuery(RESET_VOLATILITY_SQL);
        int resetCount = resetQuery.executeUpdate();

        Query updateQuery = entityManager.createNativeQuery(UPDATE_VOLATILITY_SQL);
        updateQuery.setParameter("windowStart", windowStart);
        int updatedCount = updateQuery.executeUpdate();

        return resetCount + updatedCount;
    }

    private ScrapingQueueProduct mapRow(Object[] row) {
        int alertPriority = 0;
        if (row[5] instanceof Number numericPriority) {
            alertPriority = numericPriority.intValue();
        }

        return new ScrapingQueueProduct(
            row[0] == null ? null : row[0].toString(),
            row[1] == null ? null : row[1].toString(),
            row[2] == null ? null : row[2].toString(),
            row[3] == null ? null : row[3].toString(),
            row[4] == null ? null : row[4].toString(),
            alertPriority
        );
    }
}
