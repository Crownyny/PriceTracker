package unicauca.edu.co.API.Domain.Model;

import java.util.Map;

/**
 * Payload publicado por el daemon para disparar scraping por producto.
 */
public record ScrapingJobMessage(
    String jobId,
    String searchId,
    String sourceUrl,
    String sourceName,
    String productRef,
    Integer priority,
    Map<String, Object> metadata
) {
}
