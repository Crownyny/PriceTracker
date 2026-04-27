package unicauca.edu.co.API.Services.Interfaces.OUT;

import java.time.LocalDateTime;
import java.util.List;

import unicauca.edu.co.API.Domain.Model.ScrapingQueueProduct;

/**
 * Puerto de salida para gestionar cola materializada de scraping en PostgreSQL.
 */
public interface IProductScrapingQueuePort {

    /**
     * Bloquea y retorna productos elegibles para scraping en una sola operación transaccional.
     */
    List<ScrapingQueueProduct> lockEligibleProducts(LocalDateTime now, int capacity, int lockMinutes);

    /**
     * Libera bloqueos de productos cuando no fue posible publicar jobs.
     */
    void releaseLocks(List<String> productIds);

    /**
     * Recalcula volatility_score de forma masiva usando cambios de precio desde windowStart.
     */
    int recomputeVolatilityScore(LocalDateTime windowStart);
}
