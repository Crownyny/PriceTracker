package unicauca.edu.co.API.Domain.Model;

/**
 * Producto bloqueado por el daemon para ser procesado por el Scraper.
 */
public record ScrapingQueueProduct(
    String id,
    String productRef,
    String sourceUrl,
    String sourceName,
    String canonicalName,
    Integer alertPriority
) {
}
