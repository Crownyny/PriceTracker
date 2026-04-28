package unicauca.edu.co.API.Presentation.DTO.OUT;

import java.time.LocalDateTime;

public record ScrapingQueuePreviewItemDTO(
    String id,
    String productRef,
    String canonicalName,
    String sourceName,
    String sourceUrl,
    Integer alertPriority,
    Double volatilityScore,
    LocalDateTime nextScrapeAt,
    LocalDateTime lockedUntil
) {
}
